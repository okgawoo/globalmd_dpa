import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Dashboard.module.css'

export default function Dashboard() {
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState<{ type: string; list: any[] } | null>(null)

  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: custs } = await supabase.from('dpa_customers').select('*')
    const { data: conts } = await supabase.from('dpa_contracts').select('*')
    const { data: covs } = await supabase.from('dpa_coverages').select('*')
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    setLoading(false)
  }

  const nearDoneContracts = contracts.filter(c => c.payment_rate >= 90 && c.payment_status !== '완납')
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

  const thisMonth = now.getMonth()
  const newThisMonth = customers.filter(c => new Date(c.created_at).getMonth() === thisMonth).length
  const totalMonthly = contracts.reduce((s, c) => s + (c.monthly_fee || 0), 0)

  const kakaoTargets = [
    ...nearDoneCustomers.map(c => ({ ...c, reason: '완납 임박', tag: 'warn' })),
    ...gapCustomers.filter(c => !nearDoneCustomers.find(n => n.id === c.id)).map(c => ({ ...c, reason: '보장 공백', tag: 'red' })),
  ]

  const openPopup = (type: string) => {
    if (type === 'customers') setPopup({ type: '전체 고객', list: customers })
    else if (type === 'contracts') setPopup({ type: '전체 계약', list: contracts })
    else if (type === 'nearDone') setPopup({ type: '완납 임박 고객', list: nearDoneCustomers })
    else if (type === 'gap') setPopup({ type: '보장 공백 고객', list: gapCustomers })
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div className={styles.dateStr}>{dateStr}</div>
        <div className={styles.tagline}>승경아 타이핑 할 시간에 영업을 더 해~~ ㅎㅎㅎ</div>
      </div>

      <div className={styles.alertsTitle}>오늘의 액션 알림</div>
      <div className={styles.alerts}>
        <div className={[styles.alertCard, styles.acRed].join(' ')}>
          <div className={styles.alertIcon}>⚠</div>
          <div className={styles.alertTitle}>보장 공백</div>
          <div className={styles.alertDesc}>
            {gapCustomers.length === 0 ? '공백 고객 없음' : gapCustomers.map(c => `${c.name} 님`).join(', ')} — 뇌혈관 확대 제안 필요
          </div>
        </div>
        <div className={[styles.alertCard, styles.acAmber].join(' ')}>
          <div className={styles.alertIcon}>🔥</div>
          <div className={styles.alertTitle}>완납 임박 {nearDoneCustomers.length}명</div>
          <div className={styles.alertDesc}>
            {nearDoneCustomers.length === 0 ? '해당 없음' : nearDoneCustomers.map(c => {
              const ct = nearDoneContracts.find(ct => ct.customer_id === c.id)
              return `${c.name}(${ct?.company} ${ct?.payment_rate}%)`
            }).join(', ')}
          </div>
        </div>
        <div className={[styles.alertCard, styles.acGreen].join(' ')}>
          <div className={styles.alertIcon}>★</div>
          <div className={styles.alertTitle}>유지 관리</div>
          <div className={styles.alertDesc}>
            {fullCustomers.length === 0 ? '해당 없음' : fullCustomers.map(c => `${c.name} 님`).join(', ')} — 보장 완비, 정기 안부 연락
          </div>
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric} onClick={() => openPopup('customers')}>
          <div className={styles.mlabel}>총 고객</div>
          <div className={styles.mvalue}>{customers.length}</div>
          <div className={styles.msub}>기존 고객 ↗</div>
        </div>
        <div className={styles.metric} onClick={() => openPopup('contracts')}>
          <div className={styles.mlabel}>보험 계약</div>
          <div className={styles.mvalue}>{contracts.length}</div>
          <div className={styles.msub}>총 계약 건수 ↗</div>
        </div>
        <div className={styles.metric} onClick={() => openPopup('nearDone')}>
          <div className={styles.mlabel}>완납 임박</div>
          <div className={[styles.mvalue, styles.red].join(' ')}>{nearDoneCustomers.length}</div>
          <div className={styles.msub}>납입률 90%↑ ↗</div>
        </div>
        <div className={styles.metric} onClick={() => openPopup('gap')}>
          <div className={styles.mlabel}>보장 공백</div>
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
              <span className={[styles.badge, c.tag === 'warn' ? styles.badgeWarn : styles.badgeRed].join(' ')}>{c.reason}</span>
              <button className={styles.copyBtn} onClick={() => {
                const script = c.tag === 'warn'
                  ? `안녕하세요 ${c.name} 님! 😊\n\n납입이 거의 완료되어 가고 있어요! 🎉\n완납 후 더 유리한 조건으로 재설계할 수 있는 기회가 생겨요.\n잠깐 시간 되실 때 말씀 나눠봐요! 😊`
                  : `안녕하세요 ${c.name} 님! 😊\n\n최근 뇌혈관 질환 관련 뉴스가 많더라고요.\n${c.name} 님 보험을 확인해보니 뇌혈관 전체 보장이 빠져있어서 한번 말씀드리고 싶었어요.\n잠깐 시간 되실 때 통화 가능하실까요? 📞`
                navigator.clipboard.writeText(script)
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

      {popup && (
        <div className={styles.popupOverlay} onClick={() => setPopup(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <div className={styles.popupTitle}>{popup.type}</div>
              <button className={styles.popupClose} onClick={() => setPopup(null)}>✕</button>
            </div>
            {popup.list.length === 0 ? (
              <div className={styles.emptySmall}>해당 고객 없음</div>
            ) : popup.list.map((item, i) => (
              <div key={i} className={styles.popupRow}>
                <div className={styles.popupName}>{item.name || item.company}</div>
                <div className={styles.popupMeta}>
                  {item.age ? `${item.age}세 · ${item.gender}` : `납입률 ${item.payment_rate}% · ${item.payment_status}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
