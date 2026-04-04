import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import styles from '../styles/Login.module.css'

type Mode = 'login' | 'register'

const emptyRegForm = {
  name: '', email: '', password: '', password2: '',
  phone: '', kakao_id: '', address: '',
  agent_number: '', license_photo: null as File | null,
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [form, setForm] = useState(emptyRegForm)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin() {
    if (!loginEmail || !loginPw) return setError('이메일과 비밀번호를 입력해주세요.')
    setLoading(true); setError('')
    const { error: e } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPw })
    if (e) { setError('이메일 또는 비밀번호가 올바르지 않아요.'); setLoading(false); return }
    router.push('/')
  }

  async function handleRegister() {
    if (!form.name || !form.email || !form.password || !form.phone || !form.agent_number)
      return setError('필수 항목을 모두 입력해주세요. (*)')
    if (form.password !== form.password2) return setError('비밀번호가 일치하지 않아요.')
    if (form.password.length < 6) return setError('비밀번호는 6자 이상이어야 해요.')
    setLoading(true); setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

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
        user_id: data.user.id, name: form.name, email: form.email,
        phone: form.phone, kakao_id: form.kakao_id, address: form.address,
        agent_number: form.agent_number, license_photo_url,
        status: 'pending'
      })
    }
    setSuccess('회원가입 신청이 완료됐어요! 승인 후 로그인 가능해요 😊')
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
        <div className={styles.logo}>
          <span className={styles.logoText}>DPA</span>
          <span className={styles.logoSub}>보험 분석 자동화 시스템</span>
        </div>

        <div className={styles.tabs}>
          <button className={[styles.modeTab, mode === 'login' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>로그인</button>
          <button className={[styles.modeTab, mode === 'register' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('register'); setError(''); setSuccess('') }}>회원가입</button>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {success && <div className={styles.successMsg}>{success}</div>}

        {mode === 'login' ? (
          <div className={styles.form}>
            <div className={styles.field}>
              <label>이메일</label>
              <input type="email" placeholder="example@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
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
            <div className={styles.sectionLabel}>기본 정보</div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label>이름 *</label>
                <input placeholder="홍길동" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>휴대폰 *</label>
                <input placeholder="010-0000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className={styles.field}>
              <label>이메일 *</label>
              <input type="email" placeholder="example@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label>비밀번호 *</label>
                <input type="password" placeholder="6자 이상" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>비밀번호 확인 *</label>
                <input type="password" placeholder="다시 입력" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} />
              </div>
            </div>
            <div className={styles.field}>
              <label>주소</label>
              <input placeholder="부산시 해운대구..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>카카오톡 아이디 (선택)</label>
              <input placeholder="kakao_id" value={form.kakao_id} onChange={e => setForm({ ...form, kakao_id: e.target.value })} />
            </div>

            <div className={styles.sectionLabel}>설계사 인증</div>
            <div className={styles.field}>
              <label>설계사 등록번호 *</label>
              <input placeholder="보험설계사 등록번호 입력" value={form.agent_number} onChange={e => setForm({ ...form, agent_number: e.target.value })} />
              <span className={styles.fieldHint}>e-클린보험서비스에서 확인 가능해요</span>
            </div>

            <div className={styles.field}>
              <label>자격증 사진 촬영/업로드 (선택)</label>
              <label className={styles.photoLabel} htmlFor="license_photo">
                {preview ? (
                  <img src={preview} className={styles.photoPreview} alt="자격증 미리보기" />
                ) : (
                  <div className={styles.photoPlaceholder}>
                    <span className={styles.photoIcon}>📷</span>
                    <span className={styles.photoText}>e-클린보험 자격증 사진을 찍거나 업로드하세요</span>
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

        <div className={styles.footer}>made by okga</div>
      </div>
    </div>
  )
}
