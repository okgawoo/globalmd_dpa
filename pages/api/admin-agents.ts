import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  // 요청한 유저가 admin인지 확인
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '인증 필요' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '인증 실패' })

  const { data: me } = await supabaseAdmin
    .from('dpa_agents')
    .select('email')
    .eq('user_id', user.id)
    .single()

  if (me?.email !== 'admin@dpa.com') return res.status(403).json({ error: '권한 없음' })

  // 전체 설계사 목록 조회
  const { data: agents } = await supabaseAdmin
    .from('dpa_agents')
    .select('id, name, email, phone, status, plan_type, slug, created_at, demo_started_at, demo_expires_at')
    .order('created_at', { ascending: false })

  // 전체 발신번호 신청 목록 조회
  const { data: smsAuthList } = await supabaseAdmin
    .from('dpa_sms_auth')
    .select('*')
    .order('submitted_at', { ascending: false })

  return res.status(200).json({ agents: agents || [], smsAuthList: smsAuthList || [] })
}
