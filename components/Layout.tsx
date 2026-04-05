import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import styles from '../styles/Layout.module.css'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'

const menus = [
  { icon: '🏠', label: '대시보드', path: '/' },
  { icon: '👥', label: '고객 관리', path: '/customers' },
  { icon: '✏️', label: '데이터 입력', path: '/input' },
  { icon: '📊', label: '보장 분석', path: '/analysis' },
  { icon: '📈', label: '영업 성과 리포트', path: '/report', dividerAfter: true },
  { icon: '🔔', label: '알림', path: '/alerts' },
  { icon: '📰', label: '뉴스레터', path: '/newsletter' },
  { icon: '⚙️', label: '설정', path: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const pagePaths = ['/', '/customers', '/input', '/analysis', '/report', '/alerts', '/newsletter', '/settings']
    let startX = 0
    let startY = 0
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      // 세로 스와이프가 더 크면 무시
      if (Math.abs(dy) > Math.abs(dx)) return
      // 사이드바 열기 (왼쪽 끝 30px에서 오른쪽으로)
      if (dx > 60 && startX < 30) { setSidebarOpen(true); return }
      // 사이드바 닫기
      if (dx < -60 && sidebarOpen) { setSidebarOpen(false); return }
      // 페이지 전환 (스와이프 충분히 크고 사이드바 닫혀있을 때)
      if (Math.abs(dx) > 80 && !sidebarOpen) {
        const currentIdx = pagePaths.indexOf(router.pathname)
        if (currentIdx === -1) return
        if (dx < 0) {
          // 왼쪽 스와이프 → 다음 페이지 (순환)
          const nextIdx = (currentIdx + 1) % pagePaths.length
          router.push(pagePaths[nextIdx])
        } else {
          // 오른쪽 스와이프 → 이전 페이지 (순환)
          const prevIdx = (currentIdx - 1 + pagePaths.length) % pagePaths.length
          router.push(pagePaths[prevIdx])
        }
      }
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

  return (
    <div className={styles.root}>
      {ConfirmDialog}
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      <aside className={[styles.sidebar, sidebarOpen ? styles.open : ''].join(' ')}>
        <div className={styles.sidebarHeader}>
          <a href="/" className={styles.sidebarLogo}>
            <div>
              <div style={{display:'flex',alignItems:'flex-end',gap:10}}>
                <svg width="44" height="44" viewBox="0 0 40 40" fill="none" style={{flexShrink:0}}>
                  <rect width="40" height="40" rx="12" fill="#1D9E75"/>
                  <path d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M20 30C17.5 30 15 28 15 25C15 22 17 20 20 20C23 20 25 22 25 25" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="20" cy="20" r="2" fill="white"/>
                </svg>
                <div>
                  <div className={styles.logoMainRow}>
                    <span className={styles.logoText}>DPA</span>
                    <span className={styles.logoVersion}>v1.0</span>
                  </div>
                  <span className={styles.logoSub}>AI 보험 관리 자동화 플랫폼</span>
                </div>
              </div>
              <span className={styles.madeBy} style={{display:'block',marginTop:2,paddingLeft:54}}>made by okga</span>
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
                <span className={styles.navIcon}>{m.icon}</span>
                <span>{m.label}</span>
              </a>
              {m.dividerAfter && <div className={styles.divider} />}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            로그아웃
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span /><span /><span />
          </button>
          <Link href={menus.find(m => m.path === router.pathname)?.path || '/'} className={styles.headerTitle}>
            {menus.find(m => m.path === router.pathname)?.label || 'DPA'}
          </Link>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}
