import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import styles from '../styles/Settings.module.css'

// 전화번호 하이픈 자동 포맷
function formatPhone(val: string): string {
  const num = val.replace(/\D/g, '').slice(0, 11)
  if (num.length <= 3) return num
  if (num.length <= 7) return `${num.slice(0,3)}-${num.slice(3)}`
  return `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
}

type SettingsTab = 'profile' | 'sms' | 'notification' | 'data'

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'profile', label: '내 정보', icon: '👤' },
  { key: 'sms', label: '문자 설정', icon: '📱' },
  { key: 'notification', label: '알림 설정', icon: '🔔' },
  { key: 'data', label: '데이터·해지', icon: '📦' },
]

const DEFAULT_NOTIFICATIONS = [
  { key: 'nearDone', label: '완납 임박', icon: '🔥', desc: '납입률 90% 이상 고객', locked: true },
  { key: 'gap', label: '보장 공백', icon: '⚠️', desc: '뇌혈관·간병 보장 없는 고객', locked: true },
  { key: 'birthday', label: '생일', icon: '🎂', desc: '생일 7일 이내 고객', locked: true },
  { key: 'expiry', label: '만기 임박', icon: '📋', desc: '보험 만기 30일 이내', locked: true },
]

const OPTIONAL_NOTIFICATIONS = [
  { key: 'longNoContact', label: '장기 미연락', icon: '📞', desc: '마지막 미팅 90일 이상' },
  { key: 'anniversary', label: '계약 기념일', icon: '🎉', desc: '1/3/5년 주기 7일 이내' },
  { key: 'wedding', label: '결혼기념일', icon: '💍', desc: '결혼기념일 7일 이내' },
]

const BIRTHDAY_OPTIONS = [
  { key: 'd30', label: 'D-30' },
  { key: 'd7', label: 'D-7' },
  { key: 'd1', label: 'D-1' },
  { key: 'd0', label: '당일' },
]

const TONE_OPTIONS = [
  { key: '정중', label: '정중' },
  { key: '친근', label: '친근' },
  { key: '애교', label: '애교' },
  { key: '간결', label: '간결' },
]

function TabIcon({ tabKey, active }: { tabKey: SettingsTab; active: boolean }) {
  const c = active ? '#5E6AD2' : '#8892A0'
  const s = { width: 15, height: 15, fill: 'none' as const, stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (tabKey === 'profile') return <svg {...s} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  if (tabKey === 'sms') return <svg {...s} viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  if (tabKey === 'notification') return <svg {...s} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  return <svg {...s} viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
}

export default function SettingsPage() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const [tab, setTab] = useState<SettingsTab>('profile')
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [smsUsage, setSmsUsage] = useState<any>(null)

  // 내 정보
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // 발신번호 등록
  const [senderPhone, setSenderPhone] = useState('')
  const [senderStatus, setSenderStatus] = useState<'none' | 'pending' | 'verified'>('none')
  const [registeringPhone, setRegisteringPhone] = useState(false)
  const [registerError, setRegisterError] = useState('')

  // 문자 인증 단계: 'intro' | 'form' | 'sign' | 'upload' | 'confirm' | 'done'
  const [smsAuthStep, setSmsAuthStep] = useState<'intro' | 'form' | 'sign' | 'upload' | 'confirm' | 'done'>('intro')
  const [telecomDocFile, setTelecomDocFile] = useState<File | null>(null)
  const [telecomDocUrl, setTelecomDocUrl] = useState('')
  const [telecomUploading, setTelecomUploading] = useState(false)
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [smsAuthSubmittedAt, setSmsAuthSubmittedAt] = useState('')
  const [telecomVerifyIssues, setTelecomVerifyIssues] = useState<string[]>([])
  const [telecomVerified, setTelecomVerified] = useState<boolean | null>(null)
  const [smsAgreed, setSmsAgreed] = useState(false)
  const [smsForm, setSmsForm] = useState({ birthDate: '', address: '', senderPhone: '', addressDetail: '' })
  const [signatureData, setSignatureData] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const canvasRef = { current: null as HTMLCanvasElement | null }

  // 알림 설정
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({
    longNoContact: false, anniversary: false, wedding: false,
  })
  const [birthdayAlerts, setBirthdayAlerts] = useState<Record<string, boolean>>({
    d30: false, d7: true, d1: true, d0: true,
  })

  // 문자 기본 톤
  const [defaultTone, setDefaultTone] = useState('친근')

  // SNS
  const [sns, setSns] = useState({ kakao: '', instagram: '', x: '', facebook: '' })
  const [fax, setFax] = useState('')
  const [title, setTitle] = useState('')       // 직함
  const [company, setCompany] = useState('')   // 소속

  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => { fetchAgent() }, [])

  async function fetchAgent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // user_id로 agents 조회
    const { data: ag } = await supabase.from('dpa_agents').select('*').eq('user_id', user.id).single()
    if (ag) {
      setAgent(ag)
      setEditEmail(ag.email || '')
      setEditPhone(ag.phone || '')
      setSenderPhone(ag.phone || '')

      // settings에서 복원
      const s = ag.settings || {}
      setDefaultTone(s.default_tone || '친근')
      if (s.sns) setSns(prev => ({ ...prev, ...s.sns }))
      setFax(s.fax || '')
      setTitle(s.title || '')
      setCompany(s.company || '')
      setSenderStatus(s.sender_verified ? 'verified' : 'none')

      if (s.notifications) {
        setNotifSettings(prev => ({ ...prev, ...s.notifications }))
      }
      if (s.birthday_alerts) {
        setBirthdayAlerts(prev => ({ ...prev, ...s.birthday_alerts }))
      }

      // 기존 발신번호 신청 여부 확인
      const { data: smsAuth } = await supabase
        .from('dpa_sms_auth')
        .select('status, sender_phone, submitted_at')
        .eq('agent_id', ag.id)
        .single()
      if (smsAuth) {
        if (smsAuth.status === 'approved') {
          setSenderStatus('verified')
          setSenderPhone(smsAuth.sender_phone || '')
          setSmsAuthSubmittedAt(smsAuth.submitted_at || '')
        } else if (smsAuth.status === 'pending') {
          setSmsAuthStep('done')
          setSenderStatus('pending')
        }
      }

      // SMS 사용량 조회
      try {
        const res = await fetch(`/api/sms/usage?agent_id=${user.id}`)
        if (res.ok) setSmsUsage(await res.json())
      } catch (e) {}
    }
    setLoading(false)
  }

  // 내 정보 저장
  async function saveProfile() {
    if (!agent) return
    setSavingProfile(true)
    await supabase.from('dpa_agents').update({
      email: editEmail,
      phone: editPhone,
      settings: { ...agent.settings, sns, fax, title, company },
    }).eq('id', agent.id)
    await fetchAgent()
    setSavingProfile(false)
    alert('저장되었습니다 😊')
  }

  // 발신번호 등록 (솔라피 API)
  async function registerSender() {
    if (!senderPhone.trim()) { setRegisterError('발신번호를 입력해주세요.'); return }
    setRegisteringPhone(true)
    setRegisterError('')
    try {
      const res = await fetch('/api/sms/register-sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: senderPhone, agent_id: agent.id }),
      })
      const result = await res.json()
      if (result.success) {
        setSenderStatus('pending')
        alert('ARS 인증 전화가 발신됩니다.\n전화를 받고 안내에 따라 인증해주세요! 📞')
      } else {
        setRegisterError(result.error || '등록에 실패했습니다.')
      }
    } catch (e) {
      setRegisterError('서버 오류가 발생했습니다.')
    }
    setRegisteringPhone(false)
  }

  // 알림 설정 저장
  async function saveNotifSettings() {
    if (!agent) return
    const newSettings = {
      ...agent.settings,
      notifications: notifSettings,
      birthday_alerts: birthdayAlerts,
    }
    await supabase.from('dpa_agents').update({ settings: newSettings }).eq('id', agent.id)
    alert('알림 설정이 저장되었습니다 😊')
  }

  // 문자 톤 저장
  async function saveTone(tone: string) {
    if (!agent) return
    setDefaultTone(tone)
    const newSettings = { ...agent.settings, default_tone: tone }
    await supabase.from('dpa_agents').update({ settings: newSettings }).eq('id', agent.id)
  }

  // 해지
  async function handleCancel() {
    const ok = await confirm({
      title: '서비스 해지',
      message: '정말 해지하시겠습니까?\n서버에 저장된 모든 데이터는 즉시 완전히 삭제되며 복구되지 않습니다.',
      confirmText: '해지하기',
    })
    if (!ok) return
    const ok2 = await confirm({
      title: '최종 확인',
      message: '되돌릴 수 없습니다. 정말 해지할까요?',
      confirmText: '네, 해지합니다',
    })
    if (!ok2) return
    alert('해지 처리가 시작되었습니다.')
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.page}>
      {ConfirmDialog}

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>설정</h1>
          <p className={styles.pageSub}>계정 및 서비스 설정</p>
        </div>
      </div>

      {/* 탭 + 콘텐츠 카드 */}
      <div className={styles.card}>

        {/* 탭 메뉴 */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[styles.tabBtn, tab === t.key ? styles.tabActive : ''].join(' ')}>
              <TabIcon tabKey={t.key} active={tab === t.key} />
              {t.label}
            </button>
          ))}
        </div>

      <div className={styles.content}>

        {/* ═══ 내 정보 ═══ */}
        {tab === 'profile' && (
          <div className={styles.section}>
            {/* 웹: 테이블 레이아웃 */}
            <div className={styles.profileTable}>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  이름
                </div>
                <div className={styles.profileValue}>
                  <span style={{ fontSize: 14, color: '#999' }}>{agent?.name || '-'}</span>
                  <button className={styles.btnOutline} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }}
                    onClick={() => alert('이름 변경은 고객센터로 문의해주세요.')}>
                    고객센터 문의
                  </button>
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  이메일
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={editEmail}
                    onChange={e => setEditEmail(e.target.value)} placeholder="이메일 주소" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  연락처
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={editPhone}
                    onChange={e => setEditPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13 17"/><polyline points="22 11 13 11"/><polyline points="22 5 13 5"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H11"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H11v13H6.5A2.5 2.5 0 0 1 4 17.5v-13z"/></svg>
                  팩스
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={fax}
                    onChange={e => setFax(e.target.value)} placeholder="02-0000-0000" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                  직함
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={title}
                    onChange={e => setTitle(e.target.value)} placeholder="예: 수석 컨설턴트" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  소속
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={company}
                    onChange={e => setCompany(e.target.value)} placeholder="예: 글로벌 파이낸셜" />
                </div>
              </div>
              <div className={styles.profileGroupLabel}>SNS 계정</div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.07 1.77 5.78 4.5 7.44L5.5 22l4.46-2.37c.66.1 1.35.17 2.04.17 5.52 0 10-3.92 10-8.8S17.52 2 12 2z"/></svg>
                  카카오톡
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={sns.kakao}
                    onChange={e => setSns(p => ({ ...p, kakao: e.target.value }))} placeholder="카카오톡 ID" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  인스타그램
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={sns.instagram}
                    onChange={e => setSns(p => ({ ...p, instagram: e.target.value }))} placeholder="@아이디" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={sns.x}
                    onChange={e => setSns(p => ({ ...p, x: e.target.value }))} placeholder="@아이디" />
                </div>
              </div>
              <div className={styles.profileRow}>
                <div className={styles.profileLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  페이스북
                </div>
                <div className={styles.profileValue}>
                  <input className={styles.profileInput} value={sns.facebook}
                    onChange={e => setSns(p => ({ ...p, facebook: e.target.value }))} placeholder="페이스북 ID" />
                </div>
              </div>
            </div>

            {/* 모바일: 기존 필드 레이아웃 */}
            <div className={styles.mobileOnly}>
              <h2 className={styles.sectionTitle}>내 정보</h2>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>이름</label>
                <div className={styles.fieldRow}>
                  <input className={styles.fieldInput} value={agent?.name || ''} disabled style={{ background: '#F5F5F5', color: '#999' }} />
                  <button className={styles.btnOutline} onClick={() => alert('이름 변경은 고객센터로 문의해주세요.')}>고객센터 문의</button>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>이메일</label>
                <input className={styles.fieldInput} value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="이메일 주소" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>연락처</label>
                <input className={styles.fieldInput} value={editPhone} onChange={e => setEditPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>팩스</label>
                <input className={styles.fieldInput} value={fax} onChange={e => setFax(e.target.value)} placeholder="02-0000-0000" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>직함</label>
                <input className={styles.fieldInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 수석 컨설턴트" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>소속</label>
                <input className={styles.fieldInput} value={company} onChange={e => setCompany(e.target.value)} placeholder="예: 글로벌 파이낸셜" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>카카오톡</label>
                <input className={styles.fieldInput} value={sns.kakao} onChange={e => setSns(p => ({ ...p, kakao: e.target.value }))} placeholder="카카오톡 ID" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>인스타그램</label>
                <input className={styles.fieldInput} value={sns.instagram} onChange={e => setSns(p => ({ ...p, instagram: e.target.value }))} placeholder="@아이디" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>X</label>
                <input className={styles.fieldInput} value={sns.x} onChange={e => setSns(p => ({ ...p, x: e.target.value }))} placeholder="@아이디" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>페이스북</label>
                <input className={styles.fieldInput} value={sns.facebook} onChange={e => setSns(p => ({ ...p, facebook: e.target.value }))} placeholder="페이스북 ID" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className={styles.btnPrimary} onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ 문자 설정 ═══ */}
        {tab === 'sms' && (
          <div className={styles.section}>

            {/* 발신번호 인증 영역 */}
            <h2 className={styles.sectionTitle}>문자 발신번호 인증</h2>

            {/* STEP 1: 안내 */}
            {senderStatus !== 'verified' && smsAuthStep === 'intro' && (
              <div style={{ background: 'rgba(94,106,210,0.04)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E', marginBottom: 12 }}>📋 문자 발신 서비스 이용 안내</p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                  「전기통신사업법」 제84조의2에 따라 문자 발송 시 발신번호를 사전 등록해야 하며,
                  타인 명의 번호로의 무단 발신을 방지하기 위해 본인 확인 절차가 법적으로 요구됩니다.
                </p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>
                  아래 절차에 따라 본인 인증을 완료하시면 고객에게 본인 번호로 문자를 발송할 수 있습니다.
                </p>

                <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid #E5E7EB' }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#5E6AD2', marginBottom: 8 }}>📝 진행 절차</p>
                  {['1단계 — 서비스 이용 동의', '2단계 — 본인 정보 입력 (이름/생년월일/주소/발신번호)', '3단계 — 본인 서명 (모바일에서 직접 서명)', '4단계 — 통신서비스 이용증명원 업로드', '5단계 — 입력 내용 최종 확인', '6단계 — 제출 완료'].map((s, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>✓ {s}</p>
                  ))}
                </div>

                <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: 12, color: '#92400E' }}>
                    ⏱ 제출 후 <b>영업일 기준 1~3일</b> 이내 검토 후 활성화됩니다.<br/>
                    🔒 입력하신 정보는 발신번호 등록 목적으로만 사용되며, 서비스 해지 즉시 파기됩니다.
                  </p>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E', marginBottom: 10 }}>서비스 이용에 동의하시겠습니까?</p>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                    <input type="checkbox" checked={smsAgreed} onChange={e => setSmsAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: '#5E6AD2' }} />
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                      개인정보 수집·이용에 동의합니다. (수집항목: 이름, 생년월일, 주소, 전화번호 / 목적: 문자 발신번호 등록 대행 / 보유기간: 서비스 해지 시 즉시 파기)
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                    <input type="checkbox" checked={smsAgreed} onChange={e => setSmsAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: '#5E6AD2' }} />
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                      발신번호 등록 위임에 동의합니다. (위임내용: 본인 명의 번호를 주식회사 글로벌엠디에 발신번호 등록 업무 위임)
                    </span>
                  </label>
                  <button
                    onClick={() => { if (smsAgreed) setSmsAuthStep('form') }}
                    disabled={!smsAgreed}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: smsAgreed ? '#5E6AD2' : '#D1D5DB', color: 'white', fontSize: 14, fontWeight: 600, cursor: smsAgreed ? 'pointer' : 'not-allowed' }}>
                    인증 시작하기
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: 정보 입력 */}
            {senderStatus !== 'verified' && smsAuthStep === 'form' && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>2단계 — 본인 정보 입력</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>서류에 사용될 정보를 정확하게 입력해주세요.</p>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>이름 *</label>
                  <input className={styles.fieldInput} value={agent?.name || ''} disabled style={{ background: '#F5F5F5', color: '#999' }} />
                  <p className={styles.fieldHint}>가입 시 등록된 이름이 자동 적용됩니다.</p>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>생년월일 *</label>
                  <input className={styles.fieldInput}
                    placeholder="예: 19850101"
                    value={smsForm.birthDate}
                    onChange={e => setSmsForm({ ...smsForm, birthDate: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    inputMode="numeric" />
                  <p className={styles.fieldHint}>8자리 숫자로 입력 (예: 19850101)</p>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>주소 *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className={styles.fieldInput}
                      placeholder="주소 검색 버튼을 눌러주세요"
                      value={smsForm.address}
                      readOnly
                      style={{ background: '#F9FAFB' }}
                    />
                    <button
                      onClick={() => {
                        const script = document.createElement('script')
                        script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
                        script.onload = () => {
                          new (window as any).daum.Postcode({
                            oncomplete: (data: any) => {
                              const addr = data.roadAddress || data.jibunAddress
                              setSmsForm({ ...smsForm, address: addr })
                            }
                          }).open()
                        }
                        if ((window as any).daum?.Postcode) {
                          new (window as any).daum.Postcode({
                            oncomplete: (data: any) => {
                              const addr = data.roadAddress || data.jibunAddress
                              setSmsForm({ ...smsForm, address: addr })
                            }
                          }).open()
                        } else {
                          document.head.appendChild(script)
                        }
                      }}
                      style={{ whiteSpace: 'nowrap', padding: '0 14px', borderRadius: 8, border: '1px solid #5E6AD2', background: '#5E6AD2', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      주소 검색
                    </button>
                  </div>
                  <input className={styles.fieldInput}
                    placeholder="상세 주소 입력 (동/호수 등)"
                    value={smsForm.addressDetail || ''}
                    onChange={e => setSmsForm({ ...smsForm, addressDetail: e.target.value } as any)}
                    style={{ marginTop: 6 }}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>문자 발신번호 *</label>
                  <input className={styles.fieldInput}
                    placeholder="010-0000-0000"
                    value={smsForm.senderPhone}
                    onChange={e => setSmsForm({ ...smsForm, senderPhone: formatPhone(e.target.value) })}
                    inputMode="numeric" />
                  <p className={styles.fieldHint}>본인 명의 휴대폰 번호를 입력해주세요.</p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setSmsAuthStep('intro')}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                    이전
                  </button>
                  <button
                    onClick={() => {
                      if (!smsForm.birthDate || !smsForm.address || !smsForm.senderPhone) {
                        alert('모든 항목을 입력해주세요.')
                        return
                      }
                      setSmsAuthStep('sign')
                    }}
                    style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#5E6AD2', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    서명하러 가기
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: 서명 */}
            {senderStatus !== 'verified' && smsAuthStep === 'sign' && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>3단계 — 본인 서명</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>아래 서명란에 손가락으로 직접 서명해주세요.</p>

                <div style={{ border: '2px dashed #D1D5DB', borderRadius: 10, overflow: 'hidden', background: '#FAFAFA', marginBottom: 12 }}>
                  <canvas
                    ref={el => { canvasRef.current = el }}
                    width={320} height={160}
                    style={{ width: '100%', height: 160, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
                    onPointerDown={e => {
                      const canvas = canvasRef.current
                      if (!canvas) return
                      setIsDrawing(true)
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width / rect.width
                      const scaleY = canvas.height / rect.height
                      const ctx = canvas.getContext('2d')!
                      ctx.beginPath()
                      ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
                    }}
                    onPointerMove={e => {
                      if (!isDrawing) return
                      const canvas = canvasRef.current
                      if (!canvas) return
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width / rect.width
                      const scaleY = canvas.height / rect.height
                      const ctx = canvas.getContext('2d')!
                      ctx.lineWidth = 2.5
                      ctx.lineCap = 'round'
                      ctx.strokeStyle = '#111827'
                      ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
                      ctx.stroke()
                    }}
                    onPointerUp={() => {
                      setIsDrawing(false)
                      const canvas = canvasRef.current
                      if (canvas) setSignatureData(canvas.toDataURL('image/png'))
                    }}
                  />
                </div>

                <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>서명란을 손가락으로 드래그하여 서명해주세요</p>

                <button onClick={() => {
                  const canvas = canvasRef.current
                  if (!canvas) return
                  const ctx = canvas.getContext('2d')!
                  ctx.clearRect(0, 0, canvas.width, canvas.height)
                  setSignatureData('')
                }} style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                  다시 서명하기
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSmsAuthStep('form')}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                    이전
                  </button>
                  <button
                    onClick={() => {
                      if (!signatureData) { alert('서명을 먼저 완성해주세요.'); return }
                      setSmsAuthStep('upload')
                    }}
                    style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#5E6AD2', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    확인하기
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: 통신서비스 이용증명원 업로드 */}
            {senderStatus !== 'verified' && smsAuthStep === 'upload' && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 10px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a', marginBottom: 4 }}>4단계 — 통신서비스 이용증명원 업로드</p>
                <p style={{ fontSize: 13, color: '#999', marginBottom: 14 }}>통신사 앱 또는 고객센터에서 발급받은 이용증명원을 업로드해주세요.</p>
                <div style={{ background: 'rgba(94,106,210,0.04)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                  <p style={{ fontSize: 14, color: '#5E6AD2', fontWeight: 700, marginBottom: 10 }}>📋 통신사를 선택하면 발급 페이지로 이동합니다</p>
                  {(() => {
                    const carriers = [
                      { label: 'SKT', name: 'SKT (T World)', docName: '이용계약 등록사항 증명서', url: 'https://www.tworld.co.kr', path: 'MY > 나의 가입정보 > 이용계약 등록사항 증명서 조회', warn: '⚠️ 인터넷으로 직접 발급하면 생년월일 일부가 **로 가려져 나옵니다. 가려지지 않은 서류가 필요하므로 고객센터 114에 전화하여 "이용계약 등록사항 증명서 발급 요청"을 해주세요.' },
                      { label: 'KT', name: 'KT', docName: '가입증명원 (통신서비스 이용증명원)', url: 'https://www.kt.com', path: '마이 > 가입/이용 > 가입정보 > 가입증명원 인쇄', warn: '' },
                      { label: 'LGU+', name: 'LG U+', docName: '서비스 가입확인서', url: 'https://www.lguplus.com/support/service/use-guide/registered-service', path: '고객지원 > 서비스 이용안내 > 이용 가이드 > 서비스 조회 > 가입조회', warn: '' },
                      { label: '헬로모바일', name: '헬로모바일', docName: '통신서비스 이용증명원', url: 'https://www.hellomobile.co.kr', path: '마이페이지 > 이용증명원 발급', warn: '고객센터: 1855-1144' },
                      { label: 'KT M모바일', name: 'KT M모바일', docName: '통신서비스 이용증명원', url: 'https://www.ktmmobile.com', path: '마이페이지 > 증명서 발급', warn: '고객센터: 1899-1114' },
                      { label: 'U+알뜰', name: 'U+알뜰모바일', docName: '통신서비스 이용증명원', url: 'https://www.uplusalmo.co.kr', path: '마이페이지 > 이용증명원', warn: '고객센터: 1544-7000' },
                      { label: 'SK7', name: 'SK7모바일', docName: '통신서비스 이용증명원', url: 'https://www.sk7mobile.com', path: '마이페이지 > 증명서 발급', warn: '고객센터: 1599-0999' },
                      { label: '이마트', name: '이마트모바일', docName: '통신서비스 이용증명원', url: 'https://www.emartmobile.co.kr', path: '마이페이지 > 이용증명원', warn: '고객센터: 1599-7900' },
                      { label: '세종', name: '세종텔레콤', docName: '통신서비스 이용증명원', url: 'https://www.sejongtelecom.net', path: '고객센터 전화 요청', warn: '고객센터: 1699-1000' },
                      { label: '기타', name: '기타 알뜰폰', docName: '통신서비스 이용증명원', url: '', path: '해당 통신사 고객센터에 전화하여 발급 요청', warn: '' },
                    ]
                    const found = carriers.find(c => c.label === selectedCarrier)
                    return (
                      <div>
                        <select
                          value={selectedCarrier}
                          onChange={e => setSelectedCarrier(e.target.value)}
                          style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: selectedCarrier ? '#1a1a1a' : '#999', fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>
                          <option value="" disabled>통신사를 선택하세요</option>
                          {carriers.map(c => <option key={c.label} value={c.label}>{c.name}</option>)}
                        </select>
                        {found && (
                          <div style={{ background: 'rgba(94,106,210,0.04)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <p style={{ fontSize: 12, color: '#999' }}>서류명</p>
                              <p style={{ fontSize: 14, color: '#5E6AD2', fontWeight: 700 }}>{found.docName}</p>
                            </div>
                            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, marginBottom: 8 }}>
                              <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>발급 경로</p>
                              <p style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{found.path}</p>
                            </div>
                            {found.warn && (
                              <div style={{ background: '#FEF3C7', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                                <p style={{ fontSize: 13, color: '#92400E', fontWeight: 700, lineHeight: 1.7 }}>{found.warn}</p>
                              </div>
                            )}
                            {found.url && (
                              <button onClick={() => window.open(found.url, '_blank')}
                                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: '#5E6AD2', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                {found.name} 발급 페이지 열기 →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  <p style={{ fontSize: 13, color: '#999', marginTop: 6, marginBottom: 10, lineHeight: 1.7 }}>발급 후 아래에 파일을 업로드해주세요.<br/>⚠️ 생년월일이 **로 가려진 서류는 사용할 수 없습니다.</p>
                </div>
                <label
                  style={{ display: 'block', border: `2px dashed ${telecomDocFile ? '#5E6AD2' : '#D1D5DB'}`, borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', background: telecomDocFile ? 'rgba(94,106,210,0.05)' : '#FAFAFA', marginBottom: 12 }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation()
                    const file = e.dataTransfer.files?.[0]
                    if (file) setTelecomDocFile(file)
                  }}
                >
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) setTelecomDocFile(file)
                    }} />
                  {telecomDocFile ? (
                    <div>
                      <p style={{ fontSize: 14, color: '#5E6AD2', fontWeight: 600 }}>✅ {telecomDocFile.name}</p>
                      <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>다른 파일로 변경하려면 다시 클릭하세요</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 32, marginBottom: 8 }}>📄</p>
                      <p style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>파일을 선택하거나 여기에 끌어다 놓으세요</p>
                      <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>PDF, JPG, PNG 파일 지원</p>
                    </div>
                  )}
                </label>
                {telecomVerified === false && telecomVerifyIssues.length > 0 && (
                  <div style={{ background: '#FCEBEB', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: '#A32D2D', fontWeight: 700, marginBottom: 6 }}>❌ 서류 검증 실패 — 아래 내용을 확인해주세요</p>
                    {telecomVerifyIssues.map((issue, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#A32D2D', marginBottom: 3 }}>• {issue}</p>
                    ))}
                    <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>수정 후 파일을 다시 업로드해주세요.</p>
                  </div>
                )}
                {telecomVerified === true && (
                  <div style={{ background: '#E1F5EE', border: '1px solid rgba(29,158,117,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: '#0F6E56', fontWeight: 700 }}>✅ 서류 검증 완료! 다음 단계로 진행하세요.</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setSmsAuthStep('sign')}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                    이전
                  </button>
                  <button
                    disabled={!telecomDocFile || telecomUploading}
                    onClick={async () => {
                      if (!telecomDocFile) { alert('파일을 먼저 선택해주세요.'); return }
                      setTelecomUploading(true)
                      try {
                        const formData = new FormData()
                        formData.append('file', telecomDocFile)
                        formData.append('agentName', agent?.name || '')
                        formData.append('birthDate', smsForm.birthDate)
                        formData.append('senderPhone', smsForm.senderPhone)
                        const res = await fetch('/api/upload-telecom-doc', { method: 'POST', body: formData })
                        const json = await res.json()
                        if (!res.ok) throw new Error(json.error || '업로드 실패')
                        setTelecomDocUrl(json.url)
                        setTelecomVerified(json.verified)
                        setTelecomVerifyIssues(json.issues || [])
                        if (json.verified === false) {
                          // 검증 실패 → 재업로드 안내 (단계 유지)
                        } else {
                          // 통과 또는 검증 불가 → 다음 단계
                          setSmsAuthStep('confirm')
                        }
                      } catch (e: any) {
                        alert(e.message || '업로드 중 오류가 발생했습니다.')
                      } finally {
                        setTelecomUploading(false)
                      }
                    }}
                    style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: telecomDocFile && !telecomUploading ? '#5E6AD2' : '#D1D5DB', color: 'white', fontSize: 14, fontWeight: 600, cursor: telecomDocFile && !telecomUploading ? 'pointer' : 'not-allowed' }}>
                    {telecomUploading ? '검증 중...' : '다음'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: 최종 확인 */}
            {senderStatus !== 'verified' && smsAuthStep === 'confirm' && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>4단계 — 최종 확인</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>아래 내용이 정확한지 확인 후 제출해주세요.</p>

                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  {[
                    { label: '이름', value: agent?.name },
                    { label: '생년월일', value: smsForm.birthDate },
                    { label: '주소', value: smsForm.address + (smsForm.addressDetail ? ' ' + smsForm.addressDetail : '') },
                    { label: '발신번호', value: smsForm.senderPhone },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {signatureData && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>서명</p>
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 8, background: '#FAFAFA' }}>
                      <img src={signatureData} alt="서명" style={{ width: '100%', maxHeight: 80, objectFit: 'contain' }} />
                    </div>
                  </div>
                )}

                {submitError && (
                  <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{submitError}</p>
                )}

                <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: 12, color: '#92400E' }}>
                    제출 후 <b>영업일 1~3일</b> 이내 담당자 검토 후 문자 발송이 활성화됩니다.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSmsAuthStep('sign')}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                    이전
                  </button>
                  <button
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true)
                      setSubmitError('')
                      try {
                        const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser()
                        const { data: agentData } = await (await import('../lib/supabase')).supabase
                          .from('dpa_agents').select('id').eq('user_id', user!.id).single()

                        const res = await fetch('/api/sms-auth-submit', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            agentId: agentData?.id,
                            agentName: agent?.name,
                            birthDate: smsForm.birthDate,
                            address: smsForm.address + (smsForm.addressDetail ? ' ' + smsForm.addressDetail : ''),
                            senderPhone: smsForm.senderPhone,
                            signatureData,
                            telecomDocUrl,
                          })
                        })
                        if (!res.ok) throw new Error('제출 실패')
                        setSmsAuthStep('done')
                        setSenderStatus('pending')
                      } catch (err: any) {
                        setSubmitError('제출 중 오류가 발생했습니다. 다시 시도해주세요.')
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                    style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: submitting ? '#9CA3AF' : '#5E6AD2', color: 'white', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                    {submitting ? '제출 중...' : '제출하기'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: 완료 */}
            {(smsAuthStep === 'done' || senderStatus === 'pending') && senderStatus !== 'verified' && (
              <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 12, padding: '24px 16px', marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#065F46', marginBottom: 8 }}>신청이 완료됐습니다!</p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                  담당자 검토 후 <b>영업일 기준 1~3일</b> 이내<br/>
                  문자 발송이 활성화됩니다.<br/>
                  활성화 시 알림을 보내드립니다.
                </p>
              </div>
            )}

            {/* 인증 완료 상태 */}
            {senderStatus === 'verified' && (
              <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <p style={{ fontWeight: 700, fontSize: 16, color: '#065F46' }}>문자 발신번호 인증 완료</p>
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E1F5EE' }}>
                    <p style={{ fontSize: 13, color: '#999' }}>등록 번호</p>
                    <p style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>{senderPhone}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <p style={{ fontSize: 13, color: '#999' }}>등록일</p>
                    <p style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>
                      {smsAuthSubmittedAt ? new Date(smsAuthSubmittedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '') : '-'}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>번호 변경이 필요하시면 아래 버튼을 눌러주세요.</p>
                <button
                  onClick={() => { setSenderStatus('none'); setSmsAuthStep('intro') }}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid #6EE7B7', background: '#fff', color: '#065F46', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  재신청하기
                </button>
              </div>
            )}

            <div style={{ height: 24 }} />

            <h2 className={styles.sectionTitle}>문자 기본 톤</h2>
            <p className={styles.sectionDesc}>AI가 문자 스크립트를 생성할 때 기본으로 적용할 톤입니다.</p>
            <div className={styles.toneRow}>
              {TONE_OPTIONS.map(t => (
                <button key={t.key}
                  className={[styles.toneBtn, defaultTone === t.key ? styles.toneBtnActive : ''].join(' ')}
                  onClick={() => saveTone(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ height: 24 }} />

            <h2 className={styles.sectionTitle}>이번 달 문자 사용량</h2>
            {smsUsage ? (
              <div className={styles.usageCard}>
                <div className={styles.usageBar}>
                  <div className={styles.usageFill}
                    style={{ width: `${Math.min((smsUsage.used / smsUsage.limit) * 100, 100)}%` }} />
                </div>
                <div className={styles.usageInfo}>
                  <span>{smsUsage.used}건 사용</span>
                  <span style={{ fontWeight: 700, color: '#5E6AD2' }}>{smsUsage.remaining}건 남음</span>
                  <span style={{ color: '#999' }}>/ {smsUsage.limit}건</span>
                </div>
                <div className={styles.usagePlan}>플랜: {smsUsage.plan?.toUpperCase()}</div>
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: 14 }}>사용량 정보를 불러올 수 없습니다.</p>
            )}
          </div>
        )}

        {/* ═══ 알림 설정 ═══ */}
        {tab === 'notification' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>알림 설정</h2>
            <p className={styles.sectionDesc}>대시보드와 알림 페이지에 표시할 알림을 설정합니다.</p>

            <div className={styles.notifGroup}>
              <p className={styles.notifGroupLabel}>기본 알림 (필수)</p>
              {DEFAULT_NOTIFICATIONS.map(n => (
                <div key={n.key} className={styles.notifItem} style={{ opacity: 0.6 }}>
                  <div className={styles.notifLeft}>
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <div>
                      <p className={styles.notifLabel}>{n.label}</p>
                      <p className={styles.notifDesc}>{n.desc}</p>
                    </div>
                  </div>
                  <div className={[styles.toggle, styles.toggleOn, styles.toggleLocked].join(' ')}>
                    <div className={styles.toggleCircle} />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.notifGroup}>
              <p className={styles.notifGroupLabel}>선택 알림</p>
              {OPTIONAL_NOTIFICATIONS.map(n => (
                <div key={n.key} className={styles.notifItem}>
                  <div className={styles.notifLeft}>
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <div>
                      <p className={styles.notifLabel}>{n.label}</p>
                      <p className={styles.notifDesc}>{n.desc}</p>
                    </div>
                  </div>
                  <div className={[styles.toggle, notifSettings[n.key] ? styles.toggleOn : ''].join(' ')}
                    onClick={() => setNotifSettings(prev => ({ ...prev, [n.key]: !prev[n.key] }))}>
                    <div className={styles.toggleCircle} />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.notifGroup}>
              <p className={styles.notifGroupLabel}>생일 알림 세부 설정</p>
              <p className={styles.notifDesc} style={{ marginBottom: 8 }}>언제 알림을 받을지 선택하세요 (복수 선택 가능)</p>
              <div className={styles.birthdayRow}>
                {BIRTHDAY_OPTIONS.map(b => (
                  <button key={b.key}
                    className={[styles.birthdayBtn, birthdayAlerts[b.key] ? styles.birthdayBtnActive : ''].join(' ')}
                    onClick={() => setBirthdayAlerts(prev => ({ ...prev, [b.key]: !prev[b.key] }))}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.btnPrimary} onClick={saveNotifSettings} style={{ marginTop: 16 }}>
              알림 설정 저장
            </button>
          </div>
        )}

        {/* ═══ 데이터·해지 ═══ */}
        {tab === 'data' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>데이터 내보내기</h2>
            <p className={styles.sectionDesc}>고객 정보, 보험 계약, 보장 항목을 CSV 파일로 다운로드합니다.</p>
            <button className={styles.btnOutline} style={{ marginTop: 8 }}>
              CSV 다운로드 (준비 중)
            </button>

            <div style={{ height: 40 }} />

            <h2 className={styles.sectionTitle} style={{ color: '#E53E3E' }}>서비스 해지</h2>
            <div className={styles.cancelCard}>
              <p className={styles.cancelText}>
                해지 시 서버에 저장된 모든 데이터는 즉시 완전히 삭제되며 복구되지 않습니다.
              </p>
              <p className={styles.cancelSub}>
                고객 정보, 보험 계약, 보장 분석, 발송 이력 등 모든 데이터가 영구 삭제됩니다.
              </p>
              <button className={styles.btnDanger} onClick={handleCancel}>
                서비스 해지하기
              </button>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  )
}
