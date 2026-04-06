import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Notifications.module.css'

type TabType = 'all' | 'nearDone' | 'birthday' | 'gap' | 'expiry' | 'history' | 'settings'
type ToneType = '정중' | '친근' | '애교' | '간결'

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
    정중: '{name} 님, 곧 생신이 다가오고 있습니다.\n미리 진심으로 축하의 말씀 전합니다.\n항상 건강하시길 바랍니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n이번 주 생일이시잖아요! 🎂\n미리 생일 축하드려요! 건강하게 지내세요 😊',
    애교: '{name} 님~ 이번 주 생일이에요! 🎂\n미리미리 축하해요! 행복한 한 주 되세요 💚',
    간결: '{name} 님, 생일 미리 축하드립니다! 🎂',
  },
  nearDone: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험의 납입이 곧 완료될 예정입니다.\n완납 후 더 유리한 조건으로 재설계를 검토해 드릴 수 있습니다.\n편하신 시간에 말씀 주시면 연락드리겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n납입이 거의 다 됐어요! 🎉\n완납 후 더 좋은 조건으로 재설계할 기회가 생겨요.\n시간 되실 때 한번 얘기 나눠요!',
    애교: '{name} 님~ 드디어 완납 임박이에요! 🎊\n정말 수고 많으셨어요!\n완납 후 더 좋은 혜택으로 바꿔드릴 수 있어요 💚\n편하실 때 연락주세요!',
    간결: '{name} 님, 보험 완납이 임박했습니다.\n재설계 상담 원하시면 연락 주세요.',
  },
  gap: {
    정중: '안녕하세요 {name} 님,\n보험 검토 중 뇌혈관 보장 부분에 공백이 확인되었습니다.\n보장 강화를 위해 한번 상담해 드리고 싶습니다.\n편하신 시간에 말씀 주시면 감사하겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n보험을 확인해보니 뇌혈관 보장이 빠져있어서요.\n요즘 뇌혈관 뉴스가 많아 걱정이 돼서 연락드렸어요.\n시간 되실 때 통화 한번 해도 될까요? 📞',
    애교: '{name} 님~ 보험 확인하다가 뇌혈관 보장이 없는 걸 발견했어요! 😮\n더 잘 지켜드리고 싶어서 연락드렸어요 💚\n잠깐 통화 가능하실까요?',
    간결: '{name} 님, 뇌혈관 보장 공백이 확인됐습니다.\n상담 원하시면 연락 주세요. 📞',
  },
  expiry: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험이 곧 만기가 도래합니다.\n만기 후 보장 공백이 발생하지 않도록 미리 안내드리고자 연락드렸습니다.\n편하신 시간에 상담 요청 부탁드립니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n가입하신 보험이 곧 만기가 돼요!\n만기 후 보장 빈틈이 없도록 미리 알려드리려고 연락드렸어요.\n시간 되실 때 통화 한번 해요!',
    애교: '{name} 님~ 보험 만기가 다가오고 있어요! ⏰\n보장 공백 없이 잘 챙겨드리고 싶어서요 💚\n편하실 때 연락주세요!',
    간결: '{name} 님, 보험 만기가 임박했습니다.\n재가입 상담 원하시면 연락 주세요.',
  },
}

