import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import styles from '../styles/Layout.module.css'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'

function HeaderDateBadge() {
  const [plan, setPlan] = useState('')
  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('dpa_agents').select('settings').eq('user_id', user.id).single()
          .then(({ data }) => { if (data) setPlan(data.settings?.plan || 'basic') })
      }
    })
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{dateStr}</span>
      {plan && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 6, letterSpacing: 0.5 }}>
          {plan.toUpperCase()}
        </span>
      )}
    </div>
  )
}

function NavIcon({ path, active, isDesktop }: { path: string; active: boolean; isDesktop: boolean }) {
  const c = active ? (isDesktop ? '#5E6AD2' : '#1D9E75') : '#9CA3AF'
  const s = { width: 18, height: 18 }
  if (path === '/') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  if (path === '/customers') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (path === '/input') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  if (path === '/analysis') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
  if (path === '/report') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  if (path === '/customer-report') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
  if (path === '/sales') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  if (path === '/notifications') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  if (path === '/newsletter') return <svg {...s} style={{transform:'translateY(-1px)'}} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  if (path === '/settings') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  return null
}

const menus = [
  { label: '대시보드', path: '/' },
  { label: '데이터 입력', path: '/input' },
  { label: '고객 관리', path: '/customers' },
  { label: '문자 발송', path: '/notifications' },
  { label: '뉴스레터', path: '/newsletter' },
  { label: '미팅 리포트', path: '/report' },
  { label: '영업 관리', path: '/sales', dividerAfter: true },
  { label: '설정', path: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || '')
        supabase.from('dpa_agents').select('role').eq('user_id', user.id).single()
          .then(({ data }) => { if (data) setUserRole(data.role || '') })
      }
    })
    try {
      if (localStorage.getItem('sidebarCollapsed') === '1') setSidebarCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    setSidebarCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebarCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  useEffect(() => {
    let startX = 0
    let startY = 0
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dy) > Math.abs(dx)) return
      // 좌→우 스와이프: 왼쪽 30px 안에서만 사이드바 열기
      if (dx > 60 && startX < 30) { setSidebarOpen(true); return }
      // 우→좌 스와이프: 사이드바 닫기만
      if (dx < -60 && sidebarOpen) { setSidebarOpen(false); return }
      // 페이지 이동 스와이프 완전 제거
    }
    document.addEventListener('touchstart', onStart)
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [router.pathname, sidebarOpen])
  const { confirm, ConfirmDialog } = useConfirm()

  async function handleLogout() {
    const ok = await confirm({ title: '로그아웃', message: '로그아웃 할까요?', confirmText: '로그아웃' })
    if (!ok) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 모바일 대시보드 페이지에서는 헤더 숨김
  const isDashboardMobile = router.pathname === '/'
  const isFullPage = router.pathname === '/support'

  return (
    <div className={styles.root}>
      {ConfirmDialog}
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      <aside className={[styles.sidebar, sidebarOpen ? styles.open : '', sidebarCollapsed ? styles.collapsed : ''].join(' ')}>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleCollapsed}
          aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={sidebarCollapsed ? '펼치기' : '접기'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed
              ? <polyline points="9 18 15 12 9 6" />
              : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>
        <div className={styles.sidebarHeader}>
          <a href="/" className={styles.sidebarLogo}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {isDesktop ? (
                  <img src="/icons/icon-192x192.png" alt="아이플래너" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{flexShrink:0}}>
                    <rect width="40" height="40" rx="12" fill="#1D9E75"/>
                    <path d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M20 30C17.5 30 15 28 15 25C15 22 17 20 20 20C23 20 25 22 25 25" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="20" cy="20" r="2" fill="white"/>
                  </svg>
                )}
                <span className={styles.logoText} style={{color:'var(--text-primary)',fontWeight:700,fontSize:isDesktop?22:26,lineHeight:1}}>{isDesktop ? '아이플래너' : 'DPA'}</span>
                <span className={styles.logoVersion} style={{color: isDesktop ? '#5E6AD2' : '#1D9E75', background: isDesktop ? '#EEF2FF' : '#E6F7F1', fontSize:11,alignSelf:'flex-end'}}>{isDesktop ? 'DEMO' : 'v2.0'}</span>
              </div>
              <span className={styles.logoSub} style={{display:'block',marginTop:4,color:'var(--text-secondary)',fontSize:13,lineHeight:1}}>AI 보험 관리 자동화 플랫폼</span>
            </div>
          </a>
        </div>
        <nav className={styles.nav}>
          {menus.map(m => (
            <div key={m.path}>
              <a
                href={m.path}
                className={[styles.navItem, router.pathname === m.path ? styles.active : ''].join(' ')}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.navIcon}><NavIcon path={m.path} active={router.pathname === m.path} isDesktop={isDesktop} /></span>
                <span className={styles.navLabel}>{m.label}</span>
              </a>
              {m.dividerAfter && <div className={styles.divider} />}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          {userRole === 'admin' && (
            <a href="/admin"
              onClick={() => setSidebarOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: router.pathname === '/admin' ? (isDesktop ? '#EEF2FF' : '#E1F5EE') : 'transparent', color: router.pathname === '/admin' ? (isDesktop ? '#5E6AD2' : '#1D9E75') : '#666', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span className={styles.logoutLabel}>관리자 페이지</span>
            </a>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className={styles.logoutLabel}>로그아웃</span>
          </button>
        </div>
      </aside>

      <div className={[styles.main, sidebarCollapsed ? styles.mainCollapsed : ''].join(' ')}>
        <header className={[styles.header, isDashboardMobile ? styles.headerHiddenMobile : ''].join(' ')} style={isFullPage ? {display: 'none'} : {background: isDesktop ? '#5E6AD2' : '#1D9E75'}}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{filter:'brightness(0) invert(1)'}}>
            <span /><span /><span />
          </button>
          <span className={styles.headerTitle} style={{color:'white'}}>
            {router.pathname === '/admin' ? '관리자 페이지' : (menus.find(m => m.path === router.pathname)?.label || (isDesktop ? '아이플래너' : 'DPA'))}
          </span>
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8, paddingRight:4}}>
            {router.pathname === '/' && (
              <HeaderDateBadge />
            )}
            {!isDashboardMobile && (
              <Link href="/" style={{padding:'4px 8px',color:'white',display:'flex',alignItems:'center'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </Link>
            )}
          </div>
        </header>

        <div className={isDashboardMobile ? styles.contentDashboard : styles.content}>
          {children}
        </div>

        {/* 고객센터 FAB 버튼 */}
        {router.pathname !== '/support' && (
          <a href="/support" style={{
            position: 'fixed',
            bottom: 96,
            right: 16,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: isDesktop ? '#5E6AD2' : '#1D9E75',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            boxShadow: isDesktop ? '0 4px 12px rgba(94,106,210,0.4)' : '0 4px 12px rgba(29,158,117,0.4)',
            zIndex: 99,
            textDecoration: 'none',
          }}>
            💬
          </a>
        )}
      </div>
    </div>
  )
}
