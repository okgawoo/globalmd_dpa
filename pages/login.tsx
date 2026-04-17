import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import styles from '../styles/Login.module.css'

type Mode = 'login' | 'register'

const emptyRegForm = {
  username: '', password: '', password2: '',
  name: '', phone: '', kakao_id: '', address: '',
  agent_number: '', license_photo: null as File | null,
  telecom: '', resident_front: '', resident_back1: '', plan_type: 'demo',
}

const TELECOMS = ['SKT', 'KT', 'LGU+', '알뜰폰(SKT)', '알뜰폰(KT)', '알뜰폰(LGU+)']

const PLANS = [
  { value: 'demo', label: '🆓 7일 무료 체험', desc: '고객 5명, 기본 기능 체험' },
  { value: 'basic', label: '🥉 베이직 00원/월', desc: '고객 100명, SMS 없음' },
  { value: 'standard', label: '🥈 스탠다드 00원/월 ⭐', desc: '고객 300명, SMS 500건' },
  { value: 'pro', label: '🥇 프로 00원/월', desc: '고객 무제한, SMS 1,000건' },
]

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
    if (!form.username || !form.password || !form.name || !form.phone || !form.resident_front || !form.resident_back1)
      return setError('필수 항목을 모두 입력해주세요. (*)')
    if (form.password !== form.password2) return setError('비밀번호가 일치하지 않아요.')
    if (form.password.length < 6) return setError('비밀번호는 6자리 이상이어야 합니다.')
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
      // 데모 만료일 계산 (7일)
      const now = new Date()
      const demoExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      await supabase.from('dpa_agents').insert({
        user_id: data.user.id, name: form.name, email,
        phone: form.phone, kakao_id: form.kakao_id, address: form.address,
        agent_number: form.agent_number, license_photo_url, status: 'pending',
        plan_type: form.plan_type,
        telecom: form.telecom || null,
        resident_prefix: form.resident_front + form.resident_back1 || null,
        demo_started_at: form.plan_type === 'demo' ? now.toISOString() : null,
        demo_expires_at: form.plan_type === 'demo' ? demoExpires.toISOString() : null,
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
        agent_number: form.agent_number || '미입력',
        plan_type: form.plan_type,
        telecom: form.telecom || '미입력',
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

        {success ? (
          <div style={{textAlign:'center', padding:'32px 16px'}}>
            <div style={{fontSize:48, marginBottom:16}}>✅</div>
            <div style={{fontSize:20, fontWeight:700, color:'#1D9E75', marginBottom:8}}>가입 신청이 완료됐어요!</div>
            <div style={{fontSize:14, color:'#6B7280', lineHeight:1.6}}>승인까지 잠시만 기다려주세요<br/>승인 완료 후 로그인 가능해요 😊</div>
            <button className={styles.submitBtn} style={{marginTop:24}} onClick={() => { setSuccess(''); setMode('login'); setForm(emptyRegForm) }}>로그인 화면으로</button>
          </div>
        ) : mode === 'login' ? (
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
              <input type="password" placeholder="6자리 이상" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
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
              <label>주민번호 앞 7자리 *</label>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <input
                  placeholder="850101"
                  value={form.resident_front}
                  onChange={e => setForm({ ...form, resident_front: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  inputMode="numeric"
                  maxLength={6}
                  style={{flex:1}}
                />
                <span style={{fontSize:16, color:'#6B7280', fontWeight:600}}>-</span>
                <input
                  placeholder="1"
                  value={form.resident_back1}
                  onChange={e => setForm({ ...form, resident_back1: e.target.value.replace(/\D/g, '').slice(0, 1) })}
                  inputMode="numeric"
                  maxLength={1}
                  style={{width:52}}
                />
                <span style={{fontSize:13, color:'#9CA3AF'}}>●●●●●●</span>
              </div>
              <span className={styles.fieldHint}>솔라피 본인인증에 사용됩니다</span>
            </div>
            <div className={styles.field}>
              <label>통신사 (선택)</label>
              <select value={form.telecom} onChange={e => setForm({ ...form, telecom: e.target.value })} style={{width:'100%',fontSize:14,padding:'10px 12px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',color: form.telecom ? '#111' : '#9CA3AF'}}>
                <option value="">통신사 선택</option>
                {TELECOMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className={styles.fieldHint}>문자 발신번호 인증에 사용됩니다</span>
            </div>
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

            <div className={styles.sectionLabel}>요금제 선택</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {PLANS.map(p => (
                <label key={p.value} onClick={() => setForm({...form, plan_type: p.value})} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,border:`2px solid ${form.plan_type===p.value?'#1D9E75':'#E5E7EB'}`,background:form.plan_type===p.value?'#E8F8F2':'#fff',cursor:'pointer'}}>
                  <input type="radio" name="plan" value={p.value} checked={form.plan_type===p.value} onChange={() => setForm({...form, plan_type: p.value})} style={{accentColor:'#1D9E75'}} />
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:form.plan_type===p.value?'#1D9E75':'#111'}}>{p.label}</div>
                    <div style={{fontSize:11,color:'#6B7280'}}>{p.desc}</div>
                  </div>
                </label>
              ))}
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
