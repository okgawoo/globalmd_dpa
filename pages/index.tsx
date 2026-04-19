import { useEffect, useState } from 'react'
import SmsSlidePanel from '../components/SmsSlide'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import styles from '../styles/Dashboard.module.css'

function calcPaymentRate(ct: any): number {
  if (ct.payment_status === '완납') return 100
  if (ct.contract_start && ct.payment_years) {
    const match = ct.payment_years.match(/(\d+)년/)
    if (match) {
      const totalMonths = parseInt(match[1]) * 12
      const [year, month] = ct.contract_start.split('.').map(Number)
      if (year && month) {
        const now = new Date()
        const paidMonths = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1
        return Math.min(Math.round(Math.max(0, paidMonths) / totalMonths * 100), 100)
      }
    }
  }
  return ct.payment_rate || 0
}

export default function Dashboard() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [todoExpanded, setTodoExpanded] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCustomer, setSmsCustomer] = useState<any>(null)
  const [agentId, setAgentId] = useState<string>('')
  const [meetingExpanded, setMeetingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [calOpen, setCalOpen] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [agentName, setAgentName] = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentRole, setAgentRole] = useState('')
  const [agentPlan, setAgentPlan] = useState('')
  const [agentDbId, setAgentDbId] = useState('')
  const [agentSlug, setAgentSlug] = useState('')
  const [seenNearDone, setSeenNearDone] = useState<string[]>([])
  const [seenBirthday, setSeenBirthday] = useState<string[]>([])
  const [seenGap, setSeenGap] = useState<string[]>([])
  const [unreadNotice, setUnreadNotice] = useState<any>(null)
  const [smsStats, setSmsStats] = useState({ total: 0, success: 0, failed: 0 })
  const [meetingStats, setMeetingStats] = useState({ done: 0, scheduled: 0, cancelled: 0 })

  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const mobileDateStr = now.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })

  useEffect(() => {
    fetchAll()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setAgentEmail(data.user.email || '')
        supabase.from('dpa_agents').select('*').eq('user_id', data.user.id).single()
          .then(({ data: agent }) => {
            if (agent) {
              setAgentName(agent.name)
              setAgentDbId(agent.id)
              setAgentSlug(agent.slug || agent.id)
              setAgentPlan(agent.settings?.plan || 'basic')
              setAgentRole(agent.role || '')
              fetchUnreadNotice(agent.id)
            }
          })
      }
    })
    setSeenNearDone(JSON.parse(localStorage.getItem('dpa_seen_nearDone') || '[]'))
    setSeenBirthday(JSON.parse(localStorage.getItem('dpa_seen_birthday') || '[]'))
    setSeenGap(JSON.parse(localStorage.getItem('dpa_seen_gap') || '[]'))
  }, [])

  async function fetchUnreadNotice(myAgentId: string) {
    const { data: notices } = await supabase
      .from('push_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    if (!notices || notices.length === 0) return
    const latest = notices[0]
    const { data: readRecord } = await supabase
      .from('push_notification_reads')
      .select('id')
      .eq('notification_id', latest.id)
      .eq('agent_id', myAgentId)
      .maybeSingle()
    if (!readRecord) {
      setUnreadNotice({ ...latest, _agentId: myAgentId })
    }
  }

  async function markNoticeRead() {
    if (!unreadNotice) return
    await supabase.from('push_notification_reads').insert({
      notification_id: unreadNotice.id,
      agent_id: unreadNotice._agentId,
    })
    setUnreadNotice(null)
  }

  const isNewNearDone = (customerId: string) => !seenNearDone.includes(customerId)
  const isNewBirthday = (customerId: string) => !seenBirthday.includes(customerId)
  const isNewGap = (customerId: string) => !seenGap.includes(customerId)

  const handleNearDoneClick = () => {
    const ids = nearDoneCustomers.map((c: any) => c.id)
    const updated = [...seenNearDone, ...ids].filter((v, i, a) => a.indexOf(v) === i)
    localStorage.setItem('dpa_seen_nearDone', JSON.stringify(updated))
    setSeenNearDone(updated)
    router.push('/customers?sort=완납임박')
  }
  const handleBirthdayClick = () => {
    const ids = birthdayCustomers.map((c: any) => c.id)
    const updated = [...seenBirthday, ...ids].filter((v, i, a) => a.indexOf(v) === i)
    localStorage.setItem('dpa_seen_birthday', JSON.stringify(updated))
    setSeenBirthday(updated)
    router.push('/customers?sort=생일임박')
  }
  const handleGapClick = () => {
    const ids = gapCustomers.map((c: any) => c.id)
    const updated = [...seenGap, ...ids].filter((v, i, a) => a.indexOf(v) === i)
    localStorage.setItem('dpa_seen_gap', JSON.stringify(updated))
    setSeenGap(updated)
    router.push('/customers?sort=보장공백')
  }

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }
  const calFirst = new Date(calYear, calMonth, 1).getDay()
  const calLast = new Date(calYear, calMonth + 1, 0).getDate()
  const calMonthStr = new Date(calYear, calMonth).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const agentId = user?.id
    if (agentId) setAgentId(agentId)

    const todayStr = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 병렬로 한번에 불러오기
    const [custsRes, contsRes, meetsRes] = await Promise.all([
      supabase.from('dpa_customers').select('id, name, age, gender, birth_date, phone, customer_type, created_at').eq('agent_id', agentId),
      supabase.from('dpa_contracts').select('id, customer_id, agent_id, company, product_name, insurance_type, monthly_fee, payment_status, payment_years, payment_rate, contract_start').eq('agent_id', agentId),
      supabase.from('dpa_meetings').select('*').eq('agent_id', agentId).gte('meeting_date', todayStr).lte('meeting_date', nextWeek).neq('status', '취소').order('meeting_date', { ascending: true })
    ])

    const custs = custsRes.data || []
    const conts = contsRes.data || []

    // coverages는 계약 ID 기준으로 필터링 (전체 X)
    let covs: any[] = []
    if (conts.length > 0) {
      const contractIds = conts.map((c: any) => c.id)
      const { data: covsData } = await supabase
        .from('dpa_coverages')
        .select('id, contract_id, category, brain_coverage_type, amount')
        .in('contract_id', contractIds)
      covs = covsData || []
    }

    setCustomers(custs)
    setContracts(conts)
    setCoverages(covs)
    setMeetings(meetsRes.data || [])

    // 오늘 문자 발송 현황
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data: smsRows } = await supabase
      .from('dpa_messages')
      .select('status')
      .eq('agent_id', agentId)
      .gte('sent_at', todayStart.toISOString())
    const sms = { total: 0, success: 0, failed: 0 }
    ;(smsRows || []).forEach((m: any) => {
      sms.total++
      if (m.status === 'failed') sms.failed++
      else sms.success++
    })
    setSmsStats(sms)

    // 이번달 미팅 현황 (완료 / 예정 / 취소)
    const firstDay = new Date()
    firstDay.setDate(1); firstDay.setHours(0, 0, 0, 0)
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0)
    const firstStr = firstDay.toISOString().split('T')[0]
    const lastStr = lastDay.toISOString().split('T')[0]
    const { data: monthMeetings } = await supabase
      .from('dpa_meetings')
      .select('status')
      .eq('agent_id', agentId)
      .gte('meeting_date', firstStr)
      .lte('meeting_date', lastStr)
    const mStats = { done: 0, scheduled: 0, cancelled: 0 }
    ;(monthMeetings || []).forEach((m: any) => {
      if (m.status === '완료') mStats.done++
      else if (m.status === '취소') mStats.cancelled++
      else mStats.scheduled++
    })
    setMeetingStats(mStats)

    setLoading(false)
  }

  const nearDoneContracts = contracts.filter(c => calcPaymentRate(c) >= 90 && c.payment_status !== '완납')
  const nearDoneCustomers = customers.filter(c => nearDoneContracts.some(ct => ct.customer_id === c.id))

  const gapCustomers = customers.filter(c => {
    const custContracts = contracts.filter(ct => ct.customer_id === c.id)
    const custCoverages = coverages.filter(cv => custContracts.some(ct => ct.id === cv.contract_id))
    const brainTypes = custCoverages.filter(cv => cv.category === '뇌혈관').map(cv => cv.brain_coverage_type)
    return brainTypes.length === 0 || brainTypes.every(t => t === '뇌출혈')
  })

  const fullCustomers = customers.filter(c => {
    const custContracts = contracts.filter(ct => ct.customer_id === c.id)
    const custCoverages = coverages.filter(cv => custContracts.some(ct => ct.id === cv.contract_id))
    const hasBrain = custCoverages.some(cv => cv.category === '뇌혈관' && cv.brain_coverage_type === '뇌혈관')
    const hasCancer = custCoverages.some(cv => cv.category === '암진단')
    const hasCare = custCoverages.some(cv => cv.category === '간병')
    return hasBrain && hasCancer && hasCare
  })

  const birthdayCustomers = customers.filter(c => {
    if (!c.birth_date) return false
    const birth = new Date(c.birth_date)
    return birth.getMonth() === now.getMonth() && Math.abs(birth.getDate() - now.getDate()) <= 7
  })

  const thisMonth = now.getMonth()
  const newThisMonth = customers.filter(c => new Date(c.created_at).getMonth() === thisMonth).length
  const totalMonthly = contracts.reduce((s, c) => s + (c.monthly_fee || 0), 0)

  // 만기임박: expiry_age 기준, 현재 나이 + 1년 이내 만기
  const expiryCustomers = customers.filter(c => {
    const custContracts = contracts.filter(ct => ct.customer_id === c.id && ct.payment_status !== '완납')
    return custContracts.some(ct => {
      if (!ct.expiry_age || !c.birth_date) return false
      const birth = new Date(c.birth_date)
      const currentAge = now.getFullYear() - birth.getFullYear()
      return ct.expiry_age <= currentAge + 1 && ct.expiry_age > currentAge
    })
  })

  // 계약기념일: contract_start 기준 이번달
  const anniversaryCustomers = customers.filter(c => {
    const custContracts = contracts.filter(ct => ct.customer_id === c.id)
    return custContracts.some(ct => {
      if (!ct.contract_start) return false
      const parts = ct.contract_start.split('.')
      if (parts.length < 2) return false
      const contractMonth = parseInt(parts[1])
      return contractMonth === (now.getMonth() + 1)
    })
  })

  // 장기미연락: meetings 기준 90일 이상 미팅 없는 마이고객
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const noContactCustomers = customers.filter(c => {
    if (c.customer_type !== 'existing') return false
    const custMeetings = meetings.filter(m => m.customer_id === c.id)
    if (custMeetings.length === 0) return true
    const lastMeeting = custMeetings.reduce((latest: any, m: any) => {
      return new Date(m.meeting_date) > new Date(latest.meeting_date) ? m : latest
    })
    return new Date(lastMeeting.meeting_date) < ninetyDaysAgo
  })

  const kakaoTargets = [
    ...nearDoneCustomers.map(c => ({ ...c, reason: '완납 임박', tag: 'warn' })),
    ...gapCustomers.filter(c => !nearDoneCustomers.find(n => n.id === c.id)).map(c => ({ ...c, reason: '보장 공백', tag: 'red' })),
    ...birthdayCustomers.map(c => ({ ...c, reason: '생일 축하 🎂', tag: 'green' })),
  ]

  const getScript = (c: any) => {
    if (c.tag === 'warn') return `안녕하세요 ${c.name} 님! 😊\n\n납입이 거의 완료되어 가고 있어요! 🎉\n완납 후 더 유리한 조건으로 재설계할 수 있는 기회가 생겨요.\n잠깐 시간 되실 때 말씀 나눠봐요! 😊`
    if (c.tag === 'green') return `안녕하세요 ${c.name} 님! 😊\n\n생일 축하드려요! 🎂🎉\n항상 건강하고 행복한 날 되시길 바랍니다!\n무엇이든 필요하신 게 있으시면 언제든지 연락주세요 😊`
    return `안녕하세요 ${c.name} 님! 😊\n\n최근 뇌혈관 질환 관련 뉴스가 많더라고요.\n${c.name} 님 보험을 확인해보니 뇌혈관 전체 보장이 빠져있어서 한번 말씀드리고 싶었어요.\n잠깐 시간 되실 때 통화 가능하실까요? 📞`
  }

  const todoItems: { id: string; icon: string; text: string; badge: string; badgeColor: string; badgeBg: string; sort: string }[] = []
  birthdayCustomers.slice(0, 5).forEach(c => {
    const diff = Math.abs(new Date(c.birth_date).getDate() - now.getDate())
    todoItems.push({ id: c.id, icon: '🎂', text: `${c.name}고객 생일`, badge: diff === 0 ? 'D-day' : `D-${diff}`, badgeColor: '#EF9F27', badgeBg: '#FEF3E2', sort: '생일임박' })
  })
  nearDoneCustomers.slice(0, 5).forEach(c => {
    const ct = nearDoneContracts.find((ct: any) => ct.customer_id === c.id)
    todoItems.push({ id: c.id, icon: '🔥', text: `${c.name}고객 완납임박`, badge: `${ct ? calcPaymentRate(ct) : 0}%`, badgeColor: '#E24B4A', badgeBg: '#FCEBEB', sort: '완납임박' })
  })
  gapCustomers.slice(0, 5).forEach(c => {
    todoItems.push({ id: c.id, icon: '⚠️', text: `${c.name}고객 보장공백`, badge: '확인', badgeColor: '#E24B4A', badgeBg: '#FCEBEB', sort: '보장공백' })
  })
  expiryCustomers.slice(0, 5).forEach(c => {
    todoItems.push({ id: c.id, icon: '📋', text: `${c.name}고객 만기임박`, badge: '만기', badgeColor: '#7C3AED', badgeBg: '#EDE9FE', sort: '만기임박' })
  })
  anniversaryCustomers.slice(0, 5).forEach(c => {
    todoItems.push({ id: c.id, icon: '🗓️', text: `${c.name}고객 계약기념일`, badge: '기념일', badgeColor: '#0891B2', badgeBg: '#E0F2FE', sort: '계약기념일' })
  })
  noContactCustomers.slice(0, 5).forEach(c => {
    todoItems.push({ id: c.id, icon: '📵', text: `${c.name}고객 장기미연락`, badge: '연락필요', badgeColor: '#6B7280', badgeBg: '#F3F4F6', sort: '장기미연락' })
  })

  const formatMonthly = (val: number) => {
    if (val >= 100000000) {
      const uk = Math.floor(val / 100000000)
      const man = Math.floor((val % 100000000) / 10000)
      return man > 0 ? `${uk}억 ${man}만` : `${uk}억`
    }
    if (val >= 10000) return `${Math.floor(val / 10000).toLocaleString()}만`
    return val.toLocaleString()
  }

  // 웹 대시보드용 월납입 합계 포맷 (한 줄 강제용)
  // 1억 미만: "N만", 1억 이상: "N.N억"
  const formatMonthlyWeb = (val: number) => {
    if (val >= 100000000) return `${(val / 100000000).toFixed(1)}억`
    if (val >= 10000) return `${Math.floor(val / 10000).toLocaleString()}만`
    return val.toLocaleString()
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>
      {/* 공지사항 팝업 */}
      {unreadNotice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 20, maxWidth: 320, width: '100%', overflow: 'hidden', textAlign: 'center', border: '0.5px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <img src="/icons/icon-192x192.png" style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 10, letterSpacing: '-0.3px' }}>{unreadNotice.title}</div>
              <div style={{ fontSize: 14, color: '#444', lineHeight: 1.75, whiteSpace: 'pre-line', textAlign: 'left' }}>{unreadNotice.body}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
                {new Date(unreadNotice.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ padding: '16px 24px 22px' }}>
              <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 14 }}>
                <button onClick={markNoticeRead} style={{ width: '100%', padding: '12px 0', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {smsOpen && smsCustomer && (
        <SmsSlidePanel
          isOpen={smsOpen}
          onClose={() => { setSmsOpen(false); setSmsCustomer(null) }}
          customer={smsCustomer}
          meetings={meetings}
          contracts={contracts}
          agentId={agentId}
        />
      )}

      {/* ── 모바일 전용 대시보드 ── */}
      <div className={styles.mobileDash} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>

        {/* 헤더 */}
        <div className={styles.mobileHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.25)"/>
                <path d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                <path d="M20 30C17.5 30 15 28 15 25C15 22 17 20 20 20C23 20 25 22 25 25" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="20" cy="20" r="2.5" fill="white"/>
              </svg>
              <p style={{ margin: 0, fontSize: 13, color: 'white', fontWeight: 700, letterSpacing: 1 }}>DPA</p>
            </div>
            <p className={styles.mobileGreet}>안녕하세요 👋 {agentName || ''} {agentEmail === 'admin@dpa.com' ? '대표님' : '설계사님'}</p>
          </div>
          <div className={styles.mobileDateBadge} style={{ color: 'white', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{mobileDateStr}</p>
            {agentPlan && (
              <span style={{
                display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 8,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                background: 'rgba(255,255,255,0.25)', color: 'white',
              }}>{agentPlan.toUpperCase()}</span>
            )}
          </div>
        </div>

        {/* 이슈 요약 카드 */}
        <div className={styles.mobileCard} style={{ marginTop: 8 }}>
          <div className={styles.mobileCardHeader}>
            <span className={styles.mobileCardTitle} style={{ color: '#1D9E75' }}>오늘의 할일</span>
            <span className={styles.mobileCardLink} onClick={(e) => { e.preventDefault(); router.push('/customers') }}>전체보기</span>
          </div>
          <div className={styles.mobileCardBody}>
          {(() => {
            // 이슈별로 그룹화
            const issueGroups = [
              {
                sort: '생일임박',
                icon: '🎂',
                label: '생일 임박',
                items: todoItems.filter(i => i.sort === '생일임박'),
                badgeColor: '#EF9F27',
                badgeBg: '#FEF3E2',
              },
              {
                sort: '완납임박',
                icon: '🔥',
                label: '완납 임박',
                items: todoItems.filter(i => i.sort === '완납임박'),
                badgeColor: '#E24B4A',
                badgeBg: '#FCEBEB',
              },
              {
                sort: '보장공백',
                icon: '⚠️',
                label: '보장 공백',
                items: todoItems.filter(i => i.sort === '보장공백'),
                badgeColor: '#E24B4A',
                badgeBg: '#FCEBEB',
              },
              {
                sort: '만기임박',
                icon: '📋',
                label: '만기 임박',
                items: todoItems.filter(i => i.sort === '만기임박'),
                badgeColor: '#7C3AED',
                badgeBg: '#EDE9FE',
              },
              {
                sort: '계약기념일',
                icon: '🗓️',
                label: '계약 기념일',
                items: todoItems.filter(i => i.sort === '계약기념일'),
                badgeColor: '#0891B2',
                badgeBg: '#E0F2FE',
              },
              {
                sort: '장기미연락',
                icon: '📵',
                label: '장기 미연락',
                items: todoItems.filter(i => i.sort === '장기미연락'),
                badgeColor: '#6B7280',
                badgeBg: '#F3F4F6',
              },
            ]

            return (
              <>
                {issueGroups.slice(0, 3).map((group, i) => (
                  <div key={i} className={styles.mobileTodoRow}
                    onClick={(e) => { e.preventDefault(); router.push(`/customers?sort=${group.sort}`) }}
                    style={{ cursor: 'pointer' }}>
                    <span className={styles.mobileTodoIcon}>{group.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className={styles.mobileTodoText}>{group.label}</span>
                    </div>
                    <span className={styles.mobileBadge} style={{ color: group.badgeColor, background: group.badgeBg, fontWeight: 700 }}>
                      {group.items.length}명
                    </span>
                  </div>
                ))}
                {issueGroups.length > 3 && (
                  <div style={{ overflow: 'hidden', maxHeight: todoExpanded ? `${(issueGroups.length - 3) * 48}px` : '0px', transition: 'max-height 0.35s ease' }}>
                    {issueGroups.slice(3).map((group, i) => (
                      <div key={i + 3} className={styles.mobileTodoRow}
                        onClick={(e) => { e.preventDefault(); router.push(`/customers?sort=${group.sort}`) }}
                        style={{ cursor: 'pointer' }}>
                        <span className={styles.mobileTodoIcon}>{group.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className={styles.mobileTodoText}>{group.label}</span>
                        </div>
                        <span className={styles.mobileBadge} style={{ color: group.badgeColor, background: group.badgeBg, fontWeight: 700 }}>
                          {group.items.length}명
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {issueGroups.length > 3 && (
                  <div onClick={() => setTodoExpanded(v => !v)} style={{ textAlign: 'center', padding: '6px 0', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>
                    {todoExpanded ? '︿' : '﹀'}
                  </div>
                )}
              </>
            )
          })()}
          </div>
        </div>

        {/* 미팅 일정 */}
        <div className={styles.mobileCard}>
          <div className={styles.mobileCardHeader}>
            <span className={styles.mobileCardTitle}>영업 일정</span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:'#1D9E75',cursor:'pointer',padding:'2px 8px',borderRadius:6}} onClick={(e) => { e.preventDefault(); router.push('/sales?tab=meeting&showForm=true') }}>+ 직접추가</span>
              <span className={styles.mobileCardLink} onClick={(e) => { e.preventDefault(); router.push('/sales?tab=meeting&sub=week') }}>전체보기</span>
            </div>
          </div>
          <div className={styles.mobileCardBody}>
          {meetings.length === 0 ? (
            <p className={styles.mobileEmpty} style={{ padding: '8px 0' }}>오늘 미팅이 없어요 😊</p>
          ) : (meetingExpanded ? meetings : meetings.slice(0,3)).map((m, i) => {
            const customer = customers.find(c => c.id === m.customer_id)
            const name = customer?.name || '이름 없음'
            const badgeText = customer?.customer_type === 'prospect' ? '관심고객' : '마이고객'
            const badgeColor = '#1D4ED8'
            const badgeBg = '#EFF6FF'
            const dateObj = new Date(m.meeting_date)
            const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
            const timeLabel = m.meeting_time ? ` ${m.meeting_time}` : ''
            return (
              <div key={i} className={styles.mobileTodoRow} onClick={(e) => { e.preventDefault(); router.push(`/sales?tab=meeting&sub=today&meetingId=${m.id}`) }} style={{ cursor: 'pointer' }}>
                <span className={styles.mobileTodoIcon}>🤝</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={styles.mobileTodoText}>{name}고객</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: badgeBg, color: badgeColor, marginLeft: 4, fontWeight: 600 }}>{badgeText}</span>
                </div>
                {customer && <button onClick={e => { e.stopPropagation(); setSmsCustomer(customer); setSmsOpen(true) }} style={{fontSize:11,padding:'2px 7px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-secondary)',cursor:'pointer',whiteSpace:'nowrap',marginLeft:4}}>문자</button>}
                <span className={styles.mobileBadge} style={{ color: 'var(--text-primary)', background: 'var(--bg-card)', fontSize: 11, whiteSpace: 'nowrap' }}>{dateLabel}{timeLabel}</span>
              </div>
            )
          })}
          {meetings.length > 3 && (
            <div style={{overflow:'hidden',maxHeight:meetingExpanded?`${(meetings.length-3)*56}px`:'0px',transition:'max-height 0.35s ease'}}>
              {meetings.slice(3).map((m, i) => {
                const customer = customers.find(c => c.id === m.customer_id)
                const name = customer?.name || '이름 없음'
                const badgeText = customer?.customer_type === 'prospect' ? '관심고객' : '마이고객'
                const badgeColor = '#1D4ED8'
                const badgeBg = '#EFF6FF'
                const dateObj = new Date(m.meeting_date)
                const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
                const timeLabel = m.meeting_time ? ` ${m.meeting_time}` : ''
                return (
                  <div key={i+3} className={styles.mobileTodoRow} onClick={(e) => { e.preventDefault(); router.push(`/sales?tab=meeting&sub=today&meetingId=${m.id}`) }} style={{cursor:'pointer'}}>
                    <span className={styles.mobileTodoIcon}>🤝</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span className={styles.mobileTodoText}>{name}고객</span>
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:badgeBg,color:badgeColor,marginLeft:4,fontWeight:600}}>{badgeText}</span>
                    </div>
                    {customer && <button onClick={e => { e.stopPropagation(); setSmsCustomer(customer); setSmsOpen(true) }} style={{fontSize:11,padding:'2px 7px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-secondary)',cursor:'pointer',whiteSpace:'nowrap',marginLeft:4}}>문자</button>}
                    <span className={styles.mobileBadge} style={{color:'var(--text-primary)',background:'var(--bg-card)',fontSize:11,whiteSpace:'nowrap'}}>{dateLabel}{timeLabel}</span>
                  </div>
                )
              })}
            </div>
          )}
          {meetings.length > 3 && (
            <div onClick={() => setMeetingExpanded(v => !v)} style={{textAlign:'center',padding:'6px 0',cursor:'pointer',color:'var(--text-muted)',fontSize:16}}>
              {meetingExpanded ? '︿' : '﹀'}
            </div>
          )}
          </div>
        </div>

        {/* 메뉴 2x3 */}
        <div className={styles.mobileGrid2}>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); router.push('/input') }} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>데이터 입력</p>
              <p className={styles.mobileMenuSub}>복붙·명함·수동</p>
            </div>
            <p className={styles.mobileMenuName} style={{ margin: 0, color: '#E24B4A' }}>AI분석</p>
          </button>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); router.push('/customers') }} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>고객 관리</p>
              <p className={styles.mobileMenuSub}>마이고객·관심고객</p>
            </div>
            <p className={styles.mobileMenuName} style={{ margin: 0, color: '#E24B4A' }}>{customers.length}명</p>
          </button>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); router.push('/notifications') }} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>문자 발송</p>
              <p className={styles.mobileMenuSub}>AI추천·단체문자</p>
            </div>
            <p className={styles.mobileMenuName} style={{ margin: 0, color: '#E24B4A' }}>{nearDoneCustomers.length + gapCustomers.length + birthdayCustomers.length}건</p>
          </button>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); router.push('/sales') }} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>영업 관리</p>
              <p className={styles.mobileMenuSub}>AI추천·미팅·이력</p>
            </div>
            <p className={styles.mobileMenuName} style={{ margin: 0, color: '#E24B4A' }}>미팅{meetings.length}건</p>
          </button>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); alert('준비중입니다 😊') }} style={{ justifyContent: 'space-between', opacity: 0.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>미팅 리포트</p>
              <p className={styles.mobileMenuSub}>&nbsp;</p>
            </div>
            <p className={styles.mobileMenuSub} style={{ color: '#999', margin: 0 }}>(준비중)</p>
          </button>
          <button className={styles.mobileMenuBtn} onClick={(e) => { e.preventDefault(); alert('준비중입니다 😊') }} style={{ justifyContent: 'space-between', opacity: 0.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p className={styles.mobileMenuName}>보장 분석</p>
              <p className={styles.mobileMenuSub}>&nbsp;</p>
            </div>
            <p className={styles.mobileMenuSub} style={{ color: '#999', margin: 0 }}>(준비중)</p>
          </button>
        </div>

        {/* 핵심 지표 */}
        <div className={styles.mobileMetrics}>
          <div className={styles.mobileMetricItem} style={{ flex: '0 0 25%' }}>
            <p className={styles.mobileMetricVal}>{customers.length}</p>
            <p className={styles.mobileMetricLabel}>총 고객</p>
          </div>
          <div className={styles.mobileMetricDivider} />
          <div className={styles.mobileMetricItem} style={{ flex: '0 0 25%' }}>
            <p className={styles.mobileMetricVal}>{newThisMonth}</p>
            <p className={styles.mobileMetricLabel}>이번달 신규</p>
          </div>
          <div className={styles.mobileMetricDivider} />
          <div className={styles.mobileMetricItem} style={{ flex: 1 }}>
            <p className={styles.mobileMetricVal}>{formatMonthly(totalMonthly)}</p>
            <p className={styles.mobileMetricLabel}>월납입 합계</p>
          </div>
        </div>

        {/* 하단 아이콘 4개 */}
        <div className={styles.mobileBottomIcons}>
          <button className={styles.mobileIconBtn} onClick={(e) => { e.preventDefault(); router.push('/card') }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
            <span className={styles.mobileIconLabel}>전자명함</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={(e) => { e.preventDefault(); router.push('/newsletter') }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className={styles.mobileIconLabel}>뉴스레터</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={(e) => { e.preventDefault(); router.push('/sales?tab=flow') }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span className={styles.mobileIconLabel}>이력추적</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={(e) => { e.preventDefault(); router.push('/settings') }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className={styles.mobileIconLabel}>설정</span>
          </button>
        </div>
      </div>

      {/* ── 웹(데스크탑) ERP 대시보드 ── */}
      <div className={styles.desktopDash}>
        <div className={styles.webDash}>
          {/* 상단 초록 헤더 바 — 좌측 인사말, 우측 날짜+요금제 뱃지 */}
          <div
            className={styles.webTopBar}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#1D9E75',
              padding: '12px 16px',
              borderBottom: 'none',
              borderRadius: 8,
            }}
          >
            <span className={styles.webTopGreet} style={{ color: '#ffffff' }}>
              안녕하세요, {agentName ? `${agentName} ` : ''}{agentRole === 'admin' ? '대표님' : '설계사님'}
            </span>
            <div className={styles.webTopDateWrap} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.webTopDate} style={{ color: '#ffffff' }}>{dateStr}</span>
              {agentPlan && (
                <span
                  className={styles.webTopPlan}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    color: '#ffffff',
                    padding: '2px 10px',
                    borderRadius: 6,
                  }}
                >
                  {agentPlan.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* 1행: 오늘의 할일 + 오늘 영업일정 (2열) — 두 카드 콘텐츠 맞춰 자동 높이 + 좌우 동일 높이 */}
          <div className={styles.webRow2} style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
            <div className={styles.webCard} style={{ flex: 1, height: 'auto', minHeight: 280 }}>
              <div className={styles.webCardHeader}>
                <div className={styles.webCardTitleGroup}>
                  <span className={styles.webCardAccent}></span>
                  <span className={styles.webCardTitle}>오늘의 할일</span>
                </div>
                <button className={styles.webCardLink} onClick={() => router.push('/customers')}>전체보기</button>
              </div>
              <div className={styles.webCardBody}>
              {(() => {
                const issueGroups = [
                  { sort: '생일임박', icon: '🎂', label: '생일 임박', count: birthdayCustomers.length, color: '#EF9F27', bg: '#FEF3E2' },
                  { sort: '완납임박', icon: '🔥', label: '완납 임박', count: nearDoneCustomers.length, color: '#E24B4A', bg: '#FCEBEB' },
                  { sort: '보장공백', icon: '⚠️', label: '보장 공백', count: gapCustomers.length, color: '#E24B4A', bg: '#FCEBEB' },
                  { sort: '만기임박', icon: '📋', label: '만기 임박', count: expiryCustomers.length, color: '#7C3AED', bg: '#EDE9FE' },
                  { sort: '계약기념일', icon: '🗓️', label: '계약 기념일', count: anniversaryCustomers.length, color: '#0891B2', bg: '#E0F2FE' },
                  { sort: '장기미연락', icon: '📵', label: '장기 미연락', count: noContactCustomers.length, color: '#6B7280', bg: '#F3F4F6' },
                ]
                return issueGroups.map(g => (
                  <div key={g.sort} className={styles.webListRow} onClick={() => router.push(`/customers?sort=${g.sort}`)}>
                    <span className={styles.webListIcon}>{g.icon}</span>
                    <span className={styles.webListLabel}>{g.label}</span>
                    <span className={styles.webBadge} style={{ color: g.color, background: g.bg }}>{g.count}명</span>
                  </div>
                ))
              })()}
              </div>
            </div>

            <div className={styles.webCard} style={{ flex: 1, height: 'auto', minHeight: 280 }}>
              <div className={styles.webCardHeader}>
                <div className={styles.webCardTitleGroup}>
                  <span className={styles.webCardAccent}></span>
                  <span className={styles.webCardTitle}>오늘 영업일정</span>
                </div>
                <button className={styles.webCardLink} onClick={() => router.push('/sales?tab=meeting&sub=today')}>전체보기</button>
              </div>
              <div className={styles.webCardBody}>
              {(() => {
                const todayDateStr = new Date().toISOString().split('T')[0]
                const todayMeetings = meetings.filter(m => (m.meeting_date || '').split('T')[0] === todayDateStr).slice(0, 6)
                if (todayMeetings.length === 0) return <div className={styles.webEmpty}>오늘 미팅이 없어요 😊</div>
                return todayMeetings.map(m => {
                  const cust = customers.find(c => c.id === m.customer_id)
                  const name = cust?.name || '이름 없음'
                  const badgeText = cust?.customer_type === 'prospect' ? '관심고객' : '마이고객'
                  return (
                    <div key={m.id} className={styles.webListRow} style={{ padding: '6px 0' }} onClick={() => router.push(`/sales?tab=meeting&sub=today&meetingId=${m.id}`)}>
                      <span className={styles.webListIcon}>🤝</span>
                      <span className={styles.webListLabel}>{name} 고객
                        <span className={styles.webBadge} style={{ color: '#1D4ED8', background: '#EFF6FF', marginLeft: 8 }}>{badgeText}</span>
                      </span>
                      <span className={styles.webListMeta}>{m.meeting_time || '시간 미정'}</span>
                    </div>
                  )
                })
              })()}
              </div>
            </div>
          </div>

          {/* 2행: 통계 카드 6열 (총고객 / 이번달신규 / 보험계약 / 완납임박 / 보장공백 / 월납입합계) */}
          <div className={styles.webStats4}>
            <div className={styles.webStatCard} style={{ borderTopColor: '#378ADD' }} onClick={() => router.push('/customers')}>
              <div className={styles.webStatLabel}>총 고객</div>
              <div className={styles.webStatValue}>{customers.length}</div>
            </div>
            <div className={styles.webStatCard} style={{ borderTopColor: '#8B5CF6' }} onClick={() => router.push('/customers')}>
              <div className={styles.webStatLabel}>이번달 신규</div>
              <div className={styles.webStatValue}>{newThisMonth}</div>
            </div>
            <div className={styles.webStatCard} style={{ borderTopColor: '#1D9E75' }} onClick={() => router.push('/customers')}>
              <div className={styles.webStatLabel}>보험 계약</div>
              <div className={styles.webStatValue}>{contracts.length}</div>
            </div>
            <div className={styles.webStatCard} style={{ borderTopColor: '#B45309' }} onClick={handleNearDoneClick}>
              <div className={styles.webStatLabel}>완납 임박</div>
              <div className={styles.webStatValue} style={{ color: 'var(--red)' }}>{nearDoneCustomers.length}</div>
            </div>
            <div className={styles.webStatCard} style={{ borderTopColor: '#B91C1C' }} onClick={handleGapClick}>
              <div className={styles.webStatLabel}>보장 공백</div>
              <div className={styles.webStatValue} style={{ color: 'var(--amber)' }}>{gapCustomers.length}</div>
            </div>
            <div className={styles.webStatCard} style={{ borderTopColor: '#0891B2' }}>
              <div className={styles.webStatLabel}>월납입 합계</div>
              <div className={styles.webStatValue}>{formatMonthlyWeb(totalMonthly)}</div>
            </div>
          </div>

          {/* 3행: 이번달 미팅 현황 + 최근 등록 고객 (2열) */}
          <div className={styles.webRow2}>
            <div className={styles.webCard}>
              <div className={styles.webCardHeader}>
                <div className={styles.webCardTitleGroup}>
                  <span className={styles.webCardAccent}></span>
                  <span className={styles.webCardTitle}>이번달 미팅 현황</span>
                </div>
                <button className={styles.webCardLink} onClick={() => router.push('/sales?tab=meeting')}>전체보기</button>
              </div>
              <div className={styles.webCardBody}>
                <div className={styles.webMeetingStats}>
                  <div className={styles.webMeetingStat}>
                    <span className={styles.webDot} style={{ background: '#1D9E75' }}></span>
                    <span className={styles.webMeetingLabel}>완료</span>
                    <span className={styles.webMeetingValue}>{meetingStats.done}건</span>
                  </div>
                  <div className={styles.webMeetingStat}>
                    <span className={styles.webDot} style={{ background: '#378ADD' }}></span>
                    <span className={styles.webMeetingLabel}>예정</span>
                    <span className={styles.webMeetingValue}>{meetingStats.scheduled}건</span>
                  </div>
                  <div className={styles.webMeetingStat}>
                    <span className={styles.webDot} style={{ background: '#B91C1C' }}></span>
                    <span className={styles.webMeetingLabel}>취소</span>
                    <span className={styles.webMeetingValue}>{meetingStats.cancelled}건</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.webCard}>
              <div className={styles.webCardHeader}>
                <div className={styles.webCardTitleGroup}>
                  <span className={styles.webCardAccent}></span>
                  <span className={styles.webCardTitle}>최근 등록 고객</span>
                </div>
                <button className={styles.webCardLink} onClick={() => router.push('/customers')}>전체보기</button>
              </div>
              <div className={styles.webCardBody}>
              {(() => {
                const recent = [...customers]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                if (recent.length === 0) return <div className={styles.webEmpty}>등록된 고객이 없어요</div>
                return recent.map(c => {
                  const badgeText = c.customer_type === 'prospect' ? '관심고객' : '마이고객'
                  return (
                    <div key={c.id} className={styles.webListRow} onClick={() => router.push(`/customers?id=${c.id}`)}>
                      <span className={styles.webListIcon}>👤</span>
                      <span className={styles.webListLabel}>{c.name} 고객
                        <span className={styles.webBadge} style={{ color: '#1D4ED8', background: '#EFF6FF', marginLeft: 8 }}>{badgeText}</span>
                      </span>
                      <span className={styles.webListMeta}>{new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
                    </div>
                  )
                })
              })()}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}