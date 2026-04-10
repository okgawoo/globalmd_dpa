import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, name, phone, username, agent_number, message } = req.body

  let text = ''

  if (type === 'signup') {
    text = `🆕 *새 회원가입 신청!*\n\n` +
      `👤 이름: ${name}\n` +
      `📱 연락처: ${phone}\n` +
      `🆔 아이디: ${username}\n` +
      `📋 설계사 등록번호: ${agent_number || '미입력'}\n\n` +
      `> Supabase › dpa_agents 테이블에서 *status = active* 로 변경하면 승인 완료!`
  } else {
    text = message || '알림이 도착했어요.'
  }

  try {
    await fetch(SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Slack notify error:', error)
    res.status(500).json({ ok: false })
  }
}
