import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_BOT_TOKEN = 'xoxb-8679762004994-10885592720434-P3GMN22U4RPCSAb46mTUj7zP'
const SLACK_CHANNEL_ID = 'C0ASED4L16V' // dpa-admin

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, name, phone, username, agent_number, plan_type, telecom, message } = req.body

  const PLAN_LABELS: Record<string, string> = {
    demo: '🆓 7일 무료 체험 (데모)',
    basic: '🥉 베이직 49,000원/월',
    standard: '🥈 스탠다드 99,000원/월',
    pro: '🥇 프로 149,000원/월',
  }

  let text = ''
  if (type === 'signup') {
    text = `🆕 *새 회원가입 신청!*\n\n👤 이름: ${name}\n📱 연락처: ${phone}\n🆔 아이디: ${username}\n📋 설계사 등록번호: ${agent_number || '미입력'}\n📦 선택 플랜: ${PLAN_LABELS[plan_type] || plan_type || '미선택'}\n📡 통신사: ${telecom || '미입력'}\n\n> Supabase › dpa_agents 에서 *status = active* 로 변경하면 승인 완료!`
  } else {
    text = message || '알림이 도착했어요.'
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, text })
    })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error)
    res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('Slack notify error:', error?.message)
    res.status(500).json({ ok: false })
  }
}
