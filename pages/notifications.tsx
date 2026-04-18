import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Notifications.module.css'
import SmsSlidePanel from '../components/SmsSlide'

type ToneType = '정중' | '친근' | '애교' | '간결'
type IssueType = 'nearDone' | 'gap' | 'birthday' | 'expiry' | 'longNoContact' | 'anniversary'

const TONES: ToneType[] = ['정중', '친근', '애교', '간결']
const EMOJIS = ['😊','😄','🎂','🎉','🎊','💚','📞','🙏','👍','✅','🔥','💪','⭐','🌟','❤️']

function calcPaymentRate(ct: any): number {
  if (ct.payment_status === '완납') return 100
  if (ct.contract_start && ct.payment_years) {
    const match = ct.payment_years.match(/(\d+)년/)
    if (match) {
      const totalMonths = parseInt(match[1]) * 12
      const [year, month] = ct.contract_start.split('.').map(Number)
      if (year && month) {
        const now = new Date()
        const paid = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1
        return Math.min(Math.round(Math.max(0, paid) / totalMonths * 100), 100)
      }
    }
  }
  return ct.payment_rate || 0
}

function getBirthdayDays(birthDate: string): number | null {
  if (!birthDate) return null
  const now = new Date()
  const birth = new Date(birthDate)
  const thisYear = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
  let diff = Math.ceil((thisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) {
    const nextYear = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate())
    diff = Math.ceil((nextYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  if (diff <= 30) return diff
  return null
}

// PC용 스크립트
const SCRIPTS: Record<string, Record<ToneType, string>> = {
  birthday: { 정중: '{name} 님, 오늘 생신을 진심으로 축하드립니다.\n항상 건강하시고 행복하신 날 되시길 바랍니다.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n오늘 생일이에요! 🎂\n항상 건강하고 행복하세요!', 애교: '{name} 님~ 생일 축하해요! 🎂🎉\n오늘 하루 정말 특별한 날 되세요!\n항상 곁에서 응원할게요 💚', 간결: '{name} 님, 생일 축하드립니다! 🎂' },
  birthday_d1: { 정중: '{name} 님, 내일 생신이시군요.\n미리 진심으로 축하드립니다.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n내일 생일이시잖아요! 🎂\n미리 축하드려요!', 애교: '{name} 님~ 내일 생일이죠? 🎂\n미리 축하해요! 💚', 간결: '{name} 님, 내일 생일 미리 축하드립니다! 🎂' },
  birthday_week: { 정중: '{name} 님, 곧 생신이 다가오고 있습니다.\n미리 진심으로 축하드립니다.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n곧 생일이에요! 🎂 미리 축하드려요!', 애교: '{name} 님~ 생일이 곧이에요! 🎂\n미리 축하드려요 💚', 간결: '{name} 님, 생일 곧 미리 축하드립니다! 🎂' },
  nearDone: { 정중: '안녕하세요 {name} 님,\n가입하신 보험의 납입이 거의 완료될 예정입니다.\n완납 후 재설계를 검토해 드릴 수 있습니다.\n편하신 시간에 연락 주세요.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n납입이 거의 다 됐어요! 🎉\n완납 후 더 좋은 조건으로 재설계할 수 있어요!', 애교: '{name} 님~ 드디어 완납 임박이에요! 🎊\n정말 수고 많으셨어요! 💚', 간결: '{name} 님, 보험 완납이 임박했습니다. 연락 주세요.' },
  gap: { 정중: '안녕하세요 {name} 님,\n보험 검토 중 보장 공백이 확인되었습니다.\n한번 상담해 드리고 싶습니다.\n편하신 시간에 말씀 주세요.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n보험을 확인해보니 보장 공백이 있어서요.\n시간 되실 때 통화 한번 해도 될까요? 📞', 애교: '{name} 님~ 보장 공백을 발견했어요! 😮\n더 잘 지켜드리고 싶어서요 💚', 간결: '{name} 님, 보장 공백이 확인됐습니다. 연락 주세요. 📞' },
  expiry: { 정중: '안녕하세요 {name} 님,\n가입하신 보험이 곧 만기가 도래합니다.\n미리 안내드립니다.\n편하신 시간에 상담 부탁드립니다.\n- 담당 설계사 드림', 친근: '안녕하세요 {name} 님! 😊\n가입하신 보험이 곧 만기가 돼요!\n미리 알려드리려고 연락드렸어요.', 애교: '{name} 님~ 보험 만기가 다가오고 있어요! ⏰\n보장 공백 없이 잘 챙겨드리고 싶어서요 💚', 간결: '{name} 님, 보험 만기가 임박했습니다. 연락 주세요.' },
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['일','월','화','수','목','금','토']
  return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`
}

const ISSUE_CONFIG: Record<IssueType, { icon: string; label: string; desc: string; color: string; badgeBg: string; badgeColor: string; borderColor: string }> = {
  nearDone:    { icon: '🔥', label: '완납 임박',   desc: '납입률 90% 이상',     color: '#BA7517', badgeBg: '#FAEEDA', badgeColor: '#854F0B', borderColor: '#BA7517' },
  gap:         { icon: '⚠️', label: '보장 공백',  desc: '뇌혈관 미가입',        color: '#A32D2D', badgeBg: '#FCEBEB', badgeColor: '#A32D2D', borderColor: '#E24B4A' },
  birthday:    { icon: '🎂', label: '생일',        desc: '7일 이내',              color: '#0F6E56', badgeBg: '#E1F5EE', badgeColor: '#0F6E56', borderColor: '#1D9E75' },
  expiry:      { icon: '📋', label: '만기 임박',   desc: '30일 이내',             color: '#185FA5', badgeBg: '#E6F1FB', badgeColor: '#185FA5', borderColor: '#378ADD' },
  longNoContact: { icon: '📞', label: '장기 미연락', desc: '마지막 미팅 90일 이상', color: '#5F5E5A', badgeBg: '#F1EFE8', badgeColor: '#444441', borderColor: '#888780' },
  anniversary: { icon: '🎉', label: '계약 기념일', desc: '1/3/5년 주기 7일 이내', color: '#534AB7', badgeBg: '#EEEDFE', badgeColor: '#3C3489', borderColor: '#7F77DD' },
}

export default function NotificationsPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState('')
  const [meetings, setMeetings] = useState<any[]>([])

  // 페이지 탭
  const [activeTab, setActiveTab] = useState<'ai' | 'bulk'>('ai')

  // 단체문자 필터
  const [bulkAgeMin, setBulkAgeMin] = useState<number | null>(null)
  const [bulkAgeMax, setBulkAgeMax] = useState<number | null>(null)
  const [bulkGender, setBulkGender] = useState<'전체' | '남' | '여'>('전체')
  const [bulkCustomerType, setBulkCustomerType] = useState<'전체' | 'active' | 'prospect'>('전체')
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([])
  const [bulkContent, setBulkContent] = useState('')
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkHistoryOpen, setBulkHistoryOpen] = useState<string | null>(null)

  // 모바일: 이슈 드릴다운
  const [activeIssue, setActiveIssue] = useState<IssueType | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCustomer, setSmsCustomer] = useState<any>(null)
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false)
  const [bulkIndex, setBulkIndex] = useState(0)

  // PC: 기존 상태
  const [selected, setSelected] = useState<any>(null)
  const [tone, setTone] = useState<ToneType>('친근')
  const [scriptText, setScriptText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const textareaRef = useRef<any>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const aid = user?.id || ''
    setAgentId(aid)
    const { data: custs } = await supabase.from('dpa_customers').select('*').eq('agent_id', aid)
    const { data: conts } = await supabase.from('dpa_contracts').select('*').eq('agent_id', aid)
    const { data: covs } = await supabase.from('dpa_coverages').select('*').in('contract_id', (conts || []).map((c: any) => c.id))
    const { data: msgs } = await supabase.from('dpa_messages').select('*, dpa_customers(name)').eq('agent_id', aid).order('created_at', { ascending: false }).limit(100)
    const { data: meets } = await supabase.from('dpa_meetings').select('*').eq('agent_id', aid).eq('status', '완료')
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    setMessages(msgs || [])
    setMeetings(meets || [])
    setLoading(false)
  }

  // ─── 알림 데이터 계산 ───
  const notifMap: Record<IssueType, any[]> = { nearDone: [], gap: [], birthday: [], expiry: [], longNoContact: [], anniversary: [] }

  customers.forEach(c => {
    const cts = contracts.filter(ct => ct.customer_id === c.id)
    // 완납 임박
    const nearDone = cts.filter(ct => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납')
    if (nearDone.length > 0) {
      const maxRate = Math.max(...nearDone.map(ct => calcPaymentRate(ct)))
      notifMap.nearDone.push({ id: `neardone-${c.id}`, customer: c, contracts: nearDone, rate: maxRate, notifType: 'nearDone', badge: `${maxRate}%` })
    }
    // 보장 공백
    if (cts.length > 0) {
      const cvs = coverages.filter(cv => cts.some(ct => ct.id === cv.contract_id))
      const hasBrain = cvs.some(cv => cv.category === '뇌혈관')
      const hasCare = cvs.some(cv => cv.category === '간병')
      if (!hasBrain || !hasCare) {
        notifMap.gap.push({ id: `gap-${c.id}`, customer: c, hasBrain, hasCare, notifType: 'gap', badge: '보장 공백' })
      }
    }
    // 만기 임박
    cts.forEach(ct => {
      if (ct.expiry_age && ct.expiry_age !== '종신') {
        notifMap.expiry.push({ id: `expiry-${ct.id}`, customer: c, contract: ct, notifType: 'expiry', badge: '만기 임박' })
      }
    })
  })

  customers.forEach(c => {
    const days = getBirthdayDays(c.birth_date)
    if (days === null) return
    let badge = `D-${days}`
    if (days === 0) badge = '생일 당일'
    else if (days === 1) badge = 'D-1'
    notifMap.birthday.push({ id: `birth-${c.id}`, customer: c, days, notifType: 'birthday', badge })
  })

  // 장기 미연락 (마지막 미팅 90일 이상)
  const today = new Date()
  customers.forEach(c => {
    const cMeetings = meetings.filter((m: any) => m.customer_id === c.id)
    if (cMeetings.length === 0) return
    const last = cMeetings.sort((a: any, b: any) => b.meeting_date.localeCompare(a.meeting_date))[0]
    const diff = (today.getTime() - new Date(last.meeting_date).getTime()) / 86400000
    if (diff >= 90) {
      notifMap.longNoContact.push({ id: `longno-${c.id}`, customer: c, days: Math.floor(diff), notifType: 'longNoContact', badge: `${Math.floor(diff)}일` })
    }
  })

  // 계약 기념일 (1/3/5년 주기 7일 이내)
  customers.forEach(c => {
    const cts = contracts.filter(ct => ct.customer_id === c.id && ct.contract_start)
    cts.forEach(ct => {
      const parts = ct.contract_start.split('.')
      if (parts.length < 2) return
      const startYear = parseInt(parts[0])
      const startMonth = parseInt(parts[1]) - 1
      const startDay = parts[2] ? parseInt(parts[2]) : 1
      const years = today.getFullYear() - startYear
      if (years <= 0) return
      if (![1,2,3,4,5,7,10].includes(years)) return
      const anniversary = new Date(today.getFullYear(), startMonth, startDay)
      const diffDays = Math.ceil((anniversary.getTime() - today.getTime()) / 86400000)
      if (diffDays >= 0 && diffDays <= 7) {
        const existing = notifMap.anniversary.find((n: any) => n.customer.id === c.id)
        if (!existing) {
          notifMap.anniversary.push({ id: `anniv-${ct.id}`, customer: c, contract: ct, years, diffDays, notifType: 'anniversary', badge: `${years}주년 D-${diffDays || '당일'}` })
        }
      }
    })
  })

  const activeNotifs = activeIssue ? notifMap[activeIssue] : []
  const selectedNotifs = activeNotifs.filter(n => selectedIds.includes(n.id))

  // ─── PC 함수 ───
  function applyScript(n: any, t: ToneType) {
    const type = n.type || n.notifType
    const tpl = SCRIPTS[type]?.[t] || SCRIPTS['gap'][t]
    setScriptText(tpl.replace(/{name}/g, n.customer.name))
  }
  function selectNotif(n: any) { setSelected(n); applyScript(n, tone) }
  function changeTone(t: ToneType) {
    setTone(t)
    if (selected) { setAiLoading(true); setTimeout(() => { applyScript(selected, t); setAiLoading(false) }, 400) }
  }
  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) { setScriptText(s => s + emoji); return }
    const start = el.selectionStart; const end = el.selectionEnd
    const next = scriptText.slice(0, start) + emoji + scriptText.slice(end)
    setScriptText(next)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + emoji.length; el.focus() }, 0)
  }
  async function handleSend() {
    if (!selected || !scriptText) return
    setSending(true)
    try {
      await supabase.from('dpa_messages').insert({ agent_id: agentId, customer_id: selected.customer.id, message_type: selected.type || selected.notifType, tone, sent_script: scriptText, is_sent: true, sent_at: new Date().toISOString() })
      await fetchAll(); alert(`${selected.customer.name} 님께 발송됐어요! 😊`)
    } catch(e) { alert('발송 중 오류가 발생했어요!') }
    setSending(false)
  }
  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText)
    await supabase.from('dpa_messages').insert({ agent_id: agentId, customer_id: selected.customer.id, message_type: selected.type || selected.notifType, tone, sent_script: scriptText, is_sent: false })
    await fetchAll(); alert('복사됐어요! 카카오에 붙여넣으세요 😊')
  }

  // ─── 모바일 함수 ───
  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }
  function openSms(customer: any) { setSmsCustomer(customer); setSmsOpen(true) }
  function startBulkSend() { setBulkIndex(0); setBulkSmsOpen(true) }

  // ─── PC 알림 렌더 ───
  const allNotifs = [...notifMap.nearDone, ...notifMap.gap, ...notifMap.birthday, ...notifMap.expiry]
  const todayNotifs = allNotifs.filter(n => ['nearDone','gap'].includes(n.notifType) || (n.notifType === 'birthday' && n.days <= 1))
  const weekNotifs = allNotifs.filter(n => !todayNotifs.includes(n))

  function getPcStyle(n: any) {
    const cfg = ISSUE_CONFIG[n.notifType as IssueType]
    return { icon: cfg?.icon || '🔔', badge: n.badge, badgeCls: '', iconCls: '' }
  }

  function renderPcCard(n: any) {
    const s = getPcStyle(n)
    const cfg = ISSUE_CONFIG[n.notifType as IssueType]
    const isSel = selected?.id === n.id
    const isExpanded = expandedId === n.id
    const custMsgs = messages.filter((m: any) => m.customer_id === n.customer.id)
    return (
      <div key={n.id}>
        <div className={[styles.notifCard, isSel ? styles.selected : '', todayNotifs.includes(n) ? styles.unread : ''].join(' ')}
          style={{ borderLeft: isSel ? undefined : `2.5px solid ${cfg?.borderColor || '#888'}` }}
          onClick={() => selectNotif(n)}>
          <div className={styles.cardRow}>
            <div className={styles.iconWrap}>{s.icon}</div>
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{n.customer.name}고객 {cfg?.label}</div>
              <div className={styles.cardDesc}>{n.notifType === 'nearDone' ? `납입률 ${n.rate}%` : n.notifType === 'gap' ? `${!n.hasBrain?'뇌혈관':''} ${!n.hasCare?'간병인':''} 보장 없음` : n.notifType === 'birthday' ? '생일 축하 문자를 보내보세요!' : n.contract?.company}</div>
              <div className={styles.cardMeta}><span className={styles.badge} style={{ background: cfg?.badgeBg, color: cfg?.badgeColor }}>{s.badge}</span></div>
            </div>
            <button className={styles.historyBtn} onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : n.id) }}>
              {isExpanded ? '닫기' : '이력보기'}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className={styles.inlineHistory}>
            {custMsgs.length === 0 ? <div className={styles.inlineHistoryEmpty}>발송 이력이 없어요</div>
              : custMsgs.map((m: any) => (
                <div key={m.id} className={styles.inlineHistoryItem}>
                  <div className={styles.inlineHistoryRow}>
                    <span className={[styles.badge, m.is_sent ? styles.badgeTeal : styles.badgeGray].join(' ')}>{m.is_sent ? '발송' : '카카오/복사'}</span>
                    <span className={styles.inlineHistoryType}>{m.message_type}</span>
                    <span className={styles.inlineHistoryDate}>{fmtDate(m.created_at)}</span>
                  </div>
                  <div className={styles.inlineHistoryScript}>{m.sent_script}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  // 단체문자 대상 고객 필터링
  const bulkFilteredCustomers = customers.filter((c: any) => {
    // 고객 유형 필터
    if (bulkCustomerType !== '전체' && c.customer_type !== bulkCustomerType) return false
    // 성별 필터
    if (bulkGender !== '전체') {
      const rid = c.resident_number || ''
      const genderCode = rid.replace('-', '')[6]
      const isMale = genderCode === '1' || genderCode === '3'
      if (bulkGender === '남' && !isMale) return false
      if (bulkGender === '여' && isMale) return false
    }
    // 나이 필터
    if (bulkAgeMin !== null || bulkAgeMax !== null) {
      const bd = c.birth_date || (c.resident_number ? c.resident_number.replace('-', '').slice(0,6) : '')
      if (!bd) return bulkAgeMin === null
      const year = parseInt(bd.slice(0,2))
      const fullYear = year >= 0 && year <= 30 ? 2000 + year : 1900 + year
      const age = new Date().getFullYear() - fullYear
      if (bulkAgeMin !== null && age < bulkAgeMin) return false
      if (bulkAgeMax !== null && age > bulkAgeMax) return false
    }
    return true
  })

  // 나이대 옵션
  const AGE_OPTIONS = [
    { label: '전체', min: null, max: null },
    { label: '20대', min: 20, max: 29 },
    { label: '30대', min: 30, max: 39 },
    { label: '40대', min: 40, max: 49 },
    { label: '50대', min: 50, max: 59 },
    { label: '60대 이상', min: 60, max: null },
  ]

  // 마지막 발송일 포맷
  function fmtSmsDate(ts: string | null) {
    if (!ts) return null
    const d = new Date(ts)
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}`
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>

      {/* ═══════════════════════════════
          PC: 기존 2단 그리드
      ═══════════════════════════════ */}
      <div className={styles.pcGrid}>
        <div className={styles.listCol}>
          {todayNotifs.length > 0 && (<><div className={styles.sectionLabel}>오늘</div>{todayNotifs.map(n => renderPcCard(n))}</>)}
          {weekNotifs.length > 0 && (<><div className={styles.divider}></div><div className={styles.sectionLabel}>이번 주</div>{weekNotifs.map(n => renderPcCard(n))}</>)}
          {allNotifs.length === 0 && <div className={styles.empty}>알림이 없어요 🎉</div>}
        </div>
        <div className={styles.phoneCol}>
          {selected && (
            <>
              <div className={styles.recipientRow}>
                <div className={styles.avatar}>{selected.customer.name.slice(0,2)}</div>
                <div>
                  <div className={styles.recipientName}>{selected.customer.name}</div>
                  <div className={styles.recipientPhone}>{selected.customer.phone || '연락처 없음'}</div>
                </div>
              </div>
              <div className={styles.aiRow}><div className={styles.aiBadge}><div className={styles.aiDot}></div>AI 추천 스크립트</div></div>
              <div className={styles.aiDesc}>상황에 맞는 문자를 추천해 드려요. 자유롭게 수정 후 발송하세요 😊</div>
              <div className={styles.toneRow}>
                {TONES.map(t => (<button key={t} className={[styles.toneBtn, tone === t ? styles.toneBtnActive : ''].join(' ')} onClick={() => changeTone(t)}>{t}</button>))}
              </div>
            </>
          )}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className={styles.phoneWrapper}>
              <div className={styles.phoneFrame}>
                <div className={styles.phoneNotch}></div>
                <div className={styles.phoneScreen}>
                  <div className={styles.statusBar}><span className={styles.statusTime}>9:41</span><span className={styles.statusIcons}>●●● 🔋</span></div>
                  <div className={styles.smsHeader}>
                    <div className={styles.smsName} style={{ color: selected ? '#1C1C1E' : '#C7C7CC' }}>{selected ? selected.customer.name : '-'}</div>
                    <div className={styles.smsType}>문자 메시지</div>
                  </div>
                  <div className={styles.smsBody}>
                    {selected ? (
                      <div className={styles.bubbleWrap}>
                        <div className={styles.bubble}>
                          <textarea ref={textareaRef} className={styles.bubbleEdit} value={scriptText} onChange={e => setScriptText(e.target.value)} rows={8} />
                          <div className={styles.bubbleTime}>오전 9:41</div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.phoneEmpty}><div style={{ fontSize: 24, marginBottom: 6 }}>💬</div><div>왼쪽에서 알림을<br />선택해 주세요</div></div>
                    )}
                  </div>
                  <div className={styles.emojiRow}>{EMOJIS.map(e => (<button key={e} className={styles.emojiBtn} onClick={() => insertEmoji(e)} disabled={!selected}>{e}</button>))}</div>
                </div>
                <div className={styles.phoneHome}></div>
              </div>
            </div>
          </div>
          <div className={styles.actionBtns}>
            <button className={styles.btnSend} onClick={handleSend} disabled={sending || !selected}>{sending ? '발송 중...' : '발송하기'}</button>
            <button className={styles.btnCopy} onClick={handleCopy} disabled={!selected}>복사</button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════
          모바일 전용 레이아웃
      ═══════════════════════════════ */}
      <div className={styles.mobileLayout}>

        {/* ── 탭 바 ── */}
        {!activeIssue && (
          <div style={{ display: 'flex', borderBottom: '1px solid #EDEBE4', marginBottom: 0, background: '#fff' }}>
            {[{ key: 'ai', label: '🤖 AI 추천' }, { key: 'bulk', label: '📨 단체문자' }].map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key as 'ai' | 'bulk')}
                style={{ flex: 1, padding: '12px 0', fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? '#1D9E75' : '#999', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #1D9E75' : '2px solid transparent', cursor: 'pointer' }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── 단체문자 탭 ── */}
        {!activeIssue && activeTab === 'bulk' && (
          <div style={{ padding: '12px 10px' }}>
            {/* 필터 */}
            <div style={{ background: '#fff', border: '1px solid #EDEBE4', borderRadius: 12, padding: '14px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>🔍 대상 필터</p>

              {/* 고객 유형 */}
              <p style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>고객 유형</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[{ key: '전체', label: '전체' }, { key: 'active', label: '마이고객' }, { key: 'prospect', label: '관심고객' }].map(o => (
                  <button key={o.key}
                    onClick={() => setBulkCustomerType(o.key as any)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${bulkCustomerType === o.key ? '#1D9E75' : '#EDEBE4'}`, background: bulkCustomerType === o.key ? '#E1F5EE' : '#fff', color: bulkCustomerType === o.key ? '#065F46' : '#666', fontSize: 13, fontWeight: bulkCustomerType === o.key ? 700 : 400, cursor: 'pointer' }}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* 나이대 */}
              <p style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>나이대</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {AGE_OPTIONS.map(o => {
                  const isActive = bulkAgeMin === o.min && bulkAgeMax === o.max
                  return (
                    <button key={o.label}
                      onClick={() => { setBulkAgeMin(o.min); setBulkAgeMax(o.max) }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${isActive ? '#1D9E75' : '#EDEBE4'}`, background: isActive ? '#E1F5EE' : '#fff', color: isActive ? '#065F46' : '#666', fontSize: 13, fontWeight: isActive ? 700 : 400, cursor: 'pointer' }}>
                      {o.label}
                    </button>
                  )
                })}
              </div>

              {/* 성별 */}
              <p style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>성별</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['전체', '남', '여'].map(g => (
                  <button key={g}
                    onClick={() => setBulkGender(g as any)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${bulkGender === g ? '#1D9E75' : '#EDEBE4'}`, background: bulkGender === g ? '#E1F5EE' : '#fff', color: bulkGender === g ? '#065F46' : '#666', fontSize: 13, fontWeight: bulkGender === g ? 700 : 400, cursor: 'pointer' }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 필터 결과 요약 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600 }}>대상 고객 <span style={{ color: '#1D9E75' }}>{bulkFilteredCustomers.length}명</span></p>
              <button
                onClick={() => setBulkSelectedIds(bulkSelectedIds.length === bulkFilteredCustomers.length ? [] : bulkFilteredCustomers.map((c: any) => c.id))}
                style={{ fontSize: 13, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {bulkSelectedIds.length === bulkFilteredCustomers.length && bulkFilteredCustomers.length > 0 ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            {/* 고객 리스트 */}
            <div style={{ background: '#fff', border: '1px solid #EDEBE4', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
              {bulkFilteredCustomers.length === 0 ? (
                <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '20px 0' }}>조건에 맞는 고객이 없어요</p>
              ) : bulkFilteredCustomers.map((c: any, i: number) => {
                const isSel = bulkSelectedIds.includes(c.id)
                const lastSent = fmtSmsDate(c.sms_last_sent_at)
                const msgs = messages.filter((m: any) => m.customer_id === c.id)
                const smsCount = c.sms_count || msgs.length || 0
                return (
                  <div key={c.id}
                    onClick={() => setBulkSelectedIds(isSel ? bulkSelectedIds.filter(id => id !== c.id) : [...bulkSelectedIds, c.id])}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < bulkFilteredCustomers.length - 1 ? '1px solid #EDEBE4' : 'none', background: isSel ? '#F0FDF4' : '#fff', cursor: 'pointer' }}>
                    {/* 체크박스 */}
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSel ? '#1D9E75' : '#D1D5DB'}`, background: isSel ? '#1D9E75' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSel && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    {/* 이름 + 번호 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{c.name}</p>
                      <p style={{ fontSize: 12, color: '#999' }}>{c.phone || '번호 없음'}</p>
                    </div>
                    {/* 뱃지 */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {smsCount > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#E1F5EE', color: '#065F46', fontWeight: 700 }}>{smsCount}회</span>
                      )}
                      {lastSent && (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#F1EFE8', color: '#5F5E5A', fontWeight: 600 }}>{lastSent}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 발송 버튼 */}
            {bulkSelectedIds.length > 0 && (
              <div style={{ position: 'sticky', bottom: 70, background: '#FAF9F5', padding: '10px 0', borderTop: '1px solid #EDEBE4' }}>
                <button
                  onClick={() => {
                    const cost = bulkSelectedIds.length * 14
                    if (confirm(`${bulkSelectedIds.length}명에게 단체문자를 발송합니다.
예상 비용: 약 ${cost.toLocaleString()}원

계속하시겠습니까?`)) {
                      alert('단체문자 발송 기능은 SMS 연동 후 사용 가능합니다.')
                    }
                  }}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#1D9E75', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  {bulkSelectedIds.length}명에게 발송하기 · 약 {(bulkSelectedIds.length * 14).toLocaleString()}원
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 메인: 이슈 카드 목록 ── */}
        {!activeIssue && activeTab === 'ai' && (
          <>
            {/* 이슈 카드 */}
            <div className={styles.issueList}>
              {(Object.keys(ISSUE_CONFIG) as IssueType[]).map(type => {
                const cfg = ISSUE_CONFIG[type]
                const count = notifMap[type].length
                return (
                  <div key={type} className={styles.issueCard} onClick={() => { setActiveIssue(type); setSelectMode(false); setSelectedIds([]) }}>
                    <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                    <div className={styles.issueCardBody}>
                      <p className={styles.issueCardLabel}>{cfg.label}</p>
                      <p className={styles.issueCardDesc}>{cfg.desc}</p>
                    </div>
                    <span className={styles.issueCardCount} style={{ color: cfg.color }}>{count}명</span>
                    <div className={styles.issueCardChevron} />
                  </div>
                )
              })}
            </div>

            {/* 최근 발송 이력 - 항상 표시 */}
            <div className={styles.recentHistory}>
              <p className={styles.recentHistoryLabel}>최근 발송 이력</p>
              {messages.length === 0 ? (
                <p className={styles.recentHistoryEmpty}>아직 발송 이력이 없어요 📭</p>
              ) : messages.slice(0, 5).map((m: any) => {
                const typeLabel: Record<string, string> = { nearDone: '완납임박', gap: '보장공백', birthday: '생일', expiry: '만기임박', longNoContact: '장기미연락', anniversary: '계약기념일', 최근미팅: '미팅후속', 최근계약: '계약감사', 일반: '일반' }
                const typeCfg: Record<string, { bg: string; color: string }> = {
                  nearDone: { bg: '#FAEEDA', color: '#854F0B' }, gap: { bg: '#FCEBEB', color: '#A32D2D' },
                  birthday: { bg: '#E1F5EE', color: '#0F6E56' }, expiry: { bg: '#E6F1FB', color: '#185FA5' },
                  longNoContact: { bg: '#F1EFE8', color: '#444441' }, anniversary: { bg: '#EEEDFE', color: '#3C3489' },
                }
                const tCfg = typeCfg[m.message_type] || { bg: '#F1EFE8', color: '#5F5E5A' }
                return (
                  <div key={m.id} className={styles.recentHistoryItem}>
                    <span className={styles.recentHistoryName}>{m.dpa_customers?.name}고객</span>
                    <span className={styles.recentHistoryBadge} style={{ background: tCfg.bg, color: tCfg.color }}>{typeLabel[m.message_type] || m.message_type}</span>
                    <span className={styles.recentHistoryBadge} style={{ background: m.is_sent ? '#E1F5EE' : '#F1EFE8', color: m.is_sent ? '#085041' : '#5F5E5A' }}>{m.is_sent ? '발송' : '카카오/복사'}</span>
                    <span className={styles.recentHistoryDate}>{fmtDate(m.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── 드릴다운: 이슈별 고객 리스트 ── */}
        {activeIssue && (
          <>
            {/* 헤더 (뒤로가기) - 심플 */}
            <div className={styles.drillSimpleHeader}>
              <button className={styles.backBtn} onClick={() => { setActiveIssue(null); setSelectMode(false); setSelectedIds([]) }}>
                <div className={styles.backChevron} />
              </button>
              <span className={styles.drillSimpleTitle}>{ISSUE_CONFIG[activeIssue].icon} {ISSUE_CONFIG[activeIssue].label} {activeNotifs.length}명</span>
            </div>

            {/* 선택된 고객 있을 때만 단체발송 배너 표시 */}
            {selectedIds.length > 0 && (
              <div className={styles.selectBanner}>
                <span className={styles.selectBannerText}>{selectedIds.length}명 선택됨</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.selectAllBtn} onClick={() => setSelectedIds(selectedIds.length === activeNotifs.length ? [] : activeNotifs.map(n => n.id))}>
                    {selectedIds.length === activeNotifs.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <button className={styles.bulkSendBtn} onClick={startBulkSend}>단체 발송</button>
                </div>
              </div>
            )}

            {/* 고객 카드 리스트 */}
            {activeNotifs.length === 0 ? (
              <div className={styles.empty}>해당 알림이 없어요 🎉</div>
            ) : activeNotifs.map(n => {
              const cfg = ISSUE_CONFIG[activeIssue]
              const isChecked = selectedIds.includes(n.id)
              const lastMsg = messages.filter((m: any) => m.customer_id === n.customer.id)[0]
              return (
                <div key={n.id} className={styles.drillCard}
                  style={{ borderLeft: isChecked ? undefined : `2.5px solid ${cfg.borderColor}`, border: isChecked ? `1.5px solid #1D9E75` : undefined }}
                  onClick={() => toggleSelect(n.id)}>
                  <div className={styles.drillCardRow}>
                    <div className={styles.checkbox}
                      style={{ background: isChecked ? '#1D9E75' : 'transparent', border: isChecked ? 'none' : '1.5px solid #D1D5DB' }}
                      onClick={e => { e.stopPropagation(); toggleSelect(n.id) }}>
                      {isChecked && <span style={{ color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div className={styles.drillCardBody}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        <span className={styles.drillCardName}>{n.customer.name}고객</span>
                      </div>
                      {n.customer.phone && <p className={styles.drillCardPhone}>{n.customer.phone}</p>}
                      {n.notifType === 'nearDone' && <p className={styles.drillCardSub}>{n.contracts?.[0]?.company}</p>}
                      {n.notifType === 'expiry' && <p className={styles.drillCardSub}>{n.contract?.company}</p>}
                      {n.notifType === 'anniversary' && <p className={styles.drillCardSub}>{n.contract?.company} · {n.years}주년</p>}
                      {lastMsg && <p className={styles.drillCardHistory}>{lastMsg.is_sent ? '✉️' : '📋'} {fmtDate(lastMsg.created_at)} 발송됨</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className={styles.drillCardBadge} style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>{n.badge}</span>
                      <button className={styles.smsBtn} onClick={e => { e.stopPropagation(); openSms(n.customer) }}>문자</button>
                    </div>
                  </div>
                </div>
              )
            })}

          </>
        )}
      </div>

      {/* ═══════════════════════════════
          SmsSlide 팝업 (개별)
      ═══════════════════════════════ */}
      {smsOpen && smsCustomer && (
        <SmsSlidePanel
          isOpen={smsOpen}
          onClose={() => { setSmsOpen(false); setSmsCustomer(null); fetchAll() }}
          customer={smsCustomer}
          meetings={meetings}
          contracts={contracts}
          coverages={coverages}
          agentId={agentId}
        />
      )}

      {/* ═══════════════════════════════
          SmsSlide 팝업 (단체 발송)
      ═══════════════════════════════ */}
      {bulkSmsOpen && selectedNotifs[bulkIndex] && (
        <SmsSlidePanel
          isOpen={bulkSmsOpen}
          onClose={() => {
            if (bulkIndex < selectedNotifs.length - 1) {
              setBulkIndex(i => i + 1)
            } else {
              setBulkSmsOpen(false)
              setSelectMode(false)
              setSelectedIds([])
              setBulkIndex(0)
              fetchAll()
            }
          }}
          customer={selectedNotifs[bulkIndex].customer}
          contracts={contracts}
          coverages={coverages}
          agentId={agentId}
        />
      )}
    </div>
  )
}
