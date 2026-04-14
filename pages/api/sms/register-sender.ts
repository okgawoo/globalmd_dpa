import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY!;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET!;

function generateSignature() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return {
    authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, agent_id } = req.body;

    if (!phone || !agent_id) {
      return res.status(400).json({ error: '발신번호와 agent_id가 필요합니다.' });
    }

    const cleanPhone = phone.replace(/-/g, '');
    const { authorization } = generateSignature();

    // 솔라피 발신번호 등록 API 호출
    const solapiRes = await fetch('https://api.solapi.com/senderid/v1/numbers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        phoneNumber: cleanPhone,
      }),
    });

    const solapiResult = await solapiRes.json();

    if (!solapiRes.ok) {
      return res.status(400).json({
        error: solapiResult?.errorMessage || '발신번호 등록에 실패했습니다.',
        detail: solapiResult,
      });
    }

    // 성공 시 dpa_agents에 발신번호 + 상태 저장
    // agent_id가 agents.id일 수도, user_id일 수도 있음
    let agent = null;
    const { data: byId } = await supabase.from('dpa_agents').select('id, settings').eq('id', agent_id).single();
    if (byId) {
      agent = byId;
    } else {
      const { data: byUid } = await supabase.from('dpa_agents').select('id, settings').eq('user_id', agent_id).single();
      agent = byUid;
    }

    if (agent) {
      const newSettings = {
        ...(agent.settings || {}),
        sender_verified: true,
        sender_phone: cleanPhone,
      };
      await supabase.from('dpa_agents').update({
        phone: cleanPhone,
        settings: newSettings,
      }).eq('id', agent.id);
    }

    return res.status(200).json({
      success: true,
      message: '발신번호 등록 요청이 완료되었습니다.',
    });

  } catch (error: any) {
    console.error('발신번호 등록 에러:', error);
    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      detail: error.message,
    });
  }
}
