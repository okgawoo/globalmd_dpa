import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

const ADMIN_EMAIL = 'admin@dpa.com'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // /admin 경로 접근 시 admin 계정만 허용
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    // 로그인 안 됐거나 admin 이메일이 아니면 대시보드로 리다이렉트
    if (!session || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
