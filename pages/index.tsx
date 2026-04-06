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
  const [loading, setLoading] = useState(true)
  const [calOpen, setCalOpen] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [agentName, setAgentName] = useState('')
  const [seenNearDone, setSeenNearDone] = useState<string[]>([])
  const [seenBirthday, setSeenBirthday] = useState<string[]>([])
  const [seenGap, setSeenGap] = useState<string[]>([])

  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  useEffect(() => {
    fetchAll()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('dpa_agents').select('name').eq('user_id', data.user.id).single()
          .then(({ data: agent }) => { if (agent) setAgentName(agent.name) })
      }
    })
    // localStorage에서 확인된 항목 불러오기
    setSeenNearDone(JSON.parse(localStorage.getItem('dpa_seen_nearDone') || '[]'))
    setSeenBirthday(JSON.parse(localStorage.getItem('dpa_seen_birthday') || '[]'))
    setSeenGap(JSON.parse(localStorage.getItem('dpa_seen_gap') || '[]'))
  }, [])

  // NEW 뱃지 여부 체크
  const isNewNearDone = (customerId: string) => !seenNearDone.includes(customerId)
  const isNewBirthday = (customerId: string) => !seenBirthday.includes(customerId)
  const isNewGap = (customerId: string) => !seenGap.includes(customerId)

  // 카드 클릭 시 확인 처리 + 페이지 이동
  const handleNearDoneClick = () => {
    const ids = nearDoneCustomers.map((c: any) => c.id)
    const updated = [...new Set([...seenNearDone, ...ids])]
    localStorage.setItem('dpa_seen_nearDone', JSON.stringify(updated))
    setSeenNearDone(updated)
    router.push('/customers?sort=완납임박')
  }
  const handleBirthdayClick = () => {
    const ids = birthdayCustomers.map((c: any) => c.id)
    const updated = [...new Set([...seenBirthday, ...ids])]
    localStorage.setItem('dpa_seen_birthday', JSON.stringify(updated))
    setSeenBirthday(updated)
    router.push('/customers?sort=생일임박')
  }
  const handleGapClick = () => {
    const ids = gapCustomers.map((c: any) => c.id)
    const updated = [...new Set([...seenGap, ...ids])]
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
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
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

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>
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
  )
}
