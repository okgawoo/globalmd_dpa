import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { password } = req.body
  const secret = process.env.BYPASS_SECRET

  if (!secret) return res.status(500).json({ error: '서버 설정 오류' })

  if (password !== secret) {
    return res.status(401).json({ error: '비밀번호가 틀렸어요 🔐' })
  }

  // 쿠키 발급 — 90일 유지
  const cookie = serialize('dpa_bypass', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  })

  res.setHeader('Set-Cookie', cookie)
  return res.status(200).json({ ok: true })
}
