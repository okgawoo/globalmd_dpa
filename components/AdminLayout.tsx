import { ReactNode, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import { useAdmin } from '../lib/AdminContext'
import {
  LayoutDashboard, FileEdit, Users, Bell, Mail,
  BarChart2, TrendingUp, Settings, LogOut, Sun, Moon, CalendarDays, ShieldCheck,
  Headphones, X, PanelLeft, Megaphone, HelpCircle,
} from 'lucide-react'
import OnboardingTour from './OnboardingTour'
import { tourSteps } from '../lib/tourSteps'

const navItems = [
  { name: '대시보드', href: '/', icon: LayoutDashboard, tourId: 'tour-dashboard' },
  { name: '데이터 입력', href: '/input', icon: FileEdit, tourId: 'tour-input' },
  { name: '고객 관리', href: '/customers', icon: Users, tourId: 'tour-customers' },
  { name: '고객 리포트', href: '/report', icon: BarChart2, tourId: 'tour-report' },
  { name: '상담 일정', href: '/consultations', icon: CalendarDays, tourId: 'tour-consultations' },
  { name: '문자 발송', href: '/notifications', icon: Bell, tourId: 'tour-notifications' },
  { name: '뉴스레터', href: '/newsletter', icon: Mail, tourId: 'tour-newsletter' },
  { name: '캠페인 발송', href: '/campaign', icon: Megaphone, tourId: 'tour-campaign' },
  { name: '영업 관리', href: '/sales', icon: TrendingUp, tourId: 'tour-sales' },
]

const accountItems = [
  { name: '설정', href: '/settings', icon: Settings, tourId: 'tour-settings' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { confirm, ConfirmDialog } = useConfirm()
  const { isAdmin } = useAdmin()
  const [dark, setDark] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<{ email: string; initial: string } | null>(null)
  const [isNarrow, setIsNarrow] = useState<boolean | null>(null)
  const [showSidebarTooltip, setShowSidebarTooltip] = useState(false)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const [tourActive, setTourActive] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipLabel, setTooltipLabel] = useState('')
  useLayoutEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1100)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [announcement, setAnnouncement] = useState<{ id: string; title: string; body: string; url?: string } | null>(null)
  const mainColRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('admin_theme')
    if (saved === 'dark') {
      setDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
      document.body.style.background = '#1E1E1E'
      document.body.style.color = '#FFFFFF'
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      document.body.style.background = ''
      document.body.style.color = ''
    }
    // 투어 미완료 사용자에게 자동 시작
    if (!localStorage.getItem('tour_done')) {
      setTimeout(() => setTourActive(true), 600)
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
        const ann = data || {
          id: 'test-preview-001',
          title: '신규 기능 업데이트',
          body: 'AI 보장 분석이 더욱 정확해졌어요. 지금 확인해보세요!',
          url: '/input',
        }
        const dismissed = sessionStorage.getItem('announcement_dismissed')
        if (dismissed !== ann.id) setAnnouncement(ann)
      })
  }, [])

  useEffect(() => {
    function updateOffset() {
      const headerH = headerRef.current?.offsetHeight ?? 52
      mainColRef.current?.style.setProperty('--layout-offset', `${headerH}px`)
    }
    updateOffset()
    const ro = new ResizeObserver(updateOffset)
    if (headerRef.current) ro.observe(headerRef.current)
    return () => ro.disconnect()
  }, [])

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
    document.body.style.background = next ? '#1E1E1E' : ''
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
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 10,
    borderRadius: 6,
    padding: collapsed ? '8px 0' : '8px 12px',
    fontSize: 14,
    fontWeight: isActive ? 510 : 400,
    textDecoration: 'none',
    transition: 'all 0.1s',
    ...(isActive
      ? { background: '#ECEDF8', color: '#5E6AD2', border: '1px solid rgba(94,106,210,0.2)' }
      : { color: 'rgba(26,26,46,0.82)', border: '1px solid transparent' }
    ),
  })

  const showNavTooltip = (e: React.MouseEvent, label: string, key: string) => {
    if (!collapsed) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.right + 10, y: rect.top + rect.height / 2 })
    setTooltipLabel(label)
    setHoveredNav(key)
  }
  const hideNavTooltip = () => setHoveredNav(null)

  return (
    <div className={dark ? 'admin-dark' : ''} style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
      {ConfirmDialog}

      {/* ── 온보딩 투어 ── */}
      {tourActive && (
        <OnboardingTour
          steps={tourSteps}
          onComplete={() => {
            setTourActive(false)
            localStorage.setItem('tour_done', '1')
          }}
          onSkip={() => {
            setTourActive(false)
            localStorage.setItem('tour_done', '1')
          }}
        />
      )}

      {/* ── 사이드바 접힘 메뉴 툴팁 (fixed — overflow:hidden 우회) ── */}
      {collapsed && hoveredNav && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translateY(-50%)',
          background: '#18181B',
          color: '#F5F5F5',
          fontSize: 12,
          fontWeight: 500,
          padding: '5px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
          letterSpacing: '0.01em',
        }}>
          {tooltipLabel}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 40,
          display: 'flex',
          height: '100vh',
          width: collapsed ? 60 : 240,
          flexDirection: 'column',
          background: 'var(--admin-sidebar-bg)',
          borderRight: '1px solid var(--admin-border)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo + 접기 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: '16px 12px', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/iplanner-logo.png" alt="아이플래너" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'cover', display: 'block' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(26,26,46,0.82)', letterSpacing: '-0.4px', lineHeight: 1, whiteSpace: 'nowrap' }}>아이플래너</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#5E6AD2', border: '1px solid #5E6AD2', borderRadius: 999, padding: '1px 5px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>DEMO</span>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setCollapsed(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(26,26,46,0.82)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-hover)'; setShowSidebarTooltip(true) }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setShowSidebarTooltip(false) }}
            >
              <svg
                width="17" height="14" viewBox="0 0 19 16" fill="none"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 0.2s ease', transform: collapsed ? 'scaleX(-1)' : 'scaleX(1)' }}
              >
                <rect x="1" y="1" width="17" height="14" rx="2" />
                <line x1="7" y1="1" x2="7" y2="15" />
              </svg>
            </button>
            {showSidebarTooltip && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 7,
                background: '#18181B',
                color: '#F5F5F5',
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 200,
                boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
                letterSpacing: '0.01em',
              }}>
                {collapsed ? '펼치기' : '접기'}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--admin-border)', margin: '0 12px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
            {navItems.map((item) => {
              const isActive = router.pathname === item.href
              return (
                <li key={item.href}
                  onMouseEnter={(e) => showNavTooltip(e, item.name, item.href)}
                  onMouseLeave={hideNavTooltip}
                >
                  <Link
                    id={item.tourId}
                    href={item.href}
                    style={navLinkStyle(isActive)}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--admin-hover)'
                        e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                        e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : '#C0C7D1'
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
                    {!collapsed && <span style={{ fontWeight: isActive ? 510 : 400, whiteSpace: 'nowrap' }}>{item.name}</span>}
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
                  <li key={item.href}
                    onMouseEnter={(e) => showNavTooltip(e, item.name, item.href)}
                    onMouseLeave={hideNavTooltip}
                  >
                    <Link
                      id={item.tourId}
                      href={item.href}
                      style={navLinkStyle(isActive)}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--admin-hover)'
                          e.currentTarget.style.color = 'rgba(26,26,46,0.82)'
                          e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : '#C0C7D1'
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
                      {!collapsed && <span>{item.name}</span>}
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
          {userInfo && !collapsed && (
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

          {isAdmin && (
            <div
              onMouseEnter={(e) => showNavTooltip(e, '관리자 페이지', '__admin')}
              onMouseLeave={hideNavTooltip}
            >
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
                    e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : '#C0C7D1'
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
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>관리자 페이지</span>}
              </Link>
            </div>
          )}

          <div
            onMouseEnter={(e) => showNavTooltip(e, '로그아웃', '__logout')}
            onMouseLeave={hideNavTooltip}
          >
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                borderRadius: 6,
                padding: collapsed ? '8px 0' : '10px 12px',
                fontSize: 14,
                color: 'rgba(26,26,46,0.82)',
                border: '1px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.1s',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
              {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>로그아웃</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div
        ref={mainColRef}
        style={{ marginLeft: collapsed ? 60 : 240, display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, transition: 'margin-left 0.2s ease' }}
      >
        {/* Header */}
        <header
          ref={headerRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 24px',
            boxShadow: dark ? 'none' : '0 4px 12px rgba(0,0,0,0.25)',
            borderBottom: dark ? '1px solid rgba(255,255,255,0.12)' : 'none',
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
              SMS <span style={{ color: '#5E6AD2', fontWeight: 600 }}>999</span>
              <span style={{ color: 'var(--admin-text-sub)' }}> / 1,000</span>
            </span>

            <div style={{ width: 1, height: 14, background: 'var(--admin-border)', margin: '0 4px' }} />

            <HeaderIconBtn
              onClick={() => setTourActive(true)}
              title="투어 다시 보기"
            >
              <HelpCircle style={{ width: 16, height: 16 }} />
            </HeaderIconBtn>

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

        {/* Announcement — 헤더 중앙 플로팅 pill (대시보드·관리자 페이지만 표시) */}
        {announcement && isNarrow !== null && (router.pathname === '/' || router.pathname === '/admin') && (
          <div
            style={{
              position: 'fixed',
              top: 62,
              left: '50%',
              transform: isNarrow
                ? `translateX(calc(-50% + 130px))`
                : `translateX(calc(-50% + 120px))`,
              zIndex: 50,
              background: '#5E6AD2',
              color: '#fff',
              borderRadius: 999,
              padding: '6px 8px 6px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(94,106,210,0.45)',
              maxWidth: isNarrow ? 600 : 'min(700px, calc(100vw - 340px))',
              whiteSpace: 'nowrap',
            }}
          >
            {/* 왼쪽 아이콘 뱃지 */}
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}>
              <span style={{ fontStyle: 'italic', fontWeight: 800 }}>i</span>
              아이플래너
            </div>

            {/* 텍스트 */}
            <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700 }}>{announcement.title}</span>
              {announcement.body && !isNarrow && (
                <span style={{ opacity: 0.75, marginLeft: 6 }}>— {announcement.body.slice(0, 40)}{announcement.body.length > 40 ? '…' : ''}</span>
              )}
            </span>

            {/* CTA 버튼 */}
            {(
              <button
                onClick={() => router.push(announcement.url || '/notifications')}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1.5px solid rgba(255,255,255,0.7)',
                  borderRadius: 999,
                  color: '#fff',
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                  transition: 'opacity 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              >
                확인 →
              </button>
            )}

            {/* 닫기 */}
            <button
              onClick={dismissAnnouncement}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 999,
                color: '#fff',
                cursor: 'pointer',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
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
              e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : '#C0C7D1'
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
