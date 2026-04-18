import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { agentSlug, name, phone, birth } = req.body
  if (!agentSlug || !name) return res.status(400).json({ error: '필수 정보가 없어요' })

  // slug로 설계사 조회
  const { data: agent } = await supabase
    .from('dpa_agents')
    .select('id, name, user_id')
    .eq('slug', agentSlug)
    .eq('status', 'approved')
    .single()

  if (!agent) return res.status(404).json({ error: '설계사를 찾을 수 없어요' })

  // 관심고객으로 등록
  const { error } = await supabase.from('dpa_customers').insert({
    name,
    phone: phone || null,
    birth_date: birth || null,
    customer_type: 'prospect',
    grade: '일반',
    agent_id: agent.user_id,
  })

  if (error) return res.status(500).json({ error: '등록 중 오류가 발생했어요' })

  // 슬랙 알림
  const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
  if (SLACK_TOKEN) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_TOKEN}` },
      body: JSON.stringify({
        channel: 'dpa-admin',
        text: `📇 *전자명함 관심고객 등록!*\n설계사: ${agent.name}\n고객명: ${name}${phone ? `\n연락처: ${phone}` : ''}${birth ? `\n생년월일: ${birth}` : ''}`,
      }),
    })
  }

  return res.status(200).json({ success: true })
}
