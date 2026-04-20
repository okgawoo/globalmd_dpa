import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SITUATION_LABELS: Record<string, string> = {
  hello: '첫 인사',
  greeting: '안부 인사',
  birthday: '생일 축하',
  nearDone: '완납 임박',
  gap: '보장 공백',
  expiry: '만기 안내',
}

const TONE_LABELS: Record<string, string> = {
  친근: '친근하고 따뜻하게, 이모지 1~2개 사용',
  정중: '정중하고 격식 있게, 이모지 없이',
  애교: '밝고 애교 있게, 이모지 2~3개 사용',
  간결: '짧고 간결하게 핵심만, 이모지 없이',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { situation, tone, agentName, customerName } = req.body

  const greeting = customerName
    ? `안녕하세요 ${customerName}고객님!`
    : '안녕하세요!'

  const situationDesc: Record<string, string> = {
    hello: '처음 인사를 드리는 상황. 담당 설계사로서 앞으로 잘 부탁드린다는 내용.',
    greeting: '오랜만에 안부를 묻는 상황. 건강히 잘 지내시는지, 좋은 하루 되시길 바란다는 내용.',
    birthday: '고객의 생일을 축하하는 상황. 진심 어린 생일 축하와 건강을 기원하는 내용.',
    nearDone: '보험 납입이 거의 완료되는 상황. 오랫동안 성실하게 납입해 주셔서 감사하고 완납 후 혜택을 안내해 드리겠다는 내용.',
    gap: '보험 보장 공백이 발견된 상황. 고객의 보험을 검토하다 보장 공백이 확인됐고 상담을 요청하는 내용.',
    expiry: '보험 만기가 다가오는 상황. 만기 이후 보장 공백이 생기지 않도록 미리 안내하는 내용.',
  }

  const prompt = `당신은 보험 설계사 ${agentName}입니다. 고객에게 보내는 문자 메시지를 작성해주세요.

상황: ${SITUATION_LABELS[situation]} - ${situationDesc[situation]}
톤: ${TONE_LABELS[tone] || '친근하고 따뜻하게'}
첫 인사말: "${greeting}"으로 시작

규칙:
- 첫 줄은 반드시 "${greeting}"으로 시작
- 총 5~6줄 분량
- 마지막 줄은 빈 줄 하나 띄고 "설계사 ${agentName} 드림" 으로 끝내기
- 설계사 이름이나 소속을 본문 중간에 넣지 말 것
- 자연스럽고 진심 어린 문자 내용
- 문자 내용만 출력 (설명, 주석 없이)`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    res.status(200).json({ text })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '생성 실패' })
  }
}
