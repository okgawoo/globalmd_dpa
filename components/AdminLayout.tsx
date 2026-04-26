import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import {
  LayoutDashboard, FileEdit, Users, Bell, Mail,
  BarChart2, TrendingUp, Settings, LogOut, Sun, Moon, User, CalendarDays,
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
  const currentLabel = pageLabels[router.pathname] ?? 'iPlanner'
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin_theme')
    if (saved === 'dark') setDark(true)
  }, [])

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
      style={{ background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))' }}
    >
      {ConfirmDialog}

      {/* ── Sidebar ── */}
      <aside
        className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col"
        style={{
          background: 'hsl(var(--bg-panel))',
          borderRight: '1px solid hsl(var(--border-default))',
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
            <span style={{
              color: '#fff',
              fontSize: '15px',
              fontWeight: 800,
              fontStyle: 'italic',
              letterSpacing: '-0.5px',
              lineHeight: 1,
            }}>i</span>
          </div>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'hsl(var(--text-primary))',
            letterSpacing: '-0.4px',
            lineHeight: 1,
          }}>아이플래너</span>
        </div>

        {/* Divider */}
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
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100',
                      isActive
                        ? 'font-medium'
                        : 'font-normal'
                    )}
                    style={
                      isActive
                        ? {
                            background: 'hsl(var(--accent-bg))',
                            color: 'hsl(var(--accent))',
                            border: '1px solid hsl(var(--accent) / 0.2)',
                          }
                        : {
                            color: 'hsl(var(--text-secondary))',
                            border: '1px solid transparent',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                        e.currentTarget.style.color = 'hsl(var(--text-primary))'
                        e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                        e.currentTarget.style.borderColor = 'transparent'
                      }
                    }}
                  >
                    <item.icon className="h-[14px] w-[14px] flex-shrink-0" />
                    <span style={{ fontWeight: isActive ? 510 : 400 }}>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Account section */}
          <div className="mt-5">
            <p
              className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'hsl(var(--text-tertiary))' }}
            >
              계정
            </p>
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
                          ? {
                              background: 'hsl(var(--accent-bg))',
                              color: 'hsl(var(--accent))',
                              border: '1px solid hsl(var(--accent) / 0.2)',
                            }
                          : {
                              color: 'hsl(var(--text-secondary))',
                              border: '1px solid transparent',
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                          e.currentTarget.style.color = 'hsl(var(--text-primary))'
                          e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                          e.currentTarget.style.borderColor = 'transparent'
                        }
                      }}
                    >
                      <item.icon className="h-[14px] w-[14px] flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom – logout */}
        <div className="p-3">
          <div style={{ height: 1, background: 'hsl(var(--border-default))', marginBottom: 10 }} />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100"
            style={{ color: 'hsl(var(--text-secondary))', border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
              e.currentTarget.style.color = 'hsl(var(--text-primary))'
              e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'hsl(var(--text-secondary))'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <LogOut className="h-[14px] w-[14px] flex-shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="ml-60 flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-1.5"
        >
          {/* Brand descriptor */}
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'hsl(var(--text-secondary))',
            letterSpacing: '0.01em',
          }}>
            insurance planner
          </span>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs" style={{ color: 'hsl(var(--text-primary))' }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>

            {/* Theme toggle */}
            <HeaderIconBtn onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </HeaderIconBtn>

            <HeaderIconBtn>
              <Bell className="h-4 w-4" />
            </HeaderIconBtn>

            <HeaderIconBtn onClick={() => router.push('/settings')}>
              <Settings className="h-4 w-4" />
            </HeaderIconBtn>

            {/* Avatar */}
            <button
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-100"
              style={{
                background: 'hsl(var(--accent))',
                color: '#fff',
              }}
            >
              A
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
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
      style={{ color: 'hsl(var(--text-primary))', border: '1px solid transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
        e.currentTarget.style.color = 'hsl(var(--text-primary))'
        e.currentTarget.style.borderColor = 'hsl(var(--border-hover))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'hsl(var(--text-secondary))'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
