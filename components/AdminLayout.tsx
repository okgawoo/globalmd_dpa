import { ReactNode, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
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
    if (saved === 'dark') {
      setDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
      document.body.style.background = '#1A1A2E'
      document.body.style.color = '#FFFFFF'
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      document.body.style.background = ''
      document.body.style.color = ''
    }
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
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    document.body.style.background = next ? '#1A1A2E' : ''
    document.body.style.color = next ? '#FFFFFF' : ''
  }

  async function handleLogout() {
    const ok = await confirm({ title: '로그아웃', message: '로그아웃 할까요?', confirmText: '로그아웃' })
    if (!ok) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 14,
    fontWeight: isActive ? 510 : 400,
    textDecoration: 'none',
    transition: 'all 0.1s',
    ...(isActive
      ? { background: '#ECEDF8', color: '#5E6AD2', border: '1px solid rgba(94,106,210,0.2)' }
      : { color: 'rgba(26,26,46,0.82)', border: '1px solid transparent' }
    ),
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
      {ConfirmDialog}

      {/* ── Sidebar ── */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 40,
          display: 'flex',
          height: '100vh',
          width: 240,
          flexDirection: 'column',
          background: 'var(--admin-sidebar-bg)',
          borderRight: '1px solid var(--admin-border)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 16px' }}>
          <div
            style={{
              display: 'flex',
              height: 32,
              width: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              flexShrink: 0,
              background: 'linear-gradient(135deg, #5E6AD2, #3F48B8)',
              boxShadow: '0 2px 8px rgba(94,106,210,0.35)',
            }}
          >
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px', lineHeight: 1 }}>i</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(26,26,46,0.82)', letterSpacing: '-0.4px', lineHeight: 1 }}>아이플래너</span>
        </div>

        <div style={{ height: 1, background: 'var(--admin-border)', margin: '0 12px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
            {navItems.map((item) => {
              const isActive = router.pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    style={navLinkStyle(isActive)}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--admin-hover)'
                        e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                        e.currentTarget.style.borderColor = '#C0C7D1'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                        e.currentTarget.style.borderColor = 'transparent'
                      }
                    }}
                  >
                    <item.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontWeight: isActive ? 510 : 400 }}>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Account section */}
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 1, background: 'var(--admin-border)', margin: '0 12px 8px' }} />
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
              {accountItems.map((item) => {
                const isActive = router.pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      style={navLinkStyle(isActive)}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--admin-hover)'
                          e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                          e.currentTarget.style.borderColor = '#C0C7D1'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                          e.currentTarget.style.borderColor = 'transparent'
                        }
                      }}
                    >
                      <item.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom – user profile + admin + logout */}
        <div style={{ padding: 12 }}>
          <div style={{ height: 1, background: 'var(--admin-border)', marginBottom: 10 }} />

          {/* User profile card */}
          {userInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 8,
                background: 'var(--admin-hover)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  height: 28,
                  width: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #5E6AD2, #5855C8)',
                  color: '#fff',
                }}
              >
                {userInfo.initial}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text)', lineHeight: 1.4, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userInfo.email.split('@')[0]}
                </p>
                <p style={{ fontSize: 11, color: 'var(--admin-text-sub)', lineHeight: 1.4, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userInfo.email}
                </p>
              </div>
            </div>
          )}

          <Link
            href="/admin"
            style={{
              ...navLinkStyle(router.pathname === '/admin'),
              display: 'flex',
              marginBottom: 2,
            }}
            onMouseEnter={(e) => {
              if (router.pathname !== '/admin') {
                e.currentTarget.style.background = 'var(--admin-hover)'
                e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                e.currentTarget.style.borderColor = '#C0C7D1'
              }
            }}
            onMouseLeave={(e) => {
              if (router.pathname !== '/admin') {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                e.currentTarget.style.borderColor = 'transparent'
              }
            }}
          >
            <ShieldCheck style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>관리자 페이지</span>
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 10,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 14,
              color: 'rgba(26,26,46,0.82)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div
        ref={mainColRef}
        style={{ marginLeft: 240, display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}
      >
        {/* Header */}
        <header
          ref={headerRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 24px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            background: 'var(--admin-header-bg)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, fontStyle: 'italic', color: 'var(--admin-text-sub)', letterSpacing: '0.01em' }}>
            insurance planner
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5E6AD2', border: '1.5px solid #5E6AD2', borderRadius: 999, padding: '2px 10px', letterSpacing: '0.04em' }}>
              PRO
            </span>

            <span style={{ fontSize: 12, color: 'var(--admin-text-sub)' }}>
              SMS <span style={{ color: 'rgba(26,26,46,0.82)', fontWeight: 600 }}>999</span>
              <span style={{ color: 'var(--admin-text-sub)' }}> / 1,000</span>
            </span>

            <div style={{ width: 1, height: 14, background: 'var(--admin-border)', margin: '0 4px' }} />

            <HeaderIconBtn onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'}>
              {dark ? <Sun style={{ width: 16, height: 16 }} /> : <Moon style={{ width: 16, height: 16 }} />}
            </HeaderIconBtn>

            <HeaderIconBtn>
              <Bell style={{ width: 16, height: 16 }} />
            </HeaderIconBtn>

            <HeaderIconBtn onClick={() => router.push('/settings')}>
              <Settings style={{ width: 16, height: 16 }} />
            </HeaderIconBtn>

            <button
              style={{
                marginLeft: 4,
                display: 'flex',
                height: 28,
                width: 28,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: 12,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #5E6AD2, #5855C8)',
                color: '#fff',
                border: 'none',
                cursor: 'default',
              }}
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
              background: '#5E6AD2',
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
                <span style={{ opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  — {announcement.body.length > 60 ? announcement.body.slice(0, 60) + '…' : announcement.body}
                </span>
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
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', height: 0, background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
          {children}
        </main>
      </div>

      {/* ── Backdrop ── */}
      <div
        onClick={() => setSupportOpen(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(1px)',
          opacity: supportOpen ? 1 : 0,
          pointerEvents: supportOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* ── Support Panel ── */}
      <div
        style={{
          position: 'fixed',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          top: 16,
          right: 16,
          bottom: 96,
          width: 400,
          borderRadius: 20,
          background: 'var(--admin-support-bg)',
          border: '1px solid var(--admin-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.1)',
          transform: supportOpen ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 32px)) scale(0.96)',
          opacity: supportOpen ? 1 : 0,
          transition: 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease',
          pointerEvents: supportOpen ? 'auto' : 'none',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            flexShrink: 0,
            borderBottom: '1px solid var(--admin-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                height: 32,
                width: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #5E6AD2, #5855C8)',
                boxShadow: '0 2px 8px rgba(94,106,210,0.35)',
              }}
            >
              <Headphones style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(26,26,46,0.82)', margin: 0 }}>스마트 고객센터</p>
              <p style={{ fontSize: 12, color: 'var(--admin-text-sub)', margin: 0 }}>무엇이든 물어보세요</p>
            </div>
          </div>
          <button
            onClick={() => setSupportOpen(false)}
            style={{
              display: 'flex',
              height: 32,
              width: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              color: 'var(--admin-text-sub)',
              border: '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--admin-hover)'
              e.currentTarget.style.borderColor = '#C0C7D1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <iframe
          src="/support?embed=1"
          style={{ flex: 1, width: '100%', border: 'none' }}
          title="스마트 고객센터"
        />
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setSupportOpen(prev => !prev)}
        title="스마트 고객센터"
        style={{
          position: 'fixed',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          background: 'linear-gradient(135deg, #5E6AD2, #5855C8)',
          boxShadow: supportOpen
            ? '0 4px 12px rgba(0,0,0,0.18)'
            : '0 8px 28px rgba(94,106,210,0.5), 0 2px 8px rgba(0,0,0,0.12)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          transform: supportOpen ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        <div style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1)', transform: supportOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {supportOpen
            ? <X style={{ width: 20, height: 20, color: '#fff' }} />
            : <Headphones style={{ width: 20, height: 20, color: '#fff' }} />
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
      style={{
        display: 'flex',
        height: 32,
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        color: 'rgba(26,26,46,0.82)',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
