import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Slack이 form-encoded로 보내므로 bodyParser 유지
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  let payload: any
  try {
    payload = JSON.parse(req.body?.payload || '{}')
  } catch {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const action = payload.actions?.[0]
  if (!action) return res.status(200).end()

  if (action.action_id === 'approve_user') {
    const slug = action.value
    const responseUrl = payload.response_url

    // dpa_agents status → approved
    const { data: agent, error } = await supabaseAdmin
      .from('dpa_agents')
      .update({ status: 'approved' })
      .eq('slug', slug)
      .select('name, email, personal_email')
      .single()

    if (error || !agent) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replace_original: true,
          text: `❌ 승인 실패 (slug: ${slug})\n오류: ${error?.message || '유저 없음'}`
        })
      })
      return res.status(200).end()
    }

    // Slack 메시지 업데이트 (버튼 제거 + 완료 표시)
    const approvedBy = payload.user?.name || payload.user?.username || '관리자'
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replace_original: true,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *승인 완료!*\n\n👤 이름: ${agent.name}\n🆔 아이디: \`${slug}\`\n📧 이메일: ${agent.personal_email || agent.email}\n\n_${approvedBy}님이 승인했습니다_`
            }
          }
        ]
      })
    })

    return res.status(200).end()
  }

  res.status(200).end()
}
