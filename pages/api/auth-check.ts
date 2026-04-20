import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { password } = req.body
  const secret = process.env.BYPASS_SECRET

  if (!secret) return res.status(500).json({ error: '서버 설정 오류' })

  if (password !== secret) {
    return res.status(401).json({ error: '비밀번호가 틀렸어요 🔐' })
  }

  const maxAge = 60 * 60 * 24 * 90
  const cookieValue = `dpa_bypass=${secret}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`

  res.setHeader('Set-Cookie', cookieValue)
  return res.status(200).json({ ok: true })
}

