import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 공개 접근 허용 경로
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/support',
  '/api/auth-check',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 경로 통과
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // /c/[agentId] 전자명함 공개 통과
  if (pathname.startsWith('/c/')) {
    return NextResponse.next()
  }

  // API 경로 통과 (인증 관련 제외 이미 처리)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 정적 파일 통과
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/manifest') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 쿠키 확인
  const bypassCookie = request.cookies.get('dpa_bypass')
  const secret = process.env.BYPASS_SECRET

  if (secret && bypassCookie?.value === secret) {
    return NextResponse.next()
  }

  // 쿠키 없으면 /auth 로 리다이렉트
  const authUrl = new URL('/auth', request.url)
  authUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(authUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
