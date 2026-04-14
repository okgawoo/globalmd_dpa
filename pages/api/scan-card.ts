import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image } = req.body
  if (!image) return res.status(400).json({ error: '이미지가 없습니다.' })

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text: `이 명함 이미지에서 다음 정보를 추출해주세요. JSON 형식으로만 응답해주세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.

{
  "name": "이름 (한글 우선, 없으면 영문)",
  "company": "회사명",
  "position": "직함/직위",
  "phone": "휴대폰 번호 (010-0000-0000 형식)",
  "phone2": "유선 전화번호 (있으면)",
  "email": "이메일",
  "address": "주소 (있으면)",
  "fax": "팩스번호 (있으면)"
}

정보가 없는 항목은 빈 문자열("")로 채워주세요.`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    let parsed
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { name: '', company: '', position: '', phone: '', phone2: '', email: '', address: '', fax: '', raw: text }
    }

    return res.status(200).json(parsed)
  } catch (e: any) {
    return res.status(500).json({ error: e.message || '명함 스캔 중 오류가 발생했습니다.' })
  }
}
