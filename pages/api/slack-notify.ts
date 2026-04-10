import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL_ID = 'C0ASED4L16V' // dpa-admin 채널

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, name, phone, username, agent_number, message } = req.body

  let text = ''

  if (type === 'signup') {
    text = `🆕 *새 회원가입 신청이 들어왔어요!*\n\n` +
      `👤 이름: ${name}\n` +
      `📱 연락처: ${phone}\n` +
      `🆔 아이디: ${username}\n` +
      `📋 설계사 등록번호: ${agent_number || '미입력'}\n\n` +
      `> Supabase > dpa_agents 테이블에서 status를 *active*로 변경하면 승인 완료!`
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
      body: JSON.stringify({
        channel: SLACK_CHANNEL_ID,
        text,
        mrkdwn: true
      })
    })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error)
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Slack notify error:', error)
    res.status(500).json({ ok: false })
  }
}
