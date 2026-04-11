import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'admin@dpa.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /admin 경로만 체크
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // 쿠키에서 세션 토큰 확인
  const accessToken = request.cookies.get('sb-access-token')?.value ||
    request.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`)?.value

  if (!accessToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user || user.email !== ADMIN_EMAIL) {
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
