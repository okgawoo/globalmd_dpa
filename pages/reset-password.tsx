import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import styles from '../styles/Login.module.css'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase recovery 세션 확인
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleReset() {
    if (!password || !password2) return setError('비밀번호를 입력해주세요.')
    if (password !== password2) return setError('비밀번호가 일치하지 않아요.')
    if (password.length < 6) return setError('비밀번호는 6자리 이상이어야 해요.')
    setLoading(true); setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('비밀번호 변경에 실패했어요. 링크가 만료됐을 수 있어요.')
      setLoading(false); return
    }
    setSuccess(true)
    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>

        {/* 로고 */}
        <div className={styles.logoArea}>
          <div className={styles.logoIconWrap}>
            <img src="/icons/icon-192x192.png" alt="아이플래너" style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }} />
          </div>
          <div className={styles.logoTextWrap}>
            <div className={styles.logoMain}>아이플래너</div>
            <div className={styles.logoSub}>비밀번호 재설정</div>
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{width:64, height:64, background:'#5E6AD2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#5E6AD2', marginBottom: 8 }}>비밀번호가 변경됐어요!</div>
            <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>잠시 후 메인 화면으로 이동해요 😊</div>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A2E', marginBottom: 8 }}>링크를 확인하는 중이에요...</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
              이메일의 버튼을 클릭해서 접근해 주세요.<br />
              링크가 만료됐다면 다시 요청해 주세요.
            </div>
            <button onClick={() => router.push('/login')}
              style={{ marginTop: 20, background: 'none', border: 'none', color: '#5E6AD2', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              로그인 페이지로 이동
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <div style={{ fontSize: 14, color: '#636B78', lineHeight: 1.7, marginBottom: 16, padding: '12px 14px', background: '#F7F8FA', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              새로 사용할 비밀번호를 입력해 주세요.
            </div>
            {error && <div className={styles.errorMsg}>{error}</div>}
            <div className={styles.field}>
              <label>새 비밀번호</label>
              <input type="password" placeholder="6자리 이상" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()} autoFocus />
            </div>
            <div className={styles.field}>
              <label>비밀번호 확인</label>
              <input type="password" placeholder="다시 입력" value={password2}
                onChange={e => setPassword2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()} />
            </div>
            <button className={styles.submitBtn} onClick={handleReset} disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        )}

        <div className={styles.footer}>회원정보 수정은 로그인 후 설정에서 가능해요</div>
      </div>
    </div>
  )
}
