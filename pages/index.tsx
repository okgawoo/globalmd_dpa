import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Dashboard.module.css'

export default function Dashboard() {
  const [customers, setCustomers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    const { data } = await supabase
      .from('dpa_customers')
      .select('*')
      .order('created_at')
    if (data) {
      setCustomers(data)
      selectCustomer(data[0])
    }
    setLoading(false)
  }

  async function selectCustomer(customer: any) {
    setSelected(customer)
    const { data: contractData } = await supabase
      .from('dpa_contracts')
      .select('*')
      .eq('customer_id', customer.id)

    setContracts(contractData || [])

    if (contractData && contractData.length > 0) {
      const contractIds = contractData.map((c: any) => c.id)
      const { data: coverageData } = await supabase
        .from('dpa_coverages')
        .select('*')
        .in('contract_id', contractIds)
      setCoverages(coverageData || [])
    } else {
      setCoverages([])
    }
  }

  function getGaugeData(coverages: any[]) {
    const cancer = coverages.filter(c => c.category === '암진단').reduce((s, c) => s + c.amount, 0)
    const brain = coverages.filter(c => c.category === '뇌혈관').reduce((s, c) => s + c.amount, 0)
    const heart = coverages.filter(c => c.category === '심장').reduce((s, c) => s + c.amount, 0)
    const care = coverages.filter(c => c.category === '간병').reduce((s, c) => s + c.amount, 0)
    return { cancer, brain, heart, care }
  }

  function getBrainType(coverages: any[]) {
    const types = coverages.filter(c => c.category === '뇌혈관').map(c => c.brain_coverage_type)
    if (types.includes('뇌혈관')) return { label: '뇌혈관', color: 'green' }
    if (types.includes('뇌졸중')) return { label: '뇌졸중', color: 'amber' }
    if (types.includes('뇌출혈')) return { label: '⚠ 뇌출혈만', color: 'red' }
    return { label: '미가입', color: 'red' }
  }

  function getAlerts() {
    return customers.map(c => {
      const cov = coverages.filter(cv => contracts.filter(ct => ct.customer_id === c.id).map((ct: any) => ct.id).includes(cv.contract_id))
      const brainTotal = cov.filter(cv => cv.category === '뇌혈관').reduce((s: number, cv: any) => s + cv.amount, 0)
      const contractList = contracts.filter(ct => ct.customer_id === c.id)
      const nearDone = contractList.some((ct: any) => ct.payment_rate >= 90 && ct.payment_status !== '완납')
      return { ...c, brainAlert: brainTotal === 0, nearDone }
    })
  }

  const fmt = (n: number) => n >= 10000000 ? `${(n / 10000000).toFixed(0)}천만` : n >= 10000 ? `${(n / 10000).toFixed(0)}만` : `${n}`
  const pct = (n: number, max: number) => Math.min(100, Math.round((n / max) * 100))

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>불러오는 중...</div>

  const gauges = selected ? getGaugeData(coverages) : null
  const brainType = selected ? getBrainType(coverages) : null

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div className={styles.logo}>DPA <span>보험 분석 자동화</span> <span className={styles.tagline}>승경아 타이핑 할 시간에 영업을 더 해~~</span></div>
        <div className={styles.byline}>made by okga</div>
      </div>

      <div className={styles.featureBtns}>
        {['📊 보장 공백 분석', '💬 카톡 스크립트 자동생성', '🔔 완납 임박 알림', '🎂 생일 알림', '📰 맞춤 뉴스레터', '⏰ 만기 임박 알림', '🤖 AI 보장 분석', '📱 캡처 자동 입력', '📈 영업 성과 리포트', '🎯 잠재 고객 관리'].map(f => (
          <button key={f} className={styles.featBtn} onClick={() => alert('준비 중인 기능이에요! 곧 추가됩니다 😊')}>
            {f}
          </button>
        ))}
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.mlabel}>총 고객</div>
          <div className={styles.mvalue}>{customers.length}</div>
          <div className={styles.msub}>기존 고객</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>보험 계약</div>
          <div className={styles.mvalue}>{contracts.length}</div>
          <div className={styles.msub}>총 계약 건수</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>완납 임박</div>
          <div className={[styles.mvalue, styles.red].join(' ')}>
            {contracts.filter(c => c.payment_rate >= 90 && c.payment_status !== '완납').length}
          </div>
          <div className={styles.msub}>납입률 90%↑</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>보장 공백</div>
          <div className={[styles.mvalue, styles.amber].join(' ')}>
            {customers.filter(c => !coverages.some(cv => cv.category === '뇌혈관')).length}
          </div>
          <div className={styles.msub}>뇌혈관 미가입</div>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.listPanel}>
          <div className={styles.panelTitle}>고객 목록</div>
          {customers.map(c => {
            const cContracts = contracts.filter(ct => ct.customer_id === c.id)
            const hasAlert = cContracts.some((ct: any) => ct.payment_rate >= 90 && ct.payment_status !== '완납')
            return (
              <div
                key={c.id}
                className={[styles.custRow, selected?.id === c.id ? styles.active : ''].join(' ')}
                onClick={() => selectCustomer(c)}
              >
                <div className={[styles.avatar, c.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>
                  {c.name.slice(0, 2)}
                </div>
                <div className={styles.custInfo}>
                  <div className={styles.custName}>
                    {c.name}
                    {hasAlert && <span className={[styles.badge, styles.bWarn].join(' ')}>🔥 완납임박</span>}
                  </div>
                  <div className={styles.custMeta}>{c.age}세 · {cContracts.map((ct: any) => ct.company).join(', ')}</div>
                </div>
                <span className={[styles.badge, c.grade === 'VIP' ? styles.bAmber : styles.bBlue].join(' ')}>{c.grade}</span>
              </div>
            )
          })}
        </div>

        <div className={styles.detailPanel}>
          {selected && gauges ? (
            <>
              <div className={styles.panelTitle}>고객 상세</div>
              <div className={styles.detailHeader}>
                <div className={[styles.avatar, styles.avLg, selected.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>
                  {selected.name.slice(0, 2)}
                </div>
                <div>
                  <div className={styles.detailName}>{selected.name}</div>
                  <div className={styles.detailMeta}>{selected.age}세 · {selected.gender} · {selected.job}</div>
                </div>
              </div>

              <div className={styles.sectionLabel}>보장 현황</div>
              {[
                { label: '암진단', value: gauges.cancer, max: 50000000, color: '#1D9E75' },
                { label: '뇌혈관', value: gauges.brain, max: 50000000, color: brainType?.color === 'red' ? '#E24B4A' : brainType?.color === 'amber' ? '#EF9F27' : '#1D9E75' },
                { label: '심장', value: gauges.heart, max: 30000000, color: '#378ADD' },
                { label: '간병', value: gauges.care, max: 500000, color: '#1D9E75' },
              ].map(g => (
                <div key={g.label} className={styles.gaugeRow}>
                  <div className={styles.gaugeLabel}>
                    <span>{g.label}</span>
                    <span className={styles.gaugeVal}>{g.value === 0 ? '⚠ 미가입' : fmt(g.value)}</span>
                  </div>
                  <div className={styles.gaugeTrack}>
                    <div className={styles.gaugeFill} style={{ width: `${pct(g.value, g.max)}%`, background: g.color }} />
                  </div>
                </div>
              ))}

              <div className={styles.sectionLabel} style={{ marginTop: 16 }}>가입 보험</div>
              {contracts.filter(ct => ct.customer_id === selected.id).map(ct => (
                <div key={ct.id} className={styles.insItem}>
                  <span className={styles.insName}>{ct.company}</span>
                  <span className={[styles.badge, ct.payment_status === '완납' ? styles.bGreen : ct.payment_rate >= 90 ? styles.bWarn : styles.bBlue].join(' ')}>
                    {ct.payment_status === '완납' ? '완납' : `${ct.payment_rate}%`}
                  </span>
                  <span className={styles.insFee}>{ct.monthly_fee.toLocaleString()}원</span>
                </div>
              ))}

              <button
                className={styles.scriptBtn}
                onClick={() => alert(`${selected.name} 님 카톡 스크립트\n\n안녕하세요 ${selected.name} 님!\n\n${brainType?.color === 'red' ? '뇌혈관 보장 공백이 확인되어 안내드립니다. 뇌출혈 외 뇌혈관 전체 보장으로 업그레이드를 검토해보시면 어떨까요?' : '현재 보장 내역이 잘 유지되고 있습니다. 궁금한 점 있으시면 언제든지 연락주세요!'}`)}
              >
                카톡 스크립트 생성
              </button>
            </>
          ) : (
            <div className={styles.emptyDetail}>고객을 선택해주세요</div>
          )}
        </div>
      </div>

      <div className={styles.alertsTitle}>오늘의 액션 알림</div>
      <div className={styles.alerts}>
        <div className={[styles.alertCard, styles.acRed].join(' ')}>
          <div className={styles.alertIcon}>⚠</div>
          <div className={styles.alertTitle}>뇌혈관 보장 공백</div>
          <div className={styles.alertDesc}>지점종 님 — 뇌출혈만 가입, 확대 제안 필요</div>
        </div>
        <div className={[styles.alertCard, styles.acAmber].join(' ')}>
          <div className={styles.alertIcon}>🔥</div>
          <div className={styles.alertTitle}>완납 임박 2명</div>
          <div className={styles.alertDesc}>지점종(교보 92%), 고객A(흥국 91%)</div>
        </div>
        <div className={[styles.alertCard, styles.acGreen].join(' ')}>
          <div className={styles.alertIcon}>★</div>
          <div className={styles.alertTitle}>풀옵션 유지 관리</div>
          <div className={styles.alertDesc}>고객B — 중입자+표적항암+간병인 완비</div>
        </div>
      </div>
    </div>
  )
}
