import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_BOT_TOKEN = 'xoxb-8679762004994-10885592720434-P3GMN22U4RPCSAb46mTUj7zP'
const SLACK_CHANNEL_ID = 'C0ASED4L16V' // dpa-admin

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { type, name, phone, username, plan_type, message, personal_email, agent_number, telecom } = req.body

  const PLAN_LABELS: Record<string, string> = {
    demo: '🆓 30일 무료 체험 (데모)',
    basic: '🥉 베이직',
    standard: '🥈 스탠다드',
    pro: '🥇 프로',
  }

  let body: object

  if (type === 'signup') {
    const infoText = `🆕 *새 회원가입 신청!*\n\n👤 이름: ${name}\n📱 연락처: ${phone}\n🆔 아이디: \`${username}\`\n📧 이메일: ${personal_email || '미등록'}\n📦 플랜: ${PLAN_LABELS[plan_type] || plan_type || '미선택'}${agent_number ? `\n🪪 등록번호: ${agent_number}` : ''}${telecom ? `\n📡 통신사: ${telecom}` : ''}`
    body = {
      channel: SLACK_CHANNEL_ID,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: infoText }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ 승인하기', emoji: true },
              style: 'primary',
              action_id: 'approve_user',
              value: username,
              confirm: {
                title: { type: 'plain_text', text: '정말 승인할까요?' },
                text: { type: 'mrkdwn', text: `*${name}* (${username}) 님을 승인하면\n즉시 로그인 가능해집니다.` },
                confirm: { type: 'plain_text', text: '승인' },
                deny: { type: 'plain_text', text: '취소' }
              }
            }
          ]
        }
      ]
    }
  } else if (type === 'password_reset') {
    body = {
      channel: SLACK_CHANNEL_ID,
      text: `🔑 *비밀번호 재설정 요청!*\n\n👤 이름: ${name}\n🆔 아이디: ${username}\n📧 이메일: ${personal_email || '미등록'}`
    }
  } else {
    body = { channel: SLACK_CHANNEL_ID, text: message || '알림이 도착했어요.' }
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error)
    res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('Slack notify error:', error?.message)
    res.status(500).json({ ok: false })
  }
}
