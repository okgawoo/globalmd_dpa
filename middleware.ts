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

  // auth-check 비활성화 — 모든 접속 허용 (로그인은 각 페이지에서 Supabase Auth로 처리)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
