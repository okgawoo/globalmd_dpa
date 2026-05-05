import '../styles/globals.css'
import '../styles/admin.css'
import type { AppProps } from 'next/app'
import Layout from '../components/Layout'
import AdminLayout from '../components/AdminLayout'
import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/pushSubscription'
import Head from 'next/head'
import { AdminProvider, useAdmin } from '../lib/AdminContext'

function LayoutWrapper({ children }: { children: ReactNode }) {
  const { loading } = useAdmin()
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    // 창 크기가 아니라 기기 타입으로 레이아웃 결정
    // 데스크톱 브라우저는 창 크기 상관없이 항상 AdminLayout 사용 (다크모드 유지)
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsDesktop(!isMobileDevice)
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--admin-bg, #F7F8FA)' }} />
  // 데스크톱 브라우저: AdminLayout (창 크기 무관)
  // 모바일 기기: 기존 녹색 Layout 유지 (별도 리뉴얼 예정)
  if (isDesktop) return <AdminLayout>{children}</AdminLayout>
  return <Layout>{children}</Layout>
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [demoStatus, setDemoStatus] = useState<{ expired: boolean; daysLeft: number | null }>({ expired: false, daysLeft: null })

  // 비밀번호 재설정 모달 상태
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetPw, setResetPw] = useState('')
  const [resetPw2, setResetPw2] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  async function handlePasswordReset() {
    if (!resetPw || !resetPw2) return setResetError('새 비밀번호를 입력해주세요.')
    if (resetPw !== resetPw2) return setResetError('비밀번호가 일치하지 않아요.')
    if (resetPw.length < 6) return setResetError('비밀번호는 6자리 이상이어야 해요.')
    setResetLoading(true); setResetError('')
    const { error } = await supabase.auth.updateUser({ password: resetPw })
    if (error) { setResetError('변경에 실패했어요. 링크가 만료됐을 수 있어요.'); setResetLoading(false); return }
    setResetSuccess(true)
    setTimeout(() => { setResetModalOpen(false); setResetSuccess(false); setResetPw(''); setResetPw2('') }, 2000)
    setResetLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const isPublicPage = router.pathname.startsWith('/c/')
      if (!session && router.pathname !== '/login' && !isPublicPage) {
        router.replace('/login')
      } else if (session?.user) {
        supabase.from('dpa_agents')
          .select('id, plan_type, demo_expires_at, settings')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data: agent }) => {
            if (agent?.id) {
              subscribeToPush(agent.id)
              const plan = agent.settings?.plan || agent.plan_type || 'basic'
              if (plan === 'demo' && agent.demo_expires_at) {
                const expires = new Date(agent.demo_expires_at)
                const now = new Date()
                const daysLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                setDemoStatus(expires < now ? { expired: true, daysLeft: 0 } : { expired: false, daysLeft })
              }
            }
          })
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isPublicPage = router.pathname.startsWith('/c/')
      if (!session && router.pathname !== '/login' && !isPublicPage) {
        router.replace('/login')
      }
      // 이메일 비밀번호 재설정 링크 클릭 시 전체 차단 모달 표시
      if (event === 'PASSWORD_RECOVERY') {
        setResetModalOpen(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  const headMeta = (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#1D9E75" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="DPA" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    </>
  )

  if (router.pathname === '/login' || router.pathname.startsWith('/c/') || router.pathname === '/support') {
    return (
      <>
        <Head>{headMeta}</Head>
        <Component {...pageProps} />
      </>
    )
  }

  if (checking) return <div style={{ minHeight: '100vh', background: 'var(--admin-bg, #F7F8FA)' }} />

  if (demoStatus.expired) {
    return (
      <>
        <Head>{headMeta}</Head>
        <div style={{ minHeight: '100vh', background: '#FAF9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>무료 체험이 종료됐어요</div>
            <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              7일 무료 체험 기간이 끝났어요.<br />
              계속 사용하시려면 요금제를 선택해주세요!
            </div>
            <div style={{ background: '#F0FDF4', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75', marginBottom: 8 }}>🥉 베이직 — 고객 100명</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#378ADD', marginBottom: 8 }}>🥈 스탠다드 — 고객 300명 + SMS</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>🥇 프로 — 무제한 + 전체 기능</div>
            </div>
            <a href="https://open.kakao.com/o/sDPA" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', width: '100%', padding: '14px 0', borderRadius: 10, background: '#1D9E75', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none', marginBottom: 10 }}>
              요금제 문의하기
            </a>
            <button onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
              style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: 'none', border: '1px solid #E5E7EB', color: '#6B7280', fontSize: 14, cursor: 'pointer' }}>
              로그아웃
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>{headMeta}</Head>
      {demoStatus.daysLeft !== null && demoStatus.daysLeft <= 3 && (
        <div style={{ background: '#FEF9E7', borderBottom: '1px solid #F5C518', padding: '8px 16px', textAlign: 'center', fontSize: 13, color: '#B7791F', fontWeight: 600 }}>
          ⚠️ 무료 체험 {demoStatus.daysLeft === 0 ? '오늘 만료' : `D-${demoStatus.daysLeft}`} — 계속 사용하려면 요금제를 선택해주세요
        </div>
      )}
      <AdminProvider>
        <LayoutWrapper>
          <Component {...pageProps} />
        </LayoutWrapper>
      </AdminProvider>

      {/* 비밀번호 재설정 차단 모달 — 이메일 링크 클릭 시 전체 화면 오버레이 */}
      {resetModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,15,25,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 16, padding: '32px 28px',
            maxWidth: 400, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.25)'
          }}>
            {/* 로고 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <img src="/icons/icon-192x192.png" alt="아이플래너" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>비밀번호 재설정</div>
                <div style={{ fontSize: 12, color: '#8892A0' }}>새 비밀번호를 설정해 주세요</div>
              </div>
            </div>

            {resetSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 56, height: 56, background: '#5E6AD2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#5E6AD2', marginBottom: 6 }}>변경 완료!</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>새 비밀번호로 이용하실 수 있어요 😊</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#636B78', background: '#F7F8FA', borderRadius: 8, padding: '10px 14px', marginBottom: 20, border: '1px solid #E5E7EB', lineHeight: 1.6 }}>
                  비밀번호를 변경하기 전까지는 다른 페이지를 이용할 수 없어요.
                </div>
                {resetError && (
                  <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: '1px solid #FECACA' }}>
                    {resetError}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>새 비밀번호</label>
                  <input
                    type="password" placeholder="6자리 이상" value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordReset()}
                    autoFocus
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>비밀번호 확인</label>
                  <input
                    type="password" placeholder="다시 입력" value={resetPw2}
                    onChange={e => setResetPw2(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordReset()}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={handlePasswordReset} disabled={resetLoading}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, background: '#5E6AD2', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: resetLoading ? 'not-allowed' : 'pointer', opacity: resetLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
                  {resetLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
