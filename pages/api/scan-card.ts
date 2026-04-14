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

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[scan-card] ANTHROPIC_API_KEY 환경변수가 없습니다')
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' })
    }

    console.log('[scan-card] 이미지 크기:', Math.round(base64Data.length / 1024), 'KB')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
    console.log('[scan-card] Claude API 상태:', response.status)
    console.log('[scan-card] Claude API 응답:', JSON.stringify(data).slice(0, 500))

    if (!response.ok) {
      console.error('[scan-card] Claude API 에러:', data)
      return res.status(500).json({ error: data.error?.message || 'Claude API 오류가 발생했습니다.' })
    }

    const text = data.content?.[0]?.text || ''
    console.log('[scan-card] 추출된 텍스트:', text.slice(0, 300))

    if (!text) {
      return res.status(500).json({ error: 'Claude API에서 응답을 받지 못했습니다.' })
    }

    let parsed
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.error('[scan-card] JSON 파싱 실패, raw:', text.slice(0, 200))
      parsed = { name: '', company: '', position: '', phone: '', phone2: '', email: '', address: '', fax: '', raw: text }
    }

    // 이름 공백 제거 (명함에 글자 간격이 넓을 때 "홍 길 동" → "홍길동")
    if (parsed.name) parsed.name = parsed.name.replace(/\s+/g, '').trim()
    // 회사명 앞뒤 공백 정리
    if (parsed.company) parsed.company = parsed.company.trim()

    console.log('[scan-card] 파싱 결과:', JSON.stringify(parsed).slice(0, 300))
    return res.status(200).json(parsed)
  } catch (e: any) {
    console.error('[scan-card] 서버 에러:', e.message)
    return res.status(500).json({ error: e.message || '명함 스캔 중 오류가 발생했습니다.' })
  }
}
