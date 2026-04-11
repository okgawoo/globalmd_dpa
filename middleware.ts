import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = 'admin@dpa.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // 모든 쿠키에서 Supabase 토큰 탐색
  let accessToken: string | undefined

  request.cookies.getAll().forEach(cookie => {
    if (!accessToken && (
      cookie.name.includes('auth-token') ||
      cookie.name === 'sb-access-token' ||
      cookie.name.startsWith('sb-')
    )) {
      // JSON 배열 형태일 수 있음 [access_token, ...]
      try {
        const parsed = JSON.parse(cookie.value)
        if (Array.isArray(parsed)) {
          accessToken = parsed[0]
        } else if (typeof parsed === 'object' && parsed.access_token) {
          accessToken = parsed.access_token
        } else {
          accessToken = cookie.value
        }
      } catch {
        accessToken = cookie.value
      }
    }
  })

  if (!accessToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    // JWT 페이로드에서 이메일 추출 (서명 검증 없이)
    const parts = accessToken.split('.')
    if (parts.length < 2) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(
      Buffer.from(base64 + '=='.slice((base64.length % 4) || 4), 'base64').toString()
    )

    const email = payload?.email

    if (!email || email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
