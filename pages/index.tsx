import { useEffect, useState } from 'react'
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
  const [meetingExpanded, setMeetingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [calOpen, setCalOpen] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [agentName, setAgentName] = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [seenNearDone, setSeenNearDone] = useState<string[]>([])
  const [seenBirthday, setSeenBirthday] = useState<string[]>([])
  const [seenGap, setSeenGap] = useState<string[]>([])

  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const mobileDateStr = now.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })

  useEffect(() => {
    fetchAll()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setAgentEmail(data.user.email || '')
        supabase.from('dpa_agents').select('name').eq('user_id', data.user.id).single()
          .then(({ data: agent }) => { if (agent) setAgentName(agent.name) })
      }
    })
    setSeenNearDone(JSON.parse(localStorage.getItem('dpa_seen_nearDone') || '[]'))
    setSeenBirthday(JSON.parse(localStorage.getItem('dpa_seen_birthday') || '[]'))
    setSeenGap(JSON.parse(localStorage.getItem('dpa_seen_gap') || '[]'))
  }, [])

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
    const { data: custs } = await supabase.from('dpa_customers').select('*').eq('agent_id', agentId)
    const { data: conts } = await supabase.from('dpa_contracts').select('*').eq('agent_id', agentId)
    const { data: covs } = await supabase.from('dpa_coverages').select('*')
    const todayStr = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: meets } = await supabase.from('dpa_meetings').select('*').eq('agent_id', agentId).gte('meeting_date', todayStr).lte('meeting_date', nextWeek).neq('status', '취소').order('meeting_date', { ascending: true })
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    setMeetings(meets || [])
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

  const todoItems: { icon: string; text: string; badge: string; badgeColor: string; badgeBg: string; sort: string }[] = []
  birthdayCustomers.slice(0, 1).forEach(c => {
    const diff = Math.abs(new Date(c.birth_date).getDate() - now.getDate())
    todoItems.push({ icon: '🎂', text: `${c.name} 생일`, badge: diff === 0 ? 'D-day' : `D-${diff}`, badgeColor: '#EF9F27', badgeBg: '#FEF3E2', sort: '생일임박' })
  })
  nearDoneCustomers.slice(0, 1).forEach(c => {
    const ct = nearDoneContracts.find((ct: any) => ct.customer_id === c.id)
    todoItems.push({ icon: '🔥', text: `${c.name} 완납임박`, badge: `${ct ? calcPaymentRate(ct) : 0}%`, badgeColor: '#E24B4A', badgeBg: '#FCEBEB', sort: '완납임박' })
  })
  gapCustomers.slice(0, 1).forEach(c => {
    todoItems.push({ icon: '⚠️', text: `${c.name} 보장공백`, badge: '확인', badgeColor: '#E24B4A', badgeBg: '#FCEBEB', sort: '보장공백' })
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

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>

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
          </div>
        </div>

        {/* 오늘 할일 */}
        <div className={styles.mobileCard} style={{ marginTop: 8 }}>
          <div className={styles.mobileCardHeader}>
            <span className={styles.mobileCardTitle} style={{ color: '#1D9E75' }}>오늘 할일</span>
            <span className={styles.mobileCardLink} onClick={() => {
              const sort = todoItems.length > 0 ? todoItems[0].sort : '보장공백'
              router.push(`/customers?sort=${sort}`)
            }}>전체보기 →</span>
          </div>
          <div className={styles.mobileCardBody}>
          {todoItems.length === 0 ? (
            <p className={styles.mobileEmpty}>오늘 할 일 없음 🎉</p>
          ) : todoItems.slice(0,3).map((item, i) => (
            <div key={i} className={styles.mobileTodoRow} onClick={() => router.push(`/customers?sort=${item.sort}`)} style={{ cursor: 'pointer' }}>
              <span className={styles.mobileTodoIcon}>{item.icon}</span>
              <span className={styles.mobileTodoText}>{item.text}</span>
              <span className={styles.mobileBadge} style={{ color: item.badgeColor, background: item.badgeBg }}>{item.badge}</span>
            </div>
          ))}
          {todoItems.length > 3 && (
            <div style={{overflow:'hidden',maxHeight:todoExpanded?`${(todoItems.length-3)*48}px`:'0px',transition:'max-height 0.35s ease'}}>
              {todoItems.slice(3).map((item, i) => (
                <div key={i+3} className={styles.mobileTodoRow} onClick={() => router.push(`/customers?sort=${item.sort}`)} style={{cursor:'pointer'}}>
                  <span className={styles.mobileTodoIcon}>{item.icon}</span>
                  <span className={styles.mobileTodoText}>{item.text}</span>
                  <span className={styles.mobileBadge} style={{color:item.badgeColor,background:item.badgeBg}}>{item.badge}</span>
                </div>
              ))}
            </div>
          )}
          {todoItems.length > 3 && (
            <div onClick={() => setTodoExpanded(v => !v)} style={{textAlign:'center',padding:'6px 0',cursor:'pointer',color:'#9CA3AF',fontSize:16}}>
              ﹀
            </div>
          )}
          </div>
        </div>

        {/* 미팅 일정 */}
        <div className={styles.mobileCard}>
          <div className={styles.mobileCardHeader}>
            <span className={styles.mobileCardTitle}>미팅 일정</span>
            <span className={styles.mobileCardLink} onClick={() => router.push('/sales?tab=today')}>전체보기 →</span>
          </div>
          <div className={styles.mobileCardBody}>
          {meetings.length === 0 ? (
            <p className={styles.mobileEmpty} style={{ padding: '8px 0' }}>오늘 미팅이 없어요 😊</p>
          ) : (meetingExpanded ? meetings : meetings.slice(0,3)).map((m, i) => {
            const customer = customers.find(c => c.id === m.customer_id)
            const name = m.prospect_name || customer?.name || '이름 없음'
            const badgeText = m.prospect_name ? '신규' : '마이고객'
            const badgeColor = m.prospect_name ? '#6B7280' : '#1D4ED8'
            const badgeBg = m.prospect_name ? '#F3F4F6' : '#EFF6FF'
            const dateObj = new Date(m.meeting_date)
            const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
            const timeLabel = m.meeting_time ? ` ${m.meeting_time}` : ''
            return (
              <div key={i} className={styles.mobileTodoRow} onClick={() => router.push(`/sales?meetingId=${m.id}`)} style={{ cursor: 'pointer' }}>
                <span className={styles.mobileTodoIcon}>🤝</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={styles.mobileTodoText}>{name}고객</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: badgeBg, color: badgeColor, marginLeft: 4, fontWeight: 600 }}>{badgeText}</span>
                </div>
                <span className={styles.mobileBadge} style={{ color: '#374151', background: '#F3F4F6', fontSize: 11, whiteSpace: 'nowrap' }}>{dateLabel}{timeLabel}</span>
              </div>
            )
          })}
          {meetings.length > 3 && (
            <div style={{overflow:'hidden',maxHeight:meetingExpanded?`${(meetings.length-3)*56}px`:'0px',transition:'max-height 0.35s ease'}}>
              {meetings.slice(3).map((m, i) => {
                const customer = customers.find(c => c.id === m.customer_id)
                const name = m.prospect_name || customer?.name || '이름 없음'
                const badgeText = m.prospect_name ? '신규' : '마이고객'
                const badgeColor = m.prospect_name ? '#6B7280' : '#1D4ED8'
                const badgeBg = m.prospect_name ? '#F3F4F6' : '#EFF6FF'
                const dateObj = new Date(m.meeting_date)
                const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
                const timeLabel = m.meeting_time ? ` ${m.meeting_time}` : ''
                return (
                  <div key={i+3} className={styles.mobileTodoRow} onClick={() => router.push(`/sales?meetingId=${m.id}`)} style={{cursor:'pointer'}}>
                    <span className={styles.mobileTodoIcon}>🤝</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span className={styles.mobileTodoText}>{name}고객</span>
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:badgeBg,color:badgeColor,marginLeft:4,fontWeight:600}}>{badgeText}</span>
                    </div>
                    <span className={styles.mobileBadge} style={{color:'#374151',background:'#F3F4F6',fontSize:11,whiteSpace:'nowrap'}}>{dateLabel}{timeLabel}</span>
                  </div>
                )
              })}
            </div>
          )}
          {meetings.length > 3 && (
            <div onClick={() => setMeetingExpanded(v => !v)} style={{textAlign:'center',padding:'6px 0',cursor:'pointer',color:'#9CA3AF',fontSize:16}}>
              ﹀
            </div>
          )}
          </div>
        </div>

        {/* 메뉴 2x2 */}
        <div className={styles.mobileGrid2}>
          <button className={styles.mobileMenuBtn} onClick={() => router.push('/customers')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div>
              <p className={styles.mobileMenuName}>고객 관리</p>
              <p className={styles.mobileMenuSub}>{customers.length}명</p>
            </div>
          </button>
          <button className={styles.mobileMenuBtn} onClick={() => router.push('/sales')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            <div>
              <p className={styles.mobileMenuName}>영업 관리</p>
              <p className={styles.mobileMenuSub}>미팅 3건</p>
            </div>
          </button>
          <button className={styles.mobileMenuBtn} onClick={() => router.push('/input')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <div>
              <p className={styles.mobileMenuName}>데이터 입력</p>
              <p className={styles.mobileMenuSub}>AI 파싱</p>
            </div>
          </button>
          <button className={styles.mobileMenuBtn} onClick={() => router.push('/notifications')}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {(nearDoneCustomers.length + gapCustomers.length + birthdayCustomers.length) > 0 && (
                <div style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, background: '#E24B4A', borderRadius: '50%' }} />
              )}
            </div>
            <div>
              <p className={styles.mobileMenuName}>알림</p>
              <p className={styles.mobileMenuSub} style={{ color: '#E24B4A' }}>{nearDoneCustomers.length + gapCustomers.length + birthdayCustomers.length}건 대기</p>
            </div>
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
          <button className={styles.mobileIconBtn} onClick={() => router.push('/customers')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span className={styles.mobileIconLabel}>이력추적</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={() => router.push('/analysis')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span className={styles.mobileIconLabel}>보장분석</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={() => router.push('/newsletter')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className={styles.mobileIconLabel}>뉴스레터</span>
          </button>
          <button className={styles.mobileIconBtn} onClick={() => router.push('/settings')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className={styles.mobileIconLabel}>설정</span>
          </button>
        </div>
      </div>

      {/* ── 웹(데스크탑) 기존 대시보드 ── */}
      <div className={styles.desktopDash}>
        <div className={styles.topRow}>
          <div className={styles.welcomeMsg}>
            안녕하세요, <strong>{agentName || 'admin'} 설계사님</strong> 👋 오늘도 좋은 하루 되세요!
          </div>
          <div className={styles.dateRow}>
            <span className={styles.dateStr}>{dateStr}</span>
            <div style={{ position: 'relative' }}>
              <button className={styles.calBtn} onClick={() => setCalOpen(v => !v)}>📅 달력</button>
              {calOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setCalOpen(false)} />
                  <div className={styles.calPopup} style={{ top: '100%', right: 0, marginTop: 6, position: 'absolute', zIndex: 201 }} onClick={e => e.stopPropagation()}>
                    <div className={styles.calHeader}>
                      <button className={styles.calArrow} onClick={prevMonth}>‹</button>
                      <span className={styles.calMonthStr}>{calMonthStr}</span>
                      <button className={styles.calArrow} onClick={nextMonth}>›</button>
                      <button className={styles.calClose} onClick={() => setCalOpen(false)}>✕</button>
                    </div>
                    <div className={styles.calGrid}>
                      {['일','월','화','수','목','금','토'].map(d => (
                        <div key={d} className={styles.calDayLabel}>{d}</div>
                      ))}
                      {Array.from({ length: calFirst }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: calLast }).map((_, i) => {
                        const day = i + 1
                        const isToday = calYear === now.getFullYear() && calMonth === now.getMonth() && day === now.getDate()
                        return (
                          <div key={day} className={[styles.calDay, isToday ? styles.calToday : ''].join(' ')}>{day}</div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.alertsTitle}>오늘의 액션 알림</div>
        <div className={styles.alerts}>
          <div className={[styles.alertCard, styles.acRed].join(' ')} onClick={handleGapClick} style={{cursor: gapCustomers.length > 0 ? 'pointer' : 'default'}}>
            <div className={styles.alertIcon}>⚠</div>
            <div className={styles.alertTitle}>
              보장 공백
              {gapCustomers.some((c: any) => isNewGap(c.id)) && <span style={{marginLeft:6,fontSize:10,background:'#E53E3E',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:700,verticalAlign:'middle'}}>NEW</span>}
            </div>
            <div className={styles.alertDesc}>
              {gapCustomers.length === 0 ? '공백 고객 없음' : gapCustomers.map((c: any) => `${c.name} 님`).join(', ')} — 뇌혈관 확대 제안 필요
            </div>
          </div>
          <div className={[styles.alertCard, styles.acAmber].join(' ')} onClick={handleNearDoneClick} style={{cursor: nearDoneCustomers.length > 0 ? 'pointer' : 'default'}}>
            <div className={styles.alertIcon}>🔥</div>
            <div className={styles.alertTitle}>
              완납 임박 {nearDoneCustomers.length}명
              {nearDoneCustomers.some((c: any) => isNewNearDone(c.id)) && <span style={{marginLeft:6,fontSize:10,background:'#E53E3E',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:700,verticalAlign:'middle'}}>NEW</span>}
            </div>
            <div className={styles.alertDesc}>
              {nearDoneCustomers.length === 0 ? '해당 없음' : nearDoneCustomers.map((c: any) => {
                const ct = nearDoneContracts.find((ct: any) => ct.customer_id === c.id)
                return `${c.name}(${ct?.company} ${ct ? calcPaymentRate(ct) : 0}%)`
              }).join(', ')}
            </div>
          </div>
          <div className={[styles.alertCard, styles.acGreen].join(' ')} onClick={handleBirthdayClick} style={{cursor: birthdayCustomers.length > 0 ? 'pointer' : 'default'}}>
            <div className={styles.alertIcon}>★</div>
            <div className={styles.alertTitle}>
              유지 관리
              {birthdayCustomers.some((c: any) => isNewBirthday(c.id)) && <span style={{marginLeft:6,fontSize:10,background:'#E53E3E',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:700,verticalAlign:'middle'}}>NEW</span>}
            </div>
            <div className={styles.alertDesc}>
              {fullCustomers.length === 0 ? '해당 없음' : fullCustomers.map((c: any) => `${c.name} 님`).join(', ')} — 보장 완비, 정기 안부 연락
            </div>
          </div>
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric} onClick={() => router.push('/customers')}>
            <div className={styles.mlabel}>총 고객</div>
            <div className={styles.mvalue}>{customers.length}</div>
            <div className={styles.msub}>기존 고객 ↗</div>
          </div>
          <div className={styles.metric} onClick={() => router.push('/customers')}>
            <div className={styles.mlabel}>보험 계약</div>
            <div className={styles.mvalue}>{contracts.length}</div>
            <div className={styles.msub}>총 계약 건수 ↗</div>
          </div>
          <div className={styles.metric} onClick={handleNearDoneClick} style={{cursor:'pointer'}}>
            <div className={styles.mlabel}>
              완납 임박
              {nearDoneCustomers.some((c: any) => isNewNearDone(c.id)) && <span style={{marginLeft:6,fontSize:10,background:'#E53E3E',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:700,verticalAlign:'middle'}}>NEW</span>}
            </div>
            <div className={[styles.mvalue, styles.red].join(' ')}>{nearDoneCustomers.length}</div>
            <div className={styles.msub}>납입률 90%↑ ↗</div>
          </div>
          <div className={styles.metric} onClick={handleGapClick} style={{cursor:'pointer'}}>
            <div className={styles.mlabel}>
              보장 공백
              {gapCustomers.some((c: any) => isNewGap(c.id)) && <span style={{marginLeft:6,fontSize:10,background:'#E53E3E',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:700,verticalAlign:'middle'}}>NEW</span>}
            </div>
            <div className={[styles.mvalue, styles.amber].join(' ')}>{gapCustomers.length}</div>
            <div className={styles.msub}>뇌혈관 미가입 ↗</div>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>카톡 발송 예정</div>
            {kakaoTargets.length === 0 ? (
              <div className={styles.emptySmall}>오늘 발송 대상 없음</div>
            ) : kakaoTargets.map((c, i) => (
              <div key={i} className={styles.kakaoRow}>
                <div className={styles.kakaoName}>{c.name}</div>
                <span className={[styles.badge, c.tag === 'warn' ? styles.badgeWarn : c.tag === 'green' ? styles.badgeGreen : styles.badgeRed].join(' ')}>{c.reason}</span>
                <button className={styles.copyBtn} onClick={() => {
                  navigator.clipboard.writeText(getScript(c))
                  alert('복사됐어요! 카톡에 붙여넣으세요 😊')
                }}>복사</button>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>이번 달 통계</div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>신규 고객</span>
              <span className={styles.statVal}>{newThisMonth}명</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>총 월 보험료</span>
              <span className={styles.statVal}>{totalMonthly.toLocaleString()}원</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>관리 계약 수</span>
              <span className={styles.statVal}>{contracts.length}건</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>보장 공백 고객</span>
              <span className={[styles.statVal, styles.red].join(' ')}>{gapCustomers.length}명</span>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ marginTop: 14 }}>
          <div className={styles.cardTitle}>최근 활동 로그</div>
          {customers.slice(-3).reverse().map((c, i) => (
            <div key={i} className={styles.logRow}>
              <span className={styles.logDot} />
              <span className={styles.logText}>{c.name} 님 고객 등록</span>
              <span className={styles.logTime}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
          ))}
          {customers.length === 0 && <div className={styles.emptySmall}>활동 내역 없음</div>}
        </div>
      </div>

    </div>
  )
}
