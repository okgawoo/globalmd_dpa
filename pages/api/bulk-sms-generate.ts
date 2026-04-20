import type { NextApiRequest, NextApiResponse } from 'next'

const SITUATION_LABELS: Record<string, string> = {
  hello: '첫 인사',
  greeting: '안부 인사',
  birthday: '생일 축하',
  nearDone: '완납 임박',
  gap: '보장 공백',
  expiry: '만기 안내',
}

const TONE_GUIDE: Record<string, string> = {
  친근: '친근하고 따뜻하게, 이모지 1~2개 사용',
  정중: '정중하고 격식 있게, 이모지 없이',
  애교: '밝고 애교 있게, 이모지 2~3개 사용',
  간결: '짧고 간결하게 핵심만, 이모지 없이',
}

const SITUATION_DESC: Record<string, string> = {
  hello: '처음 인사를 드리는 상황. 담당 설계사로서 앞으로 잘 부탁드린다는 내용.',
  greeting: '오랜만에 안부를 묻는 상황. 건강히 잘 지내시는지 묻고 좋은 하루 되시길 바란다는 내용.',
  birthday: '고객의 생일을 축하하는 상황. 진심 어린 생일 축하와 건강을 기원하는 내용.',
  nearDone: '보험 납입이 거의 완료되는 상황. 오랫동안 성실하게 납입해 주셔서 감사하고 완납 후 혜택을 안내해 드리겠다는 내용.',
  gap: '보험 보장 공백이 발견된 상황. 고객의 보험을 검토하다 보장 공백이 확인됐고 상담을 요청하는 내용.',
  expiry: '보험 만기가 다가오는 상황. 만기 이후 보장 공백이 생기지 않도록 미리 안내하는 내용.',
}

function getSeasonInfo(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const dateStr = `${month}월 ${day}일`

  let season = ''
  let weatherNote = ''

  if (month >= 3 && month <= 5) {
    season = '봄'
    if (month === 3) weatherNote = '봄이 시작되어 낮엔 따뜻하지만 아침저녁은 아직 쌀쌀한 환절기'
    else if (month === 4) weatherNote = '따뜻한 봄날씨로 야외 활동하기 좋은 계절'
    else weatherNote = '봄이 무르익어 초여름 느낌이 나는 따뜻한 날씨'
  } else if (month >= 6 && month <= 8) {
    season = '여름'
    if (month === 6) weatherNote = '초여름으로 더위가 시작되고 습도가 높아지는 날씨'
    else if (month === 7) weatherNote = '한여름 더위와 장마철이 겹치는 시기'
    else weatherNote = '무더운 한여름, 더위가 절정에 달하는 날씨'
  } else if (month >= 9 && month <= 11) {
    season = '가을'
    if (month === 9) weatherNote = '더위가 물러가고 시원한 가을 날씨가 시작되는 시기'
    else if (month === 10) weatherNote = '단풍이 물드는 선선하고 맑은 가을 날씨'
    else weatherNote = '가을이 깊어지고 아침저녁으로 제법 쌀쌀한 날씨'
  } else {
    season = '겨울'
    if (month === 12) weatherNote = '추위가 시작되는 초겨울 날씨'
    else if (month === 1) weatherNote = '한겨울 추위가 절정에 달하는 날씨'
    else weatherNote = '겨울이 막바지에 접어들고 조금씩 풀리기 시작하는 날씨'
  }

  return `현재 날짜: ${dateStr} (${season})\n날씨 상황: ${weatherNote}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { situation, tone, agentName, customerName } = req.body

  const greeting = customerName
    ? `안녕하세요 ${customerName}고객님!`
    : '안녕하세요!'

  const seasonInfo = getSeasonInfo()

  const prompt = `당신은 보험 설계사 ${agentName}입니다. 고객에게 보내는 문자 메시지를 작성해주세요.

${seasonInfo}

상황: ${SITUATION_LABELS[situation]} - ${SITUATION_DESC[situation]}
톤: ${TONE_GUIDE[tone] || '친근하고 따뜻하게'}
첫 인사말: "${greeting}"으로 시작

규칙:
- 첫 줄은 반드시 "${greeting}"으로 시작
- 총 5~6줄 분량으로 작성
- 날씨 언급이 필요하다면 반드시 위의 현재 날씨 상황을 반영할 것 (계절에 맞지 않는 날씨 표현 금지)
- 안부 인사 상황이 아닌 경우 날씨 언급은 자연스러울 때만 가볍게
- 마지막은 빈 줄 하나 띄고 "설계사 ${agentName} 드림" 으로 끝내기
- 본문 중간에 설계사 이름이나 소속을 넣지 말 것
- 자연스럽고 진심 어린 내용
- 문자 내용만 출력 (설명, 주석 없이)`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    res.status(200).json({ text })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: '생성 실패' })
  }
}
