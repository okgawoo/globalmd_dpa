import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import styles from '../styles/Login.module.css'

type Mode = 'login' | 'register' | 'forgot'

const emptyRegForm = {
  username: '', password: '', password2: '',
  name: '', phone: '', kakao_id: '', address: '',
  agent_number: '', license_photo: null as File | null,
  telecom: '', resident_front: '', resident_back1: '', plan_type: 'demo', personal_email: '',
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
  const [planOpen, setPlanOpen] = useState(false)
  const [forgotId, setForgotId] = useState('')

  async function handleLogin() {
    if (!loginId || !loginPw) return setError('아이디와 비밀번호를 입력해주세요.')
    setLoading(true); setError('')
    // 아이디(slug)로 실제 이메일 조회
    const { data: agentRow } = await supabase
      .from('dpa_agents')
      .select('email, status')
      .eq('slug', loginId.trim())
      .single()
    if (!agentRow) { setError('아이디 또는 비밀번호가 올바르지 않아요.'); setLoading(false); return }
    if (agentRow.status === 'pending') {
      setError('관리자 승인 대기 중이에요. 승인 후 로그인 가능해요 😊')
      setLoading(false); return
    }
    const { error: e } = await supabase.auth.signInWithPassword({ email: agentRow.email, password: loginPw })
    if (e) { setError('아이디 또는 비밀번호가 올바르지 않아요.'); setLoading(false); return }
    router.push('/')
  }

  async function handleRegister() {
    if (!form.username || !form.password || !form.name || !form.phone || !form.resident_front || !form.resident_back1 || !form.personal_email)
      return setError('필수 항목을 모두 입력해주세요. (*)')
    if (form.password !== form.password2) return setError('비밀번호가 일치하지 않아요.')
    if (form.password.length < 6) return setError('비밀번호는 6자리 이상이어야 합니다.')
    setLoading(true); setError('')

    const email = form.personal_email   // 실제 이메일을 auth 이메일로 사용
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
        user_id: data.user.id, name: form.name,
        email: form.personal_email,        // auth 이메일 = 실제 이메일
        personal_email: form.personal_email,
        phone: form.phone, kakao_id: form.kakao_id, address: form.address,
        agent_number: form.agent_number, license_photo_url, status: 'pending',
        plan_type: form.plan_type,
        telecom: form.telecom || null,
        resident_prefix: form.resident_front + form.resident_back1 || null,
        slug: form.username,
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

  async function handleForgot() {
    if (!forgotId.trim()) return setError('아이디를 입력해주세요.')
    setLoading(true); setError('')
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: forgotId.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || '요청에 실패했어요. 잠시 후 다시 시도해주세요.')
      setLoading(false); return
    }
    setSuccess(`재설정 링크를 발송했어요!\n${data.email}으로 발송된 이메일을 확인해 주세요 😊\n링크는 1시간 동안 유효해요.`)
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
            <img src="/icons/icon-192x192.png" alt="아이플래너" style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }} />
          </div>
          <div className={styles.logoTextWrap}>
            <div className={styles.logoMain}>
              아이플래너 <span className={styles.logoVersion}>DEMO</span>
            </div>
            <div className={styles.logoSub}>AI 보험 관리 자동화 플랫폼</div>
          </div>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          <button className={[styles.modeTab, mode === 'login' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>로그인</button>
          <button className={[styles.modeTab, mode === 'register' ? styles.activeMode : ''].join(' ')} onClick={() => { setMode('register'); setError(''); setSuccess('') }}>회원가입</button>
        </div>
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccess(''); setForgotId('') }}
            style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:'#8892A0', fontSize:13, cursor:'pointer', padding:'4px 0 0', fontFamily:'inherit' }}>
            ← 로그인으로 돌아가기
          </button>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}

        {success ? (
          <div style={{textAlign:'center', padding:'32px 16px'}}>
            <div style={{width:64, height:64, background:'#5E6AD2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{fontSize:20, fontWeight:700, color:'#5E6AD2', marginBottom:8}}>
              {mode === 'forgot' ? '요청이 완료됐어요!' : '가입 신청이 완료됐어요!'}
            </div>
            <div style={{fontSize:14, color:'#6B7280', lineHeight:1.7, whiteSpace:'pre-line'}}>{
              mode === 'forgot' ? success : '승인까지 잠시만 기다려주세요\n승인 완료 후 로그인 가능해요 😊'
            }</div>
            <button className={styles.submitBtn} style={{marginTop:24}} onClick={() => { setSuccess(''); setMode('login'); setForm(emptyRegForm); setForgotId('') }}>로그인 화면으로</button>
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
            <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              style={{ background:'none', border:'none', color:'#8892A0', fontSize:13, cursor:'pointer', textAlign:'center', width:'100%', marginTop:4, padding:'4px 0', fontFamily:'inherit' }}>
              비밀번호를 잊으셨나요?
            </button>
          </div>
        ) : mode === 'forgot' ? (
          <div className={styles.form}>
            <div style={{fontSize:14, color:'#636B78', lineHeight:1.7, marginBottom:16, padding:'12px 14px', background:'#F7F8FA', borderRadius:8, border:'1px solid #E5E7EB'}}>
              가입 시 등록한 <strong>아이디</strong>를 입력하시면<br/>관리자가 임시 비밀번호를 이메일로 발송해 드려요.
            </div>
            <div className={styles.field}>
              <label>아이디</label>
              <input placeholder="가입 시 사용한 아이디 입력" value={forgotId} onChange={e => setForgotId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgot()} autoCapitalize="none" autoFocus />
            </div>
            <button className={styles.submitBtn} onClick={handleForgot} disabled={loading}>
              {loading ? '요청 중...' : '비밀번호 재설정 요청'}
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <div className={styles.sectionLabel}>계정 정보</div>
            <div className={styles.field}>
              <label>아이디 *</label>
              <input placeholder="사용할 아이디 입력 (영문/숫자)" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })} autoCapitalize="none" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.field}>
                <label>비밀번호 *</label>
                <input type="password" placeholder="6자리 이상" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>비밀번호 확인 *</label>
                <input type="password" placeholder="다시 입력" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} />
              </div>
            </div>

            <div className={styles.sectionLabel}>기본 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.field}>
                <label>이름 *</label>
                <input placeholder="홍길동" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>이메일 *</label>
                <input type="email" placeholder="example@email.com" value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} autoCapitalize="none" inputMode="email" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.field}>
                <label>휴대폰 *</label>
                <input placeholder="010-0000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} inputMode="numeric" />
              </div>
              <div className={styles.field}>
                <label>카카오톡 아이디 (선택)</label>
                <input placeholder="kakao_id" value={form.kakao_id} onChange={e => setForm({ ...form, kakao_id: e.target.value })} />
              </div>
            </div>
            <div className={styles.field}>
              <label>주소</label>
              <input placeholder="서울시 강남구..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className={styles.sectionLabel}>설계사 인증</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.field}>
                <label>주민번호 앞 7자리 *</label>
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <input placeholder="850101" value={form.resident_front} onChange={e => setForm({ ...form, resident_front: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" maxLength={6} style={{flex:1}} />
                  <span style={{fontSize:16, color:'#6B7280', fontWeight:600}}>-</span>
                  <input placeholder="1" value={form.resident_back1} onChange={e => setForm({ ...form, resident_back1: e.target.value.replace(/\D/g, '').slice(0, 1) })} inputMode="numeric" maxLength={1} style={{width:52}} />
                  <span style={{fontSize:13, color:'#9CA3AF'}}>●●●●●●</span>
                </div>
                <span className={styles.fieldHint}>문자발송 본인인증에 사용됩니다</span>
              </div>
              <div className={styles.field}>
                <label>설계사 등록번호 (선택)</label>
                <input placeholder="보험설계사 등록번호" value={form.agent_number} onChange={e => setForm({ ...form, agent_number: e.target.value })} />
                <span className={styles.fieldHint}>e-클린보험서비스에서 확인 가능해요</span>
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: 8 }}>
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

            {/* 요금제 선택 — 아코디언 (데모기간 비활성화) */}
            <div>
              <button type="button" onClick={() => setPlanOpen(v => !v)} disabled style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', background:'none', border:'none', padding:'6px 0',
                cursor:'default', borderTop:'1px solid #F3F4F6',
              }}>
                <span style={{fontSize:13,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.8px'}}>
                  요금제 선택
                </span>
                <span style={{fontSize:12,color:'#8892A0',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11,background:'#FEF3C7',color:'#92400E',padding:'2px 7px',borderRadius:999,fontWeight:600}}>데모기간 중 자동 적용</span>
                  <span style={{color:'#D1D5DB'}}>▼</span>
                </span>
              </button>
              {planOpen && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10, marginBottom:4}}>
                  {PLANS.map(p => {
                    const isDemo = p.value === 'demo'
                    const disabled = !isDemo
                    return (
                      <label key={p.value} onClick={() => !disabled && setForm({...form, plan_type: p.value})}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,
                          border:`2px solid ${form.plan_type===p.value?'#5E6AD2':'#E5E7EB'}`,
                          background:disabled?'#F3F4F6':form.plan_type===p.value?'#EEF2FF':'#fff',
                          cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1}}>
                        <input type="radio" name="plan" value={p.value} checked={form.plan_type===p.value}
                          onChange={() => !disabled && setForm({...form, plan_type: p.value})}
                          disabled={disabled} style={{accentColor:'#5E6AD2'}} />
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:form.plan_type===p.value?'#5E6AD2':'#111'}}>{p.label}</div>
                          <div style={{fontSize:11,color:'#6B7280'}}>{p.desc}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <button className={styles.submitBtn} onClick={handleRegister} disabled={loading}>
              {loading ? '신청 중...' : '회원가입 신청'}
            </button>
          </div>
        )}

        <div className={styles.footer}>회원정보 수정은 로그인 후 설정에서 가능해요</div>
      </div>
    </div>
  )
}
