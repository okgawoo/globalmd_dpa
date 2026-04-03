import { useState } from 'react'
import { useRouter } from 'next/router'
import styles from '../styles/Layout.module.css'

const menus = [
  { icon: '🏠', label: '대시보드', path: '/' },
  { icon: '👥', label: '고객 관리', path: '/customers' },
  { icon: '✏️', label: '데이터 입력', path: '/input' },
  { icon: '📊', label: '보장 분석', path: '/analysis' },
  { icon: '📰', label: '뉴스레터', path: '/newsletter' },
  { icon: '🔔', label: '알림', path: '/alerts' },
  { icon: '⚙️', label: '설정', path: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={styles.root}>
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      <aside className={[styles.sidebar, sidebarOpen ? styles.open : ''].join(' ')}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>
            <span className={styles.logoText}>DPA</span>
            <span className={styles.logoSub}>보험 분석 자동화</span>
          </div>
        </div>
        <nav className={styles.nav}>
          {menus.map(m => (
            <a
              key={m.path}
              href={m.path}
              className={[styles.navItem, router.pathname === m.path ? styles.active : ''].join(' ')}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>{m.icon}</span>
              <span>{m.label}</span>
            </a>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>made by okga</div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span /><span /><span />
          </button>
          <div className={styles.headerTitle}>
            {menus.find(m => m.path === router.pathname)?.label || 'DPA'}
          </div>
          <div className={styles.taglinePC}>승경아 타이핑 할 시간에 영업을 더 해~~</div>
        </header>
        <div className={styles.taglineMobile}>승경아 타이핑 할 시간에 영업을 더 해~~</div>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}