const EMOJIS = ['😊','😄','🎂','🎉','🎊','💚','📞','🙏','👍','✅','🔥','💪','⭐','🌟','❤️']
const TONES: ToneType[] = ['정중', '친근', '애교', '간결']

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabType>('all')
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [tone, setTone] = useState<ToneType>('친근')
  const [scriptText, setScriptText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [popupTop, setPopupTop] = useState(0)
  const [popupRight, setPopupRight] = useState(0)
  const [popupHeight, setPopupHeight] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listColRef = useRef<HTMLDivElement>(null)
  const historyColRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const agentId = user?.id
    const { data: custs } = await supabase.from('dpa_customers').select('*').eq('agent_id', agentId)
    const { data: conts } = await supabase.from('dpa_contracts').select('*').eq('agent_id', agentId)
    const { data: covs } = await supabase.from('dpa_coverages').select('*').in('contract_id', (conts || []).map((c: any) => c.id))
    const { data: msgs } = await supabase.from('dpa_messages').select('*, dpa_customers(name)').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50)
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    setMessages(msgs || [])
    setLoading(false)
  }

  // 알림 목록 생성
  const now = new Date()
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

  const todayNotifs = filtered.filter(n => {
    if (n.type === 'birthday') return n.days === 0
    if (n.type === 'birthday_d1') return n.days === 1
    if (n.type === 'nearDone' || n.type === 'gap') return true
    return false
  })
  const weekNotifs = filtered.filter(n => {
    if (n.type === 'birthday_week') return true
    if (n.type === 'expiry') return true
    return false
  })

  function getNotifStyle(type: string) {
    if (type === 'birthday') return { icon: '🎂', badge: '생일 당일', badgeCls: styles.badgeRed, iconCls: styles.iconRed }
    if (type === 'birthday_d1') return { icon: '🎂', badge: 'D-1', badgeCls: styles.badgeTeal, iconCls: styles.iconTeal }
    if (type === 'birthday_week') return { icon: '🎂', badge: `D-${0}`, badgeCls: styles.badgeTeal, iconCls: styles.iconTeal }
    if (type === 'nearDone') return { icon: '🔥', badge: '완납 임박', badgeCls: styles.badgeAmber, iconCls: styles.iconAmber }
    if (type === 'gap') return { icon: '⚠', badge: '보장 공백', badgeCls: styles.badgeRed, iconCls: styles.iconRed }
    if (type === 'expiry') return { icon: '📋', badge: '만기 임박', badgeCls: styles.badgeBlue, iconCls: styles.iconBlue }
    return { icon: '📌', badge: '', badgeCls: '', iconCls: '' }
  }

  function getTitle(n: any) {
    const name = n.customer.name
    if (n.type === 'birthday') return `${name} 님 오늘 생일`
    if (n.type === 'birthday_d1') return `${name} 님 내일 생일`
    if (n.type === 'birthday_week') return `${name} 님 생일 D-${n.days}`
    if (n.type === 'nearDone') return `${name} 님 완납 임박`
    if (n.type === 'gap') return `${name} 님 보장 공백 감지`
    if (n.type === 'expiry') return `${name} 님 보험 만기 임박`
    return name
  }

  function getDesc(n: any) {
    if (n.type === 'birthday') return '지금 바로 축하 문자 보내세요!'
    if (n.type === 'birthday_d1') return '내일 생일이에요 — 오늘 미리 문자 보내드리세요'
    if (n.type === 'birthday_week') return `${n.days}일 후 생일이에요 — 미리 준비해두세요`
    if (n.type === 'nearDone') return `납입률 ${n.rate}% 도달 — 완납 후 재설계 제안 필요`
    if (n.type === 'gap') {
      const parts = []
      if (!n.hasBrain) parts.push('뇌혈관')
      if (!n.hasCare) parts.push('간병인')
      return `${parts.join(' + ')} 미가입 — 확대 제안 필요`
    }
    if (n.type === 'expiry') return `${n.contract?.product_name || ''} 만기 임박 — 재가입 안내 필요`
    return ''
  }

  function applyScript(n: any, t: ToneType) {
    const tpl = SCRIPTS[n.type]?.[t] || SCRIPTS['gap'][t]
    setScriptText(tpl.replace(/{name}/g, n.customer.name))
  }

  function selectNotif(n: any) {
    setSelected(n)
    applyScript(n, tone)
    // 팝업은 SMS 보내기 버튼으로만 열림
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
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = scriptText.slice(0, start) + emoji + scriptText.slice(end)
    setScriptText(next)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + emoji.length; el.focus() }, 0)
  }

  async function handleSend() {
    if (!selected || !scriptText) return
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('dpa_messages').insert({
        agent_id: user?.id,
        customer_id: selected.customer.id,
        message_type: selected.type,
        tone,
        original_script: SCRIPTS[selected.type]?.[tone]?.replace(/{name}/g, selected.customer.name),
        sent_script: scriptText,
        is_sent: true,
        sent_at: new Date().toISOString(),
      })
      await fetchAll()
      alert(`${selected.customer.name} 님께 발송됐어요! 😊`)
      setPanelOpen(false)
    } catch(e) { alert('발송 중 오류가 발생했어요!') }
    setSending(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('dpa_messages').insert({
      agent_id: user?.id,
      customer_id: selected.customer.id,
      message_type: selected.type,
      tone,
      original_script: SCRIPTS[selected.type]?.[tone]?.replace(/{name}/g, selected.customer.name),
      sent_script: scriptText,
      is_sent: false,
    })
    await fetchAll()
    alert('복사됐어요! 카카오에 붙여넣으세요 😊')
  }

  const TABS = [
    { key: 'all', label: '전체', count: notifications.length },
    { key: 'nearDone', label: '완납 임박', count: notifications.filter(n=>n.type==='nearDone').length },
    { key: 'birthday', label: '생일·기념일', count: notifications.filter(n=>n.type.startsWith('birthday')).length },
    { key: 'gap', label: '보장 공백', count: notifications.filter(n=>n.type==='gap').length },
    { key: 'expiry', label: '만기 임박', count: notifications.filter(n=>n.type==='expiry').length },
    { key: 'history', label: '발송 이력', count: 0 },
    { key: 'settings', label: '설정', count: 0 },
  ]

  function renderCard(n: any) {
    const s = getNotifStyle(n.type)
    const isSel = selected?.id === n.id
    const isToday = ['birthday','birthday_d1','nearDone','gap'].includes(n.type)
    return (
      <div key={n.id}
        className={[styles.notifCard, isSel ? styles.selected : '', isToday ? styles.unread : ''].join(' ')}
        onClick={() => selectNotif(n)}
      >
        <div className={styles.cardRow}>
          <div className={[styles.iconWrap, s.iconCls].join(' ')}>{s.icon}</div>
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>{getTitle(n)}</div>
            <div className={styles.cardDesc}>{getDesc(n)}</div>
            <div className={styles.cardMeta}>
              <span className={[styles.badge, s.badgeCls].join(' ')}>{s.badge}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  // 발송 이력 필터링
  const filteredMsgs = selected
    ? messages.filter((m: any) => m.customer_id === selected.customer.id)
    : messages.slice(0, 20)

  return (
    <div className={styles.wrap}>
      {/* 탭 */}
      <div className={styles.tabRow}>
        {TABS.map(t => (
          <div key={t.key} className={[styles.tab, tab === t.key ? styles.tabActive : ''].join(' ')} onClick={() => setTab(t.key as TabType)}>
            {t.label}
            {t.count > 0 && <span className={styles.tabBadge}>{t.count}</span>}
          </div>
        ))}
      </div>

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
      ) : tab === 'settings' ? (
        <div className={styles.settingsCard}>
          <div className={styles.settingRow}>
            <div><div className={styles.settingLabel}>완납 임박 알림</div><div className={styles.settingSub}>납입률 90% 이상 시</div></div>
            <div className={[styles.toggle, styles.toggleOn].join(' ')}><div className={styles.toggleKnob}></div></div>
          </div>
          <div className={styles.settingRow}>
            <div><div className={styles.settingLabel}>생일 알림 (D-7/D-1/당일)</div><div className={styles.settingSub}>생일 7일 전부터 알림</div></div>
            <div className={[styles.toggle, styles.toggleOn].join(' ')}><div className={styles.toggleKnob}></div></div>
          </div>
          <div className={styles.settingRow}>
            <div><div className={styles.settingLabel}>보장 공백 알림</div><div className={styles.settingSub}>뇌혈관 + 간병인 미가입</div></div>
            <div className={[styles.toggle, styles.toggleOn].join(' ')}><div className={styles.toggleKnob}></div></div>
          </div>
          <div className={styles.settingRow}>
            <div><div className={styles.settingLabel}>만기 임박 알림</div><div className={styles.settingSub}>만기 30일 전부터</div></div>
            <div className={[styles.toggle, styles.toggleOff].join(' ')}><div className={styles.toggleKnob}></div></div>
          </div>
        </div>
      ) : (
        /* 2컬럼: 알림리스트 + 발송이력 */
        <div className={styles.grid}>

          {/* 왼쪽: 알림 리스트 */}
          <div className={styles.listCol} ref={listColRef}>
            {todayNotifs.length > 0 && (
              <>
                <div className={styles.sectionLabel}>오늘</div>
                {todayNotifs.map(n => renderCard(n))}
              </>
            )}
            {weekNotifs.length > 0 && (
              <>
                <div className={styles.divider}></div>
                <div className={styles.sectionLabel}>이번 주</div>
                {weekNotifs.map(n => renderCard(n))}
              </>
            )}
            {filtered.length === 0 && <div className={styles.empty}>해당 알림이 없어요</div>}
          </div>

          {/* 오른쪽: 발송 이력 */}
          <div className={styles.historyCol} ref={historyColRef}>
            <div className={styles.historyColHeader}>
              <div className={styles.historyColTitle}>
                {selected ? `${selected.customer.name} 님 발송 이력` : '발송 이력'}
              </div>
              <button
                className={styles.smsBtn}
                onClick={() => {
                  if (historyColRef.current) {
                    const rect = historyColRef.current.getBoundingClientRect()
                    setPopupTop(rect.top + 58)
                    setPopupRight(window.innerWidth - rect.right)
                    setPopupHeight(rect.height - 58)
                  }
                  setPanelOpen(true)
                }}
                disabled={!selected}
                style={!selected ? {opacity: 0.4, cursor: 'not-allowed'} : {}}
              >
                📱 SMS 보내기
              </button>
            </div>
            {filteredMsgs.length === 0 ? (
              <div className={styles.historyEmpty}>
                <div style={{fontSize:24, marginBottom:6}}>📭</div>
                <div>{selected ? '발송 이력이 없어요' : '알림을 선택하면\n해당 고객의 발송 이력을 볼 수 있어요'}</div>
              </div>
            ) : filteredMsgs.map((m: any) => (
              <div key={m.id} className={styles.historyItem}>
                <div className={styles.historyItemRow}>
                  <span className={[styles.badge, m.is_sent ? styles.badgeTeal : styles.badgeGray].join(' ')}>{m.is_sent ? '발송' : '복사'}</span>
                  <span className={styles.historyItemType}>
                    {m.message_type === 'birthday' ? '생일' : m.message_type === 'nearDone' ? '완납임박' : m.message_type === 'gap' ? '보장공백' : m.message_type === 'expiry' ? '만기임박' : m.message_type}
                  </span>
                  <span className={styles.historyItemDate}>{new Date(m.created_at).toLocaleDateString('ko-KR', {month:'numeric', day:'numeric'})}</span>
                </div>
                <div className={styles.historyItemScript}>{m.sent_script}</div>
              </div>
              ))}

            {/* 폰 블록 팝업 - historyCol 기준 우측 상단 */}
            {panelOpen && selected && (
              <>
                <div className={styles.phoneOverlay} onClick={() => setPanelOpen(false)} />
          <div className={styles.phoneSlideUp} style={{ top: popupTop, right: popupRight, height: popupHeight }}>
            <div className={styles.phonePanel}>
            {/* 닫기 */}
            <div className={styles.popupHeader}>
              <span className={styles.popupTitle}>문자 미리보기</span>
              <button className={styles.popupClose} onClick={() => setPanelOpen(false)}>✕</button>
            </div>

            {/* 수신자 */}
            <div className={styles.recipientRow}>
              <div className={styles.avatar}>{selected.customer.name.slice(0,2)}</div>
              <div>
                <div className={styles.recipientName}>{selected.customer.name}</div>
                <div className={styles.recipientPhone}>{selected.customer.phone || '연락처 없음'}</div>
              </div>
            </div>

            {/* AI 배지 */}
            <div className={styles.aiRow}>
              <div className={styles.aiBadge}>
                <div className={[styles.aiDot, aiLoading ? styles.aiDotPulse : ''].join(' ')}></div>
                AI 추천 스크립트
              </div>
              {aiLoading && <span className={styles.aiLoading}>생성 중...</span>}
            </div>
            <div className={styles.aiDesc}>상황에 맞는 문자를 추천해 드려요. 자유롭게 수정 후 발송하세요 😊</div>

            {/* 톤 버튼 */}
            <div className={styles.toneRow}>
              {TONES.map(t => (
                <button key={t} className={[styles.toneBtn, tone === t ? styles.toneBtnActive : ''].join(' ')} onClick={() => changeTone(t)}>{t}</button>
              ))}
            </div>

            {/* 스마트폰 목업 */}
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch}></div>
              <div className={styles.phoneScreen}>
                <div className={styles.statusBar}>
                  <span className={styles.statusTime}>9:41</span>
                  <span className={styles.statusIcons}>●●● 🔋</span>
                </div>
                <div className={styles.smsHeader}>
                  <div className={styles.smsName}>{selected.customer.name}</div>
                  <div className={styles.smsType}>문자 메시지</div>
                </div>
                <div className={styles.smsBody}>
                  <div className={styles.bubbleWrap}>
                    <div className={styles.bubble}>
                      <textarea
                        ref={textareaRef}
                        className={styles.bubbleEdit}
                        value={scriptText}
                        onChange={e => setScriptText(e.target.value)}
                        rows={8}
                      />
                      <div className={styles.bubbleTime}>오전 9:41</div>
                    </div>
                  </div>
                </div>
                <div className={styles.emojiRow}>
                  {EMOJIS.map(e => (
                    <button key={e} className={styles.emojiBtn} onClick={() => insertEmoji(e)}>{e}</button>
                  ))}
                </div>
              </div>
              <div className={styles.phoneHome}></div>
            </div>

            <div className={styles.charCount}>{scriptText.length}자</div>

            <div className={styles.actionBtns}>
              <button className={styles.btnSend} onClick={handleSend} disabled={sending}>{sending ? '발송 중...' : '발송하기'}</button>
              <button className={styles.btnCopy} onClick={handleCopy}>복사</button>
            </div>
          </div>
          </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
