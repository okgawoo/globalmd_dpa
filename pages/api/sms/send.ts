import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase 클라이언트 (서버사이드 - service role key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 솔라피 API 설정
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY!;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET!;
const SOLAPI_API_URL = 'https://api.solapi.com/messages/v4/send';

// 플랜별 SMS 기본 한도
const PLAN_SMS_LIMITS: Record<string, number> = {
  basic: 0,
  standard: 500,
  pro: 1000,
};

// HMAC-SHA256 서명 생성
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

// 이번 달 발송 성공 건수 조회
async function getMonthlyUsage(agentId: string): Promise<number> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from('dpa_messages')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('status', 'sent')
    .gte('sent_at', firstDay);

  if (error) {
    console.error('사용량 조회 에러:', error);
    return 0;
  }

  return count || 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST 메서드만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, text, agent_id, customer_id, message_type } = req.body;

    // 필수 파라미터 검증
    if (!to || !text || !agent_id) {
      return res.status(400).json({
        error: '필수 항목이 누락되었습니다 (to, text, agent_id)',
      });
    }

    // 1. 설계사 정보 조회 (발신번호 + 플랜)
    const { data: agent, error: agentError } = await supabase
      .from('dpa_agents')
      .select('phone, name, settings')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: '설계사 정보를 찾을 수 없습니다' });
    }

    if (!agent.phone) {
      return res.status(400).json({
        error: '발신번호가 등록되지 않았습니다. 설정에서 발신번호를 등록해주세요.',
      });
    }

    // 2. SMS 사용 가능 여부 체크
    const settings = agent.settings || {};
    const plan = settings.plan || 'basic';
    const smsLimit = settings.sms_limit ?? PLAN_SMS_LIMITS[plan] ?? 0;
    const smsEnabled = settings.sms_enabled !== false;

    if (!smsEnabled || smsLimit === 0) {
      return res.status(403).json({
        error: '현재 플랜에서는 문자 발송을 사용할 수 없습니다.',
        plan,
      });
    }

    // 3. 이번 달 한도 체크 (성공 건만 카운트)
    const used = await getMonthlyUsage(agent_id);

    if (used >= smsLimit) {
      return res.status(429).json({
        error: `이번 달 문자 발송 한도(${smsLimit}건)를 초과했습니다.`,
        used,
        limit: smsLimit,
        plan,
      });
    }

    // 발신번호 하이픈 제거
    const fromNumber = agent.phone.replace(/-/g, '');
    const toNumber = to.replace(/-/g, '');

    // 4. 솔라피 API로 SMS 발송
    const { authorization } = generateSignature();

    const solapiResponse = await fetch(SOLAPI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        message: {
          to: toNumber,
          from: fromNumber,
          text: text,
          autoTypeDetect: true,
        },
      }),
    });

    const solapiResult = await solapiResponse.json();

    // 발송 실패 체크
    if (!solapiResponse.ok) {
      await supabase.from('dpa_messages').insert({
        agent_id,
        customer_id: customer_id || null,
        message_type: message_type || 'sms',
        to_number: toNumber,
        from_number: fromNumber,
        content: text,
        status: 'failed',
        error_message: solapiResult?.errorMessage || '발송 실패',
        sent_at: new Date().toISOString(),
      });

      return res.status(400).json({
        error: '문자 발송에 실패했습니다',
        detail: solapiResult?.errorMessage || '알 수 없는 오류',
      });
    }

    // 5. 발송 이력 저장 (성공)
    await supabase.from('dpa_messages').insert({
      agent_id,
      customer_id: customer_id || null,
      message_type: message_type || 'sms',
      to_number: toNumber,
      from_number: fromNumber,
      content: text,
      status: 'sent',
      solapi_group_id: solapiResult?.groupInfo?.groupId || null,
      solapi_message_id: solapiResult?.messageId || null,
      sent_at: new Date().toISOString(),
    });

    // 6. 남은 건수 계산해서 응답에 포함
    const remaining = smsLimit - (used + 1);

    return res.status(200).json({
      success: true,
      message: '문자가 발송되었습니다',
      data: {
        messageId: solapiResult?.messageId,
        groupId: solapiResult?.groupInfo?.groupId,
        from: fromNumber,
        to: toNumber,
      },
      usage: {
        used: used + 1,
        limit: smsLimit,
        remaining,
        plan,
      },
    });
  } catch (error: any) {
    console.error('SMS 발송 에러:', error);
    return res.status(500).json({
      error: '서버 오류가 발생했습니다',
      detail: error.message,
    });
  }
}
