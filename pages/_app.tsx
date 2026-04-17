import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Layout from '../components/Layout'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/pushSubscription'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [demoStatus, setDemoStatus] = useState<{ expired: boolean; daysLeft: number | null }>({ expired: false, daysLeft: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && router.pathname !== '/login') {
        router.replace('/login')
      } else if (session?.user) {
        // 플랜/데모 만료 체크
        supabase.from('dpa_agents').select('id, plan_type, demo_expires_at, settings').eq('user_id', session.user.id).single()
          .then(({ data: agent }) => {
            if (agent?.id) {
              subscribeToPush(agent.id)
              const plan = agent.settings?.plan || agent.plan_type || 'basic'
              if (plan === 'demo' && agent.demo_expires_at) {
                const expires = new Date(agent.demo_expires_at)
                const now = new Date()
                const daysLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                if (expires < now) {
                  setDemoStatus({ expired: true, daysLeft: 0 })
                } else {
                  setDemoStatus({ expired: false, daysLeft })
                }
              }
            }
          })
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && router.pathname !== '/login') {
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (router.pathname === '/login') {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta name="theme-color" content="#1D9E75" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="DPA" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </Head>
        <Component {...pageProps} />
      </>
    )
  }

  if (checking) return null

  // 데모 만료 화면
  if (demoStatus.expired) {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta name="theme-color" content="#1D9E75" />
          <link rel="manifest" href="/manifest.json" />
        </Head>
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1D9E75" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DPA" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>
      {/* 데모 D-3, D-1 배너 */}
      {demoStatus.daysLeft !== null && demoStatus.daysLeft <= 3 && !demoStatus.expired && (
        <div style={{ background: '#FEF9E7', borderBottom: '1px solid #F5C518', padding: '8px 16px', textAlign: 'center', fontSize: 13, color: '#B7791F', fontWeight: 600 }}>
          ⚠️ 무료 체험 {demoStatus.daysLeft === 0 ? '오늘 만료' : `D-${demoStatus.daysLeft}`} — 계속 사용하려면 요금제를 선택해주세요
        </div>
      )}
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  )
}

  if (router.pathname === '/login') {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta name="theme-color" content="#1D9E75" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="DPA" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </Head>
        <Component {...pageProps} />
      </>
    )
  }

  if (checking) return null

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1D9E75" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DPA" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  )
}
