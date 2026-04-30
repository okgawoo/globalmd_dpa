import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function AuthPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        const next = (router.query.next as string) || '/'
        router.replace(next)
      } else {
        const data = await res.json()
        setError(data.error || '비밀번호가 틀렸어요')
        setPassword('')
      }
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.')
    }
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>아이플래너</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E2460 0%, #5E6AD2 60%, #818CF8 100%)',
        padding: 20,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: '40px 32px',
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}>
          {/* 로고 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #5E6AD2, #3F48B8)', boxShadow: '0 4px 16px rgba(94,106,210,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ color: '#fff', fontSize: 26, fontWeight: 800, fontStyle: 'italic', letterSpacing: '-1px', lineHeight: 1 }}>i</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>아이플래너</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>AI 보험 관리 자동화 플랫폼</div>
          </div>

          {/* 입력 */}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="비밀번호를 입력하세요"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px',
              border: `1.5px solid ${error ? '#FECACA' : '#E5E7EB'}`,
              borderRadius: 10,
              fontSize: 15,
              color: '#111827',
              background: '#F9FAFB',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: error ? 8 : 16,
              textAlign: 'center',
              letterSpacing: 4,
            }}
          />

          {error && (
            <div style={{
              fontSize: 13,
              color: '#B91C1C',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '13px 0',
              background: loading || !password ? '#D1D5DB' : 'linear-gradient(135deg, #1D9E75, #16875F)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              boxShadow: loading || !password ? 'none' : '0 4px 12px rgba(29,158,117,0.3)',
            }}
          >
            {loading ? '확인 중...' : '입장하기'}
          </button>
        </div>
      </div>
    </>
  )
}
