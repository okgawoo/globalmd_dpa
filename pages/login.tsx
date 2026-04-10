import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import styles from '../styles/Login.module.css'

type Mode = 'login' | 'register'

const emptyRegForm = {
  username: '', password: '', password2: '',
  name: '', phone: '', kakao_id: '', address: '',
  agent_number: '', license_photo: null as File | null,
}

function formatPhone(val: string): string {
  const num = val.replace(/\D/g, '').slice(0, 11)
  if (num.length <= 3) return num
  if (num.length <= 7) return `${num.slice(0,3)}-${num.slice(3)}`
  return `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [form, setForm] = useState(emptyRegForm)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin() {
    if (!loginId || !loginPw) return setError('아이디와 비밀번호를 입력해주세요.')
    setLoading(true); setError('')
    const email = `${loginId}@dpa.com`
    const { data: authData, error: e } = await supabase.auth.signInWithPassword({ email, password: loginPw })
    if (e) { setError('아이디 또는 비밀번호가 올바르지 않아요.'); setLoading(false); return }
    const { data: agent } = await supabase.from('dpa_agents').select('status').eq('user_id', authData.user!.id).single()
    if (agent && agent.status === 'pending') {
      await supabase.auth.signOut()
      setError('관리자 승인 대기 중이에요. 승인 후 로그인 가능해요 😊')
      setLoading(false); return
    }
    router.push('/')
  }

  async function handleRegister() {
    if (!form.username || !form.password || !form.name || !form.phone)
      return setError('필수 항목을 모두 입력해주세요. (*)')
    if (form.password !== form.password2) return setError('비밀번호가 일치하지 않아요.')
    if (form.password.length < 4) return setError('비밀번호는 4자 이상이어야 해요.')
    setLoading(true); setError('')

    const email = `${form.username}@dpa.com`
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password: form.password })
    if (signUpError) {
      setError(signUpError.message.includes('already') ? '이미 사용 중인 아이디예요.' : signUpError.message)
      setLoading(false); return
    }

    if (data.user) {
      let license_photo_url = null
      if (form.license_photo) {
        const ext = form.license_photo.name.split('.').pop()
        const path = `license/${data.user.id}.${ext}`
        await supabase.storage.from('agent-docs').upload(path, form.license_photo)
        const { data: urlData } = supabase.storage.from('agent-docs').getPublicUrl(path)
        license_photo_url = urlData?.publicUrl || null
      }
      await supabase.from('dpa_agents').insert({
        user_id: data.user.id, name: form.name, email,
        phone: form.phone, kakao_id: form.kakao_id, address: form.address,
        agent_number: form.agent_number, license_photo_url, status: 'pending'
      })
    }
    // 슬랙 알림 발송
    await fetch('/api/slack-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'signup',
        name: form.name,
        phone: form.phone,
        username: form.username,
        agent_number: form.agent_number || '미입력'
      })
    })
    setSuccess('회원가입 신청 완료! 관리자 승인 후 로그인 가능해요 😊')
    setLoading(false)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setForm({ ...form, license_photo: file })
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>

        {/* 로고 */}
        <div className={styles.logoArea}>
          <div className={styles.logoIconWrap}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="#1D9E75"/>
              <path d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M20 30C17.5 30 15 28 15 25C15 22 17 20 20 20C23 20 25 22 25 25" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="2" fill="white"/>
            </svg>
          </div>
          <div className={styles.logoTextWrap}>
            <div className={styles.logoMain}>
              DPA <span className={styles.logoVersion}>v1.0</span>
            </div>
            <div className={styles.logoSub}>AI 보험 관리 자동화 플랫폼</div>
          </div>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          <button className={[styles.modeTab, mode === 'login' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>로그인</button>
          <button className={[styles.modeTab, mode === 'register' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('register'); setError(''); setSuccess('') }}>회원가입</button>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {success && <div className={styles.successMsg}>{success}</div>}

        {mode === 'login' ? (
          <div className={styles.form}>
            <div className={styles.field}>
              <label>아이디</label>
              <input placeholder="아이디 입력" value={loginId} onChange={e => setLoginId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} autoCapitalize="none" />
            </div>
            <div className={styles.field}>
              <label>비밀번호</label>
              <input type="password" placeholder="비밀번호 입력" value={loginPw} onChange={e => setLoginPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button className={styles.submitBtn} onClick={handleLogin} disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <div className={styles.sectionLabel}>계정 정보</div>
            <div className={styles.field}>
              <label>아이디 *</label>
              <input placeholder="사용할 아이디 입력 (영문/숫자)" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })} autoCapitalize="none" />
            </div>
            <div className={styles.field}>
              <label>비밀번호 *</label>
              <input type="password" placeholder="4자 이상" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>비밀번호 확인 *</label>
              <input type="password" placeholder="다시 입력" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} />
            </div>

            <div className={styles.sectionLabel}>기본 정보</div>
            <div className={styles.field}>
              <label>이름 *</label>
              <input placeholder="홍길동" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>휴대폰 *</label>
              <input placeholder="010-0000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} inputMode="numeric" />
            </div>
            <div className={styles.field}>
              <label>주소</label>
              <input placeholder="서울시 강남구..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>카카오톡 아이디 (선택)</label>
              <input placeholder="kakao_id" value={form.kakao_id} onChange={e => setForm({ ...form, kakao_id: e.target.value })} />
            </div>

            <div className={styles.sectionLabel}>설계사 인증</div>
            <div className={styles.field}>
              <label>설계사 등록번호 (선택)</label>
              <input placeholder="보험설계사 등록번호" value={form.agent_number} onChange={e => setForm({ ...form, agent_number: e.target.value })} />
              <span className={styles.fieldHint}>e-클린보험서비스에서 확인 가능해요</span>
            </div>
            <div className={styles.field}>
              <label>자격증 사진 (선택)</label>
              <label className={styles.photoLabel} htmlFor="license_photo">
                {preview ? (
                  <img src={preview} className={styles.photoPreview} alt="자격증 미리보기" />
                ) : (
                  <div className={styles.photoPlaceholder}>
                    <span className={styles.photoIcon}>📷</span>
                    <span className={styles.photoText}>e-클린보험 자격증 사진 촬영 / 업로드</span>
                    <span className={styles.photoSub}>나중에 등록번호 자동 인증에 활용돼요</span>
                  </div>
                )}
              </label>
              <input id="license_photo" type="file" accept="image/*" capture="environment" className={styles.photoInput} onChange={handlePhotoChange} />
            </div>

            <div className={styles.agreeText}>
              * 회원가입 신청 후 관리자 승인이 완료되면 로그인 가능해요.
            </div>
            <button className={styles.submitBtn} onClick={handleRegister} disabled={loading}>
              {loading ? '신청 중...' : '회원가입 신청'}
            </button>
          </div>
        )}

        <div className={styles.footer}>made by okga · DPA v1.0</div>
      </div>
    </div>
  )
}
