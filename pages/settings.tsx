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

export default function SettingsPage() {
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

  // 알림 설정
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({
    longNoContact: false, anniversary: false, wedding: false,
  })
  const [birthdayAlerts, setBirthdayAlerts] = useState<Record<string, boolean>>({
    d30: false, d7: true, d1: true, d0: true,
  })

  // 문자 기본 톤
  const [defaultTone, setDefaultTone] = useState('친근')

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
      setSenderStatus(s.sender_verified ? 'verified' : 'none')

      if (s.notifications) {
        setNotifSettings(prev => ({ ...prev, ...s.notifications }))
      }
      if (s.birthday_alerts) {
        setBirthdayAlerts(prev => ({ ...prev, ...s.birthday_alerts }))
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
    <div className={styles.wrap}>
      {ConfirmDialog}

      {/* 탭 메뉴 */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.key}
            className={[styles.tabBtn, tab === t.key ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(t.key)}>
            <span className={styles.tabIcon}>{t.icon}</span>
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ═══ 내 정보 ═══ */}
        {tab === 'profile' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>👤 내 정보</h2>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>이름</label>
              <div className={styles.fieldRow}>
                <input className={styles.fieldInput} value={agent?.name || ''} disabled
                  style={{ background: '#F5F5F5', color: '#999' }} />
                <button className={styles.btnOutline}
                  onClick={() => alert('이름 변경은 고객센터로 문의해주세요.\n(보안을 위해 직접 변경이 불가합니다)')}>
                  고객센터 문의
                </button>
              </div>
              <p className={styles.fieldHint}>보안을 위해 이름은 직접 변경할 수 없습니다.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>이메일</label>
              <input className={styles.fieldInput} value={editEmail}
                onChange={e => setEditEmail(e.target.value)} placeholder="이메일 주소" />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>연락처</label>
              <input className={styles.fieldInput} value={editPhone}
                onChange={e => setEditPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" />
            </div>

            <button className={styles.btnPrimary} onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}

        {/* ═══ 문자 설정 ═══ */}
        {tab === 'sms' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>📱 문자 발신번호</h2>
            <p className={styles.sectionDesc}>고객에게 문자를 발송할 때 표시되는 발신번호입니다. 본인 명의 번호만 등록 가능합니다.</p>

            <div className={styles.senderCard}>
              <div className={styles.senderStatus}>
                <span className={styles.senderDot} style={{
                  background: senderStatus === 'verified' ? '#1D9E75' : senderStatus === 'pending' ? '#FCD34D' : '#D1D5DB'
                }} />
                <span style={{ fontSize: 13, color: senderStatus === 'verified' ? '#1D9E75' : '#666' }}>
                  {senderStatus === 'verified' ? '인증 완료' : senderStatus === 'pending' ? '인증 대기 중' : '미등록'}
                </span>
              </div>

              <div className={styles.fieldRow} style={{ marginTop: 12 }}>
                <input className={styles.fieldInput} value={senderPhone}
                  onChange={e => setSenderPhone(formatPhone(e.target.value))}
                  placeholder="010-0000-0000"
                  disabled={senderStatus === 'verified'} />
                {senderStatus !== 'verified' && (
                  <button className={styles.btnPrimary} onClick={registerSender} disabled={registeringPhone}
                    style={{ whiteSpace: 'nowrap' }}>
                    {registeringPhone ? '요청 중...' : 'ARS 인증 요청'}
                  </button>
                )}
              </div>

              {registerError && <p className={styles.errorText}>{registerError}</p>}

              {senderStatus === 'pending' && (
                <div className={styles.arsGuide}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>📞 ARS 인증 절차</p>
                  <p>1. 입력한 번호로 ARS 전화가 옵니다</p>
                  <p>2. 안내에 따라 인증번호를 입력해주세요</p>
                  <p>3. 인증 완료 후 문자 발송이 가능합니다</p>
                </div>
              )}

              {senderStatus === 'verified' && (
                <button className={styles.btnText}
                  onClick={() => { setSenderStatus('none') }}
                  style={{ marginTop: 8 }}>
                  발신번호 변경
                </button>
              )}
            </div>

            <div style={{ height: 24 }} />

            <h2 className={styles.sectionTitle}>💬 문자 기본 톤</h2>
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

            <h2 className={styles.sectionTitle}>📊 이번 달 문자 사용량</h2>
            {smsUsage ? (
              <div className={styles.usageCard}>
                <div className={styles.usageBar}>
                  <div className={styles.usageFill}
                    style={{ width: `${Math.min((smsUsage.used / smsUsage.limit) * 100, 100)}%` }} />
                </div>
                <div className={styles.usageInfo}>
                  <span>{smsUsage.used}건 사용</span>
                  <span style={{ fontWeight: 700, color: '#1D9E75' }}>{smsUsage.remaining}건 남음</span>
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
            <h2 className={styles.sectionTitle}>🔔 알림 설정</h2>
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
              <p className={styles.notifGroupLabel}>🎂 생일 알림 세부 설정</p>
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
            <h2 className={styles.sectionTitle}>📦 데이터 내보내기</h2>
            <p className={styles.sectionDesc}>고객 정보, 보험 계약, 보장 항목을 CSV 파일로 다운로드합니다.</p>
            <button className={styles.btnOutline} style={{ marginTop: 8 }}>
              CSV 다운로드 (준비 중)
            </button>

            <div style={{ height: 40 }} />

            <h2 className={styles.sectionTitle} style={{ color: '#E53E3E' }}>🚪 서비스 해지</h2>
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
  )
}
