import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 (서버사이드 - service role key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 플랜별 SMS 기본 한도
const PLAN_SMS_LIMITS: Record<string, number> = {
  basic: 0,
  standard: 500,
  pro: 1000,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // GET 메서드만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agent_id } = req.query;

    if (!agent_id || typeof agent_id !== 'string') {
      return res.status(400).json({ error: 'agent_id가 필요합니다' });
    }

    // 1. 설계사 플랜 정보 조회
    // agent_id가 agents.id일 수도, auth.uid(user_id)일 수도 있음
    let agent = null;

    const { data: agentById } = await supabase
      .from('dpa_agents')
      .select('settings')
      .eq('id', agent_id)
      .single();

    if (agentById) {
      agent = agentById;
    } else {
      const { data: agentByUid } = await supabase
        .from('dpa_agents')
        .select('settings')
        .eq('user_id', agent_id)
        .single();
      agent = agentByUid;
    }

    if (!agent) {
      return res.status(404).json({ error: '설계사 정보를 찾을 수 없습니다' });
    }

    const settings = agent.settings || {};
    const plan = settings.plan || 'basic';
    const smsLimit = settings.sms_limit ?? PLAN_SMS_LIMITS[plan] ?? 0;

    // 2. 이번 달 발송 성공 건수 조회
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error: countError } = await supabase
      .from('dpa_messages')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('status', 'sent')
      .gte('sent_at', firstDay);

    if (countError) {
      return res.status(500).json({ error: '사용량 조회에 실패했습니다' });
    }

    const used = count || 0;
    const remaining = Math.max(0, smsLimit - used);

    return res.status(200).json({
      used,
      limit: smsLimit,
      remaining,
      plan,
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    });
  } catch (error: any) {
    console.error('SMS 사용량 조회 에러:', error);
    return res.status(500).json({
      error: '서버 오류가 발생했습니다',
      detail: error.message,
    });
  }
}
