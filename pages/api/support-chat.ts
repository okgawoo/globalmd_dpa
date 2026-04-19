import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_CHANNEL = 'C0ASED4L16V'
const SLACK_BOT_TOKEN = 'xoxb-8679762004994-10885592720434-P3GMN22U4RPCSAb46mTUj7zP'

const SYSTEM_PROMPT = `당신은 DPA(보험 설계사 업무 자동화 플랫폼)의 고객센터 AI 상담원입니다.
친근하고 따뜻한 말투로 설계사분들의 질문에 답변해주세요.

DPA 주요 기능:
- 대시보드: 오늘 할 일, 완납임박/보장공백/생일 알림, 영업일정, 핵심지표 확인
- 데이터 입력: 고객 정보를 복불(텍스트 긁기), 명함 OCR, 수동입력으로 등록
- 고객 관리: 마이고객/관심고객 구분, 고객 정보 조회 및 수정
- 문자 발송: AI 추천 문자(완납임박/생일/보장공백 등), 단체문자 발송
- 영업 관리: 미팅 일정, 영업 이력 관리
- 전자명함: 설계사 명함 디지털화, 고객에게 공유
- 설정: 문자 발신번호 인증, 알림 설정

답변 원칙:
1. 평이한 언어 사용 (전문용어 금지)
2. 간결하고 명확하게 답변
3. 모르는 질문은 "담당자에게 연결해드리겠습니다"라고 안내
4. 항상 친근하고 따뜻한 톤 유지`

async function sendSlackAlert(agentName: string, agentId: string, messages: any[]) {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({
      channel: SLACK_CHANNEL,
      attachments: [{
        color: '#E24B4A',
        text: `🆘 *고객센터 담당자 연결 요청*\n설계사: ${agentName}\nagent_id: ${agentId}\n마지막 질문: ${lastUserMsg}`,
      }]
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { agentId, agentName, messages, escalate } = req.body

  if (!agentId || !messages) return res.status(400).json({ error: '필수 값 누락' })

  // 담당자 연결 요청
  if (escalate) {
    await sendSlackAlert(agentName || '이름없음', agentId, messages)
    await supabase.from('dpa_support_chats').insert({
      agent_id: agentId,
      role: 'user',
      content: '[담당자 연결 요청]',
      is_escalated: true,
    })
    return res.status(200).json({ escalated: true })
  }

  // Claude API 호출
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    }),
  })

  const data = await claudeRes.json()
  const reply = data.content?.[0]?.text || '죄송해요, 잠시 후 다시 시도해주세요.'

  // DB 저장 (사용자 마지막 메시지 + AI 답변)
  const lastUserMsg = messages[messages.length - 1]
  await supabase.from('dpa_support_chats').insert([
    { agent_id: agentId, role: 'user', content: lastUserMsg.content },
    { agent_id: agentId, role: 'assistant', content: reply },
  ])

  return res.status(200).json({ reply })
}
