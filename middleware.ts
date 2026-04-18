import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = 'okgawoo@gmail.com'

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    // Supabase auth 쿠키에서 세션 확인
    const token = req.cookies.get('sb-tmticcyqbaotrvmoqftv-auth-token')?.value
      || req.cookies.get('supabase-auth-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    try {
      // JWT payload 디코딩 (검증 없이 이메일만 추출)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const email = payload?.email || ''

      if (email !== ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
