import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `아래는 보험사 앱에서 긁어온 보장 내역 텍스트입니다.
이 텍스트를 분석해서 아래 JSON 형식으로만 응답해주세요. 다른 설명은 절대 하지 마세요.

{
  "name": "고객명 (없으면 null)",
  "age": 나이숫자 (없으면 null),
  "gender": "남 또는 여 (없으면 null)",
  "contracts": [
    {
      "company": "보험사명",
      "product_name": "상품명",
      "monthly_fee": 월보험료숫자(원단위),
      "payment_status": "완납 또는 유지 또는 실효",
      "payment_rate": 납입률숫자,
      "coverages": [
        {
          "category": "암진단 또는 뇌혈관 또는 심장 또는 간병 또는 입원일당 또는 사망 또는 기타",
          "name": "보장명",
          "amount": 보장금액숫자(원단위),
          "brain_type": "뇌출혈 또는 뇌졸중 또는 뇌혈관 (뇌혈관 카테고리인 경우만)"
        }
      ]
    }
  ]
}

텍스트:
${text}`
        }],
      }),
    })

    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    const clean = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (e) {
    return res.status(500).json({ error: '파싱 실패' })
  }
}
