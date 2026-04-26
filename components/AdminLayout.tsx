import { ReactNode, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import {
  LayoutDashboard, FileEdit, Users, Bell, Mail,
  BarChart2, TrendingUp, Settings, LogOut, Sun, Moon, CalendarDays, ShieldCheck,
  Headphones, X,
} from 'lucide-react'

const navItems = [
  { name: '대시보드', href: '/', icon: LayoutDashboard },
  { name: '데이터 입력', href: '/input', icon: FileEdit },
  { name: '고객 관리', href: '/customers', icon: Users },
  { name: '상담 일정', href: '/consultations', icon: CalendarDays },
  { name: '문자 발송', href: '/notifications', icon: Bell },
  { name: '뉴스레터', href: '/newsletter', icon: Mail },
  { name: '미팅 리포트', href: '/report', icon: BarChart2 },
  { name: '영업 관리', href: '/sales', icon: TrendingUp },
]

const accountItems = [
  { name: '설정', href: '/settings', icon: Settings },
]

const pageLabels: Record<string, string> = {
  '/': '대시보드',
  '/input': '데이터 입력',
  '/customers': '고객 관리',
  '/notifications': '문자 발송',
  '/newsletter': '뉴스레터',
  '/report': '미팅 리포트',
  '/consultations': '상담 일정',
  '/sales': '영업 관리',
  '/settings': '설정',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const [dark, setDark] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<{ email: string; initial: string } | null>(null)
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; body: string; url?: string } | null>(null)
  const mainColRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const announcementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('admin_theme')
    if (saved === 'dark') setDark(true)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email ?? ''
        const name = data.user.user_metadata?.full_name ?? email
        const initial = name.charAt(0).toUpperCase()
        setUserInfo({ email, initial })
      }
    })
  }, [])

  useEffect(() => {
    supabase
      .from('push_notifications')
      .select('id, title, body, url')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const dismissed = sessionStorage.getItem('announcement_dismissed')
          if (dismissed !== data.id) setAnnouncement(data)
        }
      })
  }, [])

  // Keep --layout-offset in sync with actual header + announcement height
  useEffect(() => {
    function updateOffset() {
      const headerH = headerRef.current?.offsetHeight ?? 28
      const annoH = announcementRef.current?.offsetHeight ?? 0
      mainColRef.current?.style.setProperty('--layout-offset', `${headerH + annoH}px`)
    }
    updateOffset()
    const ro = new ResizeObserver(updateOffset)
    if (headerRef.current) ro.observe(headerRef.current)
    if (announcementRef.current) ro.observe(announcementRef.current)
    return () => ro.disconnect()
  }, [announcement])

  function dismissAnnouncement() {
    if (announcement) {
      sessionStorage.setItem('announcement_dismissed', announcement.id)
      setAnnouncement(null)
    }
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('admin_theme', next ? 'dark' : 'light')
  }

  async function handleLogout() {
    const ok = await confirm({ title: '로그아웃', message: '로그아웃 할까요?', confirmText: '로그아웃' })
    if (!ok) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className={cn('admin-root flex min-h-screen', dark ? 'admin-dark' : '')}
      style={{ background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary) / 0.82)' }}
    >
      {ConfirmDialog}

      {/* ── Sidebar ── */}
      <aside
        className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col"
        style={{
          background: 'hsl(var(--bg-panel))',
          borderRight: '1px solid hsl(var(--border-default))',
          boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(237 70% 50%))',
              boxShadow: '0 2px 8px hsl(var(--accent) / 0.35)',
            }}
          >
            <span style={{ color: '#fff', fontSize: '15px', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px', lineHeight: 1 }}>i</span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'hsl(var(--text-primary) / 0.82)', letterSpacing: '-0.4px', lineHeight: 1 }}>아이플래너</span>
        </div>

        <div style={{ height: 1, background: 'hsl(var(--border-default))', margin: '0 12px' }} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = router.pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100', isActive ? 'font-medium' : 'font-normal')}
                    style={
                      isActive
                        ? { background: 'hsl(var(--icon-bg))', color: 'hsl(var(--icon-fg))', border: '1px solid hsl(var(--accent) / 0.2)' }
                        : { color: 'hsl(var(--text-primary) / 0.82)', border: '1px solid transparent' }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                        e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                        e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                        e.currentTarget.style.borderColor = 'transparent'
                      }
                    }}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span style={{ fontWeight: isActive ? 510 : 400 }}>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Account section */}
          <div className="mt-4">
            <div style={{ height: 1, background: 'hsl(var(--border-default))', margin: '0 12px 8px' }} />
            <ul className="space-y-0.5">
              {accountItems.map((item) => {
                const isActive = router.pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100"
                      style={
                        isActive
                          ? { background: 'hsl(var(--icon-bg))', color: 'hsl(var(--icon-fg))', border: '1px solid hsl(var(--accent) / 0.2)' }
                          : { color: 'hsl(var(--text-primary) / 0.82)', border: '1px solid transparent' }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                          e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                          e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                          e.currentTarget.style.borderColor = 'transparent'
                        }
                      }}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom – user profile + admin + logout */}
        <div className="p-3">
          <div style={{ height: 1, background: 'hsl(var(--border-default))', marginBottom: 10 }} />

          {/* User profile card */}
          {userInfo && (
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-2"
              style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))' }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(245 70% 58%))', color: '#fff' }}
              >
                {userInfo.initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--text-primary) / 0.82)', lineHeight: 1.4 }}>
                  {userInfo.email.split('@')[0]}
                </p>
                <p className="truncate" style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))', lineHeight: 1.4 }}>
                  {userInfo.email}
                </p>
              </div>
            </div>
          )}

          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100 mb-0.5"
            style={
              router.pathname === '/admin'
                ? { background: 'hsl(var(--icon-bg))', color: 'hsl(var(--icon-fg))', border: '1px solid hsl(var(--accent) / 0.2)' }
                : { color: 'hsl(var(--text-primary) / 0.82)', border: '1px solid transparent' }
            }
            onMouseEnter={(e) => {
              if (router.pathname !== '/admin') {
                e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
              }
            }}
            onMouseLeave={(e) => {
              if (router.pathname !== '/admin') {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'hsl(var(--text-primary) / 0.82)'
                e.currentTarget.style.borderColor = 'transparent'
              }
            }}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>관리자 페이지</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100"
            style={{ color: 'hsl(var(--text-primary) / 0.82)', border: 'none', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div ref={mainColRef} className="ml-60 flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header ref={headerRef} className="flex items-center justify-between px-6 py-1.5" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, fontStyle: 'italic', color: 'hsl(var(--text-secondary))', letterSpacing: '0.01em' }}>
            insurance planner
          </span>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--accent))', border: '1.5px solid hsl(var(--accent))', borderRadius: '999px', padding: '2px 10px', letterSpacing: '0.04em' }}>
              PRO
            </span>

            <span className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>
              SMS <span style={{ color: 'hsl(var(--text-primary) / 0.82)', fontWeight: 600 }}>999</span>
              <span style={{ color: 'hsl(var(--text-tertiary))' }}> / 1,000</span>
            </span>

            <div style={{ width: 1, height: 14, background: 'hsl(var(--border-default))', margin: '0 4px' }} />

            <HeaderIconBtn onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </HeaderIconBtn>

            <HeaderIconBtn>
              <Bell className="h-4 w-4" />
            </HeaderIconBtn>

            <HeaderIconBtn onClick={() => router.push('/settings')}>
              <Settings className="h-4 w-4" />
            </HeaderIconBtn>

            <button
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(245 70% 58%))', color: '#fff' }}
            >
              {userInfo?.initial ?? 'A'}
            </button>
          </div>
        </header>

        {/* Announcement Bar */}
        {announcement && (
          <div
            ref={announcementRef}
            onClick={announcement.url ? () => router.push(announcement.url!) : undefined}
            style={{
              background: 'hsl(var(--accent))',
              color: '#fff',
              padding: '9px 48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.5,
              position: 'relative',
              flexShrink: 0,
              cursor: announcement.url ? 'pointer' : 'default',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, maxWidth: 'calc(100% - 60px)' }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{announcement.title}</span>
              {announcement.body && (
                <span style={{ opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis' }}>— {announcement.body.length > 60 ? announcement.body.slice(0, 60) + '…' : announcement.body}</span>
              )}
            </span>
            <button
              onClick={dismissAnnouncement}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ height: 0 }}>
          {children}
        </main>
      </div>

      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(1px)',
          opacity: supportOpen ? 1 : 0,
          pointerEvents: supportOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
        onClick={() => setSupportOpen(false)}
      />

      {/* ── Support Panel — Apple floating card ── */}
      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          top: 16,
          right: 16,
          bottom: 96,
          width: 400,
          borderRadius: 20,
          background: 'hsl(var(--bg-panel))',
          border: '1px solid hsl(var(--border-default))',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.1)',
          transform: supportOpen ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 32px)) scale(0.96)',
          opacity: supportOpen ? 1 : 0,
          transition: 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease',
          pointerEvents: supportOpen ? 'auto' : 'none',
        }}
      >
        {/* Panel Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(var(--border-default))' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(245 70% 58%))',
                boxShadow: '0 2px 8px hsl(var(--accent) / 0.35)',
              }}
            >
              <Headphones className="h-4 w-4" style={{ color: '#fff' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary) / 0.82)' }}>스마트 고객센터</p>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>무엇이든 물어보세요</p>
            </div>
          </div>
          <button
            onClick={() => setSupportOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-all duration-100"
            style={{ color: 'hsl(var(--text-secondary))', border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
              e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <iframe
          src="/support?embed=1"
          className="flex-1 w-full border-none"
          title="스마트 고객센터"
        />
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setSupportOpen(prev => !prev)}
        className="fixed z-50 flex items-center justify-center rounded-full"
        style={{
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(245 72% 58%))',
          boxShadow: supportOpen
            ? '0 4px 12px rgba(0,0,0,0.18)'
            : '0 8px 28px hsl(var(--accent) / 0.5), 0 2px 8px rgba(0,0,0,0.12)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          transform: supportOpen ? 'scale(0.9)' : 'scale(1)',
        }}
        title="스마트 고객센터"
      >
        <div style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1)', transform: supportOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {supportOpen
            ? <X className="h-5 w-5" style={{ color: '#fff' }} />
            : <Headphones className="h-5 w-5" style={{ color: '#fff' }} />
          }
        </div>
      </button>
    </div>
  )
}

/* ── Header icon button helper ── */
function HeaderIconBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md transition-all duration-100"
      style={{ color: 'hsl(var(--text-primary) / 0.82)', border: 'none', background: 'transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
