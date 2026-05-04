import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, image } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt가 필요합니다' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' })

  try {
    // 메시지 content 구성 — 이미지 있으면 vision 모드
    const content: any[] = []

    if (image?.base64 && image?.mediaType) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.base64,
        },
      })
    }

    content.push({ type: 'text', text: prompt })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[api/claude] Anthropic 오류:', err)
      return res.status(500).json({ error: 'AI 응답 오류' })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    return res.status(200).json({ content: text })
  } catch (e) {
    console.error('[api/claude] 예외:', e)
    return res.status(500).json({ error: '서버 오류' })
  }
}
