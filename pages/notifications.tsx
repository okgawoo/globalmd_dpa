import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Notifications.module.css'
import SmsSlidePanel from '../components/SmsSlide'

type TabType = 'all' | 'nearDone' | 'birthday' | 'gap' | 'expiry' | 'history' | 'settings'
type ToneType = '정중' | '친근' | '애교' | '간결'

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

// PC용 기존 스크립트
const SCRIPTS: Record<string, Record<ToneType, string>> = {
  birthday: {
    정중: '{name} 님, 오늘 생신을 진심으로 축하드립니다.\n항상 건강하시고 행복하신 날 되시길 바랍니다.\n무엇이든 필요하신 것이 있으시면 말씀 부탁드립니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n오늘 생일이에요! 🎂\n항상 건강하고 행복하세요!\n무엇이든 필요하시면 언제든지 연락주세요 😊',
    애교: '{name} 님~ 생일 축하해요! 🎂🎉\n오늘 하루 정말 특별한 날 되세요!\n항상 곁에서 응원할게요 💚',
    간결: '{name} 님, 생일 축하드립니다! 🎂\n건강하고 행복한 하루 되세요 😊',
  },
  birthday_d1: {
    정중: '{name} 님, 내일 생신이시군요.\n미리 진심으로 축하드립니다.\n항상 건강하시고 행복하신 날 되시길 바랍니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n내일 생일이시잖아요! 🎂\n미리 생일 축하드려요! 항상 건강하세요 😊',
    애교: '{name} 님~ 내일 생일이죠? 🎂\n미리 축하해요! 내일 행복한 하루 되세요 💚',
    간결: '{name} 님, 내일 생일 미리 축하드립니다! 🎂',
  },
  birthday_week: {
    정중: '{name} 님, 곧 생신이 다가오고 있습니다.\n미리 진심으로 축하드립니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n곧 생일이에요! 🎂 미리 축하드려요!',
    애교: '{name} 님~ 생일이 곧이에요! 🎂\n미리 축하드려요 💚',
    간결: '{name} 님, 생일 곧 미리 축하드립니다! 🎂',
  },
  nearDone: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험의 납입이 거의 완료될 예정입니다.\n완납 후 더 유리한 조건으로 재설계를 검토해 드릴 수 있습니다.\n편하신 시간에 연락 주시면 자세히 안내드리겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n납입이 거의 다 됐어요! 🎉\n완납 후 더 좋은 조건으로 재설계할 수 있어요.\n시간 되실 때 한번 얘기 나눠요!',
    애교: '{name} 님~ 드디어 완납 임박이에요! 🎊\n정말 수고 많으셨어요!\n완납 후 더 좋은 혜택으로 바꿔드릴 수 있어요 💚',
    간결: '{name} 님, 보험 완납이 임박했습니다. 재설계 상담 원하시면 연락 주세요.',
  },
  gap: {
    정중: '안녕하세요 {name} 님,\n보험 검토 중 보장 공백이 확인되었습니다.\n보장 강화를 위해 한번 상담해 드리고 싶습니다.\n편하신 시간에 말씀 주시면 감사하겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n보험을 확인해보니 보장 공백이 있어서요.\n시간 되실 때 통화 한번 해도 될까요? 📞',
    애교: '{name} 님~ 보험 확인하다가 보장 공백을 발견했어요! 😮\n더 잘 지켜드리고 싶어서 연락드렸어요 💚\n잠깐 통화 가능하실까요?',
    간결: '{name} 님, 보장 공백이 확인됐습니다. 상담 원하시면 연락 주세요. 📞',
  },
  expiry: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험이 곧 만기가 도래합니다.\n만기 후 보장 공백이 발생하지 않도록 미리 안내드립니다.\n편하신 시간에 상담 부탁드립니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n가입하신 보험이 곧 만기가 돼요!\n미리 알려드리려고 연락드렸어요. 시간 되실 때 통화해요!',
    애교: '{name} 님~ 보험 만기가 다가오고 있어요! ⏰\n보장 공백 없이 잘 챙겨드리고 싶어서요 💚',
    간결: '{name} 님, 보험 만기가 임박했습니다. 재가입 상담 원하시면 연락 주세요.',
  },
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabType>('all')
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState('')

  // PC용 state
  const [selected, setSelected] = useState<any>(null)
  const [tone, setTone] = useState<ToneType>('친근')
  const [scriptText, setScriptText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 모바일용 state
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsNotif, setSmsNotif] = useState<any>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false)
  const [bulkIndex, setBulkIndex] = useState(0)

  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const aid = user?.id || ''
    setAgentId(aid)
    const { data: custs } = await supabase.from('dpa_customers').select('*').eq('agent_id', aid)
    const { data: conts } = await supabase.from('dpa_contracts').select('*').eq('agent_id', aid)
    const { data: covs } = await supabase.from('dpa_coverages').select('*').in('contract_id', (conts || []).map((c: any) => c.id))
    const { data: msgs } = await supabase.from('dpa_messages').select('*, dpa_customers(name)').eq('agent_id', aid).order('created_at', { ascending: false }).limit(100)
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    setMessages(msgs || [])
    setLoading(false)
  }

  const notifications: any[] = []

  customers.forEach(c => {
    const days = getBirthdayDays(c.birth_date)
    if (days === null) return
    let type = 'birthday_week'
    if (days === 0) type = 'birthday'
    else if (days === 1) type = 'birthday_d1'
    notifications.push({ id: `birth-${c.id}`, type, customer: c, days, priority: days })
  })

  customers.forEach(c => {
    const cts = contracts.filter(ct => ct.customer_id === c.id)
    const nearDone = cts.filter(ct => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납')
    if (nearDone.length > 0) {
      const maxRate = Math.max(...nearDone.map(ct => calcPaymentRate(ct)))
      notifications.push({ id: `neardone-${c.id}`, type: 'nearDone', customer: c, contracts: nearDone, rate: maxRate, priority: 100 + maxRate })
    }
  })

  customers.forEach(c => {
    const cts = contracts.filter(ct => ct.customer_id === c.id)
    if (cts.length === 0) return
    const cvs = coverages.filter(cv => cts.some(ct => ct.id === cv.contract_id))
    const hasBrain = cvs.some(cv => cv.category === '뇌혈관')
    const hasCare = cvs.some(cv => cv.category === '간병')
    if (!hasBrain || !hasCare) {
      notifications.push({ id: `gap-${c.id}`, type: 'gap', customer: c, hasBrain, hasCare, priority: 200 })
    }
  })

  customers.forEach(c => {
    const cts = contracts.filter(ct => ct.customer_id === c.id && ct.expiry_age)
    cts.forEach(ct => {
      if (ct.expiry_age && ct.expiry_age !== '종신') {
        notifications.push({ id: `expiry-${ct.id}`, type: 'expiry', customer: c, contract: ct, priority: 300 })
      }
    })
  })

  const filtered = notifications.filter(n => {
    if (tab === 'all') return true
    if (tab === 'nearDone') return n.type === 'nearDone'
    if (tab === 'birthday') return n.type.startsWith('birthday')
    if (tab === 'gap') return n.type === 'gap'
    if (tab === 'expiry') return n.type === 'expiry'
    return false
  }).sort((a, b) => a.priority - b.priority)

  const todayNotifs = filtered.filter(n => ['birthday','birthday_d1','nearDone','gap'].includes(n.type))
  const weekNotifs = filtered.filter(n => ['birthday_week','expiry'].includes(n.type))

  function getNotifStyle(type: string) {
    if (type === 'birthday') return { icon: '🎂', badge: '생일 당일', badgeCls: styles.badgeRed, iconCls: styles.iconRed, borderColor: '#E24B4A' }
    if (type === 'birthday_d1') return { icon: '🎂', badge: 'D-1', badgeCls: styles.badgeTeal, iconCls: styles.iconTeal, borderColor: '#1D9E75' }
    if (type === 'birthday_week') return { icon: '🎂', badge: `D-${notifications.find(n=>n.id===`birth-${''}`)} `, badgeCls: styles.badgeTeal, iconCls: styles.iconTeal, borderColor: '#1D9E75' }
    if (type === 'nearDone') return { icon: '🔥', badge: '완납 임박', badgeCls: styles.badgeAmber, iconCls: styles.iconAmber, borderColor: '#BA7517' }
    if (type === 'gap') return { icon: '⚠️', badge: '보장 공백', badgeCls: styles.badgeRed, iconCls: styles.iconRed, borderColor: '#E24B4A' }
    if (type === 'expiry') return { icon: '📋', badge: '만기 임박', badgeCls: styles.badgeBlue, iconCls: styles.iconBlue, borderColor: '#185FA5' }
    return { icon: '🔔', badge: '알림', badgeCls: styles.badgeGray, iconCls: styles.iconGreen, borderColor: '#888' }
  }

  function getTitle(n: any) {
    if (n.type === 'birthday') return `${n.customer.name} 님 생일이에요! 🎂`
    if (n.type === 'birthday_d1') return `${n.customer.name} 님 내일 생일이에요`
    if (n.type === 'birthday_week') return `${n.customer.name} 님 생일 D-${n.days}`
    if (n.type === 'nearDone') return `${n.customer.name} 님 완납 임박`
    if (n.type === 'gap') return `${n.customer.name} 님 보장 공백`
    if (n.type === 'expiry') return `${n.customer.name} 님 만기 임박`
    return n.customer.name
  }

  function getDesc(n: any) {
    if (n.type.startsWith('birthday')) return '생일 축하 문자를 보내보세요!'
    if (n.type === 'nearDone') return `납입률 ${n.rate}% — 완납 후 재설계 제안 필요`
    if (n.type === 'gap') return `${!n.hasBrain ? '뇌혈관' : ''}${!n.hasBrain && !n.hasCare ? ' · ' : ''}${!n.hasCare ? '간병인' : ''} 보장 없음`
    if (n.type === 'expiry') return `${n.contract.company} ${n.contract.insurance_type} 만기 예정`
    return ''
  }

  // ─────────────────────────────
  // PC 함수들
  // ─────────────────────────────
  function applyScript(n: any, t: ToneType) {
    const tpl = SCRIPTS[n.type]?.[t] || SCRIPTS['gap'][t]
    setScriptText(tpl.replace(/{name}/g, n.customer.name))
  }

  function selectNotif(n: any) {
    setSelected(n)
    applyScript(n, tone)
  }

  function changeTone(t: ToneType) {
    setTone(t)
    if (selected) {
      setAiLoading(true)
      setTimeout(() => { applyScript(selected, t); setAiLoading(false) }, 400)
    }
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
      await supabase.from('dpa_messages').insert({
        agent_id: agentId, customer_id: selected.customer.id,
        message_type: selected.type, tone,
        original_script: SCRIPTS[selected.type]?.[tone]?.replace(/{name}/g, selected.customer.name),
        sent_script: scriptText, is_sent: true, sent_at: new Date().toISOString(),
      })
      await fetchAll()
      alert(`${selected.customer.name} 님께 발송됐어요! 😊`)
    } catch(e) { alert('발송 중 오류가 발생했어요!') }
    setSending(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText)
    await supabase.from('dpa_messages').insert({
      agent_id: agentId, customer_id: selected.customer.id,
      message_type: selected.type, tone,
      original_script: SCRIPTS[selected.type]?.[tone]?.replace(/{name}/g, selected.customer.name),
      sent_script: scriptText, is_sent: false,
    })
    await fetchAll()
    alert('복사됐어요! 카카오에 붙여넣으세요 😊')
  }

  // ─────────────────────────────
  // 모바일 함수들
  // ─────────────────────────────
  function openSms(n: any) {
    setSmsNotif(n)
    setSmsOpen(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function startBulkSend() {
    setBulkIndex(0)
    setBulkSmsOpen(true)
  }

  const selectedNotifs = filtered.filter(n => selectedIds.includes(n.id))
  const currentBulkNotif = selectedNotifs[bulkIndex]

  const TABS = [
    { key: 'all', label: '전체', count: notifications.length },
    { key: 'nearDone', label: '완납', count: notifications.filter(n=>n.type==='nearDone').length },
    { key: 'birthday', label: '생일', count: notifications.filter(n=>n.type.startsWith('birthday')).length },
    { key: 'gap', label: '보장', count: notifications.filter(n=>n.type==='gap').length },
    { key: 'expiry', label: '만기', count: notifications.filter(n=>n.type==='expiry').length },
    { key: 'history', label: '이력', count: 0 },
    { key: 'settings', label: '설정', count: 0 },
  ]

  // ─────────────────────────────
  // PC 카드 렌더
  // ─────────────────────────────
  function renderCard(n: any) {
    const s = getNotifStyle(n.type)
    const isSel = selected?.id === n.id
    const isToday = ['birthday','birthday_d1','nearDone','gap'].includes(n.type)
    const isExpanded = expandedId === n.id
    const custMsgs = messages.filter((m: any) => m.customer_id === n.customer.id)
    return (
      <div key={n.id}>
        <div className={[styles.notifCard, isSel ? styles.selected : '', isToday ? styles.unread : ''].join(' ')} onClick={() => selectNotif(n)}>
          <div className={styles.cardRow}>
            <div className={[styles.iconWrap, s.iconCls].join(' ')}>{s.icon}</div>
            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{getTitle(n)}</div>
              <div className={styles.cardDesc}>{getDesc(n)}</div>
              <div className={styles.cardMeta}><span className={[styles.badge, s.badgeCls].join(' ')}>{s.badge}</span></div>
            </div>
            <button className={styles.historyBtn} onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : n.id) }}>
              {isExpanded ? '닫기' : '이력보기'}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className={styles.inlineHistory}>
            {custMsgs.length === 0 ? (
              <div className={styles.inlineHistoryEmpty}>발송 이력이 없어요</div>
            ) : custMsgs.map((m: any) => (
              <div key={m.id} className={styles.inlineHistoryItem}>
                <div className={styles.inlineHistoryRow}>
                  <span className={[styles.badge, m.is_sent ? styles.badgeTeal : styles.badgeGray].join(' ')}>{m.is_sent ? '발송' : '복사'}</span>
                  <span className={styles.inlineHistoryType}>{m.message_type === 'birthday' ? '생일' : m.message_type === 'nearDone' ? '완납임박' : m.message_type === 'gap' ? '보장공백' : m.message_type}</span>
                  <span className={styles.inlineHistoryDate}>{new Date(m.created_at).toLocaleDateString('ko-KR', {month:'numeric', day:'numeric'})}</span>
                </div>
                <div className={styles.inlineHistoryScript}>{m.sent_script}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────
  // 모바일 카드 렌더
  // ─────────────────────────────
  function renderMobileCard(n: any) {
    const s = getNotifStyle(n.type)
    const isChecked = selectedIds.includes(n.id)
    const custMsgs = messages.filter((m: any) => m.customer_id === n.customer.id)
    const lastMsg = custMsgs[0]

    return (
      <div key={n.id} className={styles.mobileCard} style={{ borderLeft: `2.5px solid ${s.borderColor}` }}
        onClick={() => selectMode ? toggleSelect(n.id) : null}
      >
        <div className={styles.mobileCardRow}>
          {selectMode && (
            <div className={styles.mobileCheckbox} style={{ background: isChecked ? '#1D9E75' : 'transparent', border: isChecked ? 'none' : '1.5px solid #D1D5DB' }}
              onClick={e => { e.stopPropagation(); toggleSelect(n.id) }}>
              {isChecked && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
            </div>
          )}
          <div className={styles.mobileCardIcon}>{s.icon}</div>
          <div className={styles.mobileCardBody}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className={styles.mobileCardName}>{n.customer.name}</span>
              <span className={[styles.badge, s.badgeCls].join(' ')} style={{ fontSize: 10 }}>{s.badge}</span>
            </div>
            <div className={styles.mobileCardDesc}>{getDesc(n)}</div>
            {lastMsg && (
              <div className={styles.mobileLastMsg}>
                {lastMsg.is_sent ? '✉️' : '📋'} {new Date(lastMsg.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 발송됨
              </div>
            )}
          </div>
          {!selectMode && (
            <button className={styles.mobileSmsBtn} onClick={e => { e.stopPropagation(); openSms(n) }}>
              문자
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>
      {/* 탭 */}
      <div className={styles.tabRow}>
        {TABS.map(t => (
          <div key={t.key} className={[styles.tab, tab === t.key ? styles.tabActive : ''].join(' ')} onClick={() => { setTab(t.key as TabType); setSelectMode(false); setSelectedIds([]) }}>
            {t.label}
            {t.count > 0 && <span className={styles.tabBadge}>{t.count}</span>}
          </div>
        ))}
      </div>

      {/* ───── 이력 탭 ───── */}
      {tab === 'history' ? (
        <div className={styles.historyList}>
          {messages.length === 0 ? <div className={styles.empty}>발송 이력이 없어요</div> : messages.map((m: any) => (
            <div key={m.id} className={styles.historyCard}>
              <div className={styles.historyRow}>
                <span className={styles.historyName}>{m.dpa_customers?.name} 님</span>
                <span className={[styles.badge, m.is_sent ? styles.badgeTeal : styles.badgeGray].join(' ')}>{m.is_sent ? '발송' : '복사'}</span>
                <span className={styles.historyTime}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className={styles.historyScript}>{m.sent_script}</div>
            </div>
          ))}
        </div>

      /* ───── 설정 탭 ───── */
      ) : tab === 'settings' ? (
        <div className={styles.settingsCard}>
          {[
            { label: '완납 임박 알림', sub: '납입률 90% 이상 시', on: true },
            { label: '생일 알림 (D-7/D-1/당일)', sub: '생일 7일 전부터 알림', on: true },
            { label: '보장 공백 알림', sub: '뇌혈관 + 간병인 미가입', on: true },
            { label: '만기 임박 알림', sub: '만기 30일 전부터', on: false },
          ].map((s, i) => (
            <div key={i} className={styles.settingRow}>
              <div><div className={styles.settingLabel}>{s.label}</div><div className={styles.settingSub}>{s.sub}</div></div>
              <div className={[styles.toggle, s.on ? styles.toggleOn : styles.toggleOff].join(' ')}><div className={styles.toggleKnob}></div></div>
            </div>
          ))}
        </div>

      ) : (
        <>
          {/* ───── PC: 2단 그리드 ───── */}
          <div className={styles.pcGrid}>
            <div className={styles.listCol}>
              {todayNotifs.length > 0 && (<><div className={styles.sectionLabel}>오늘</div>{todayNotifs.map(n => renderCard(n))}</>)}
              {weekNotifs.length > 0 && (<><div className={styles.divider}></div><div className={styles.sectionLabel}>이번 주</div>{weekNotifs.map(n => renderCard(n))}</>)}
              {filtered.length === 0 && <div className={styles.empty}>해당 알림이 없어요</div>}
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
                  <div className={styles.aiRow}>
                    <div className={styles.aiBadge}><div className={styles.aiDot}></div>AI 추천 스크립트</div>
                  </div>
                  <div className={styles.aiDesc}>상황에 맞는 문자를 추천해 드려요. 자유롭게 수정 후 발송하세요 😊</div>
                  <div className={styles.toneRow}>
                    {TONES.map(t => (<button key={t} className={[styles.toneBtn, tone === t ? styles.toneBtnActive : ''].join(' ')} onClick={() => changeTone(t)}>{t}</button>))}
                  </div>
                </>
              )}
              <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div className={styles.phoneWrapper}>
                  <div className={styles.phoneFrame}>
                    <div className={styles.phoneNotch}></div>
                    <div className={styles.phoneScreen}>
                      <div className={styles.statusBar}><span className={styles.statusTime}>9:41</span><span className={styles.statusIcons}>●●● 🔋</span></div>
                      <div className={styles.smsHeader}>
                        <div className={styles.smsName} style={{color: selected ? '#1C1C1E' : '#C7C7CC'}}>{selected ? selected.customer.name : '-'}</div>
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
                          <div className={styles.phoneEmpty}><div style={{fontSize:24, marginBottom:6}}>💬</div><div>왼쪽에서 알림을<br/>선택해 주세요</div></div>
                        )}
                      </div>
                      <div className={styles.emojiRow}>
                        {EMOJIS.map(e => (<button key={e} className={styles.emojiBtn} onClick={() => insertEmoji(e)} disabled={!selected}>{e}</button>))}
                      </div>
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

          {/* ───── 모바일 전용 ───── */}
          <div className={styles.mobileLayout}>
            {/* 단체발송 선택 모드 배너 */}
            {selectMode ? (
              <div className={styles.selectBanner}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{selectedIds.length}명 선택됨</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedIds.length > 0 && (
                    <button className={styles.bulkSendBtn} onClick={startBulkSend}>단체 발송</button>
                  )}
                  <button className={styles.cancelSelectBtn} onClick={() => { setSelectMode(false); setSelectedIds([]) }}>취소</button>
                </div>
              </div>
            ) : (
              <div className={styles.mobileToolbar}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>총 {filtered.length}건</span>
                <button className={styles.selectModeBtn} onClick={() => setSelectMode(true)}>선택 발송</button>
              </div>
            )}

            {/* 오늘 섹션 */}
            {todayNotifs.length > 0 && (
              <>
                <div className={styles.mobileSectionLabel}>오늘 {todayNotifs.length}건</div>
                {todayNotifs.map(n => renderMobileCard(n))}
              </>
            )}

            {/* 이번 주 섹션 */}
            {weekNotifs.length > 0 && (
              <>
                <div className={styles.mobileSectionLabel} style={{ marginTop: 12 }}>이번 주 {weekNotifs.length}건</div>
                {weekNotifs.map(n => renderMobileCard(n))}
              </>
            )}

            {filtered.length === 0 && <div className={styles.empty}>해당 알림이 없어요</div>}
          </div>
        </>
      )}

      {/* ───── 모바일 SmsSlide 팝업 ───── */}
      {smsOpen && smsNotif && (
        <SmsSlidePanel
          isOpen={smsOpen}
          onClose={() => { setSmsOpen(false); setSmsNotif(null) }}
          customer={smsNotif.customer}
          contracts={contracts}
          coverages={coverages}
          agentId={agentId}
        />
      )}

      {/* ───── 단체 발송 SmsSlide 팝업 ───── */}
      {bulkSmsOpen && currentBulkNotif && (
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
            }
          }}
          customer={currentBulkNotif.customer}
          contracts={contracts}
          coverages={coverages}
          agentId={agentId}
        />
      )}
    </div>
  )
}
