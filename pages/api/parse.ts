import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text) return res.status(400).json({ error: '텍스트가 없어요!' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키가 없어요!' })

  const systemPrompt = `당신은 보험 데이터 파싱 전문가입니다.
입력된 보험 보장 내역 텍스트를 분석하여 아래 JSON 형식으로 정확하게 반환하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요.

카테고리 분류 기준:
- 암진단: 암진단비, 유사암, 특정암, 고액암 관련
- 뇌혈관: 뇌출혈, 뇌졸중, 뇌혈관질환 관련 (brain_type: 뇌출혈/뇌졸중/뇌혈관 중 하나)
- 심장: 급성심근경색, 허혈성심장질환 관련
- 간병: 간병인사용일당, 치매진단 관련
- 수술비: 수술비 관련 (종수술 포함)
- 실손: 입원의료비, 통원의료비, 처방조제료
- 비급여: 도수치료, 주사제, MRI 등 비급여 항목
- 상해: 상해사망, 상해후유장해, 교통상해 관련
- 사고처리: 교통사고처리지원금 관련
- 벌금: 교통사고벌금, 업무상과실벌금 관련
- 특이사항: 위에 해당 안되는 특이 보장

반환 형식:
{
  "name": "고객명 (없으면 null)",
  "age": 나이숫자 (없으면 null),
  "gender": "남 또는 여 (없으면 null)",
  "contracts": [
    {
      "company": "보험사명",
      "product_name": "상품명",
      "insurance_type": "건강/실손/운전자/자동차/암/치아/간병/CI/종신 중 하나",
      "monthly_fee": 월보험료숫자 (없으면 0),
      "payment_status": "유지/완납/실효 중 하나",
      "payment_rate": 납입률숫자 (없으면 0),
      "contract_start": "YYYY.MM 형식 (없으면 null)",
      "payment_years": "20년납 형식 (없으면 null)",
      "expiry_age": "90세 형식 (없으면 null)",
      "coverages": [
        {
          "category": "위 카테고리 중 하나",
          "name": "보장명",
          "amount": 금액숫자(원단위),
          "brain_type": "뇌혈관 카테고리일 때만: 뇌출혈/뇌졸중/뇌혈관 중 하나"
        }
      ]
    }
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    })

    const data = await response.json()
    const raw = data.content?.[0]?.text || '{}'
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: '파싱 중 오류가 발생했어요!' })
  }
}
