import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Customers.module.css'

type Tab = 'existing' | 'prospect'

const AGE_FILTERS = ['전체', '유아(0-7)', '10대', '20대', '30대', '40대', '50대', '60대+']

function getAgeGroup(age: number): string {
  if (age <= 7) return '유아(0-7)'
  if (age <= 19) return '10대'
  if (age <= 29) return '20대'
  if (age <= 39) return '30대'
  if (age <= 49) return '40대'
  if (age <= 59) return '50대'
  return '60대+'
}

export default function Customers() {
  const [tab, setTab] = useState<Tab>('existing')
  const [customers, setCustomers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ageFilter, setAgeFilter] = useState('전체')

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase.from('dpa_customers').select('*').order('created_at')
    setCustomers(data || [])
    if (data && data.length > 0) selectCustomer(data[0])
    setLoading(false)
  }

  async function selectCustomer(c: any) {
    setSelected(c)
    const { data: ctData } = await supabase.from('dpa_contracts').select('*').eq('customer_id', c.id)
    setContracts(ctData || [])
    if (ctData && ctData.length > 0) {
      const ids = ctData.map((ct: any) => ct.id)
      const { data: cvData } = await supabase.from('dpa_coverages').select('*').in('contract_id', ids)
      setCoverages(cvData || [])
    } else setCoverages([])
  }

  async function deleteCustomer(c: any, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`${c.name} 님을 삭제할까요? 관련 계약과 보장 내역도 모두 삭제됩니다.`)) return
    const { data: ctData } = await supabase.from('dpa_contracts').select('id').eq('customer_id', c.id)
    if (ctData && ctData.length > 0) {
      const ids = ctData.map((ct: any) => ct.id)
      await supabase.from('dpa_coverages').delete().in('contract_id', ids)
      await supabase.from('dpa_contracts').delete().eq('customer_id', c.id)
    }
    await supabase.from('dpa_customers').delete().eq('id', c.id)
    if (selected?.id === c.id) setSelected(null)
    fetchCustomers()
  }

  const fmt = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(0)}천만`
    if (n >= 10000) return `${(n / 10000).toFixed(0)}만`
    return `${n.toLocaleString()}`
  }

  const getGauges = () => {
    const cancer = coverages.filter(c => c.category === '암진단').reduce((s, c) => s + c.amount, 0)
    const brain = coverages.filter(c => c.category === '뇌혈관').reduce((s, c) => s + c.amount, 0)
    const heart = coverages.filter(c => c.category === '심장').reduce((s, c) => s + c.amount, 0)
    const care = coverages.filter(c => c.category === '간병').reduce((s, c) => s + c.amount, 0)
    const brainTypes = coverages.filter(c => c.category === '뇌혈관').map(c => c.brain_coverage_type)
    const brainColor = brainTypes.includes('뇌혈관') ? 'green' : brainTypes.includes('뇌졸중') ? 'amber' : 'red'
    return [
      { label: '암진단', value: cancer, max: 50000000, color: 'green', display: cancer === 0 ? '⚠ 미가입' : fmt(cancer) },
      { label: '뇌혈관', value: brain, max: 50000000, color: brainColor, display: brain === 0 ? '⚠ 미가입' : fmt(brain) },
      { label: '심장', value: heart, max: 30000000, color: 'blue', display: heart === 0 ? '⚠ 미가입' : fmt(heart) },
      { label: '간병', value: care, max: 500000, color: 'green', display: care === 0 ? '⚠ 미가입' : fmt(care) },
    ]
  }

  const filteredCustomers = customers.filter(c => {
    if (ageFilter === '전체') return true
    return getAgeGroup(c.age) === ageFilter
  })

  const totalMonthly = contracts
    .filter(ct => ct.customer_id === selected?.id)
    .reduce((s, ct) => s + (ct.monthly_fee || 0), 0)

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <button className={[styles.tab, tab === 'existing' ? styles.activeTab : ''].join(' ')} onClick={() => setTab('existing')}>기존 고객</button>
        <button className={[styles.tab, tab === 'prospect' ? styles.activeTab : ''].join(' ')} onClick={() => setTab('prospect')}>잠재 고객</button>
        <div className={styles.tabRight}>
          <select className={styles.ageFilter} value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
            {AGE_FILTERS.map(f => <option key={f}>{f}</option>)}
          </select>
          <a href="/input" className={styles.addBtn}>+ 고객 추가</a>
        </div>
      </div>

      {tab === 'existing' && (
        <div className={styles.grid}>
          <div className={styles.listPanel}>
            {loading ? <div className={styles.empty}>불러오는 중...</div> : filteredCustomers.length === 0 ? (
              <div className={styles.empty}>해당 고객이 없어요</div>
            ) : filteredCustomers.map(c => {
              const cContracts = contracts.filter(ct => ct.customer_id === c.id)
              const hasAlert = cContracts.some((ct: any) => ct.payment_rate >= 90 && ct.payment_status !== '완납')
              return (
                <div key={c.id} className={[styles.custRow, selected?.id === c.id ? styles.active : ''].join(' ')} onClick={() => selectCustomer(c)}>
                  <div className={[styles.avatar, c.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>{c.name.slice(0, 2)}</div>
                  <div className={styles.custInfo}>
                    <div className={styles.custName}>
                      {c.name}
                      {hasAlert && <span className={styles.badgeWarn}>🔥 완납임박</span>}
                    </div>
                    <div className={styles.custMeta}>{c.age}세 · {c.gender} · {c.job}</div>
                  </div>
                  <div className={styles.custActions}>
                    <span className={[styles.badge, c.grade === 'VIP' ? styles.badgeAmber : styles.badgeBlue].join(' ')}>{c.grade}</span>
                    <button className={styles.deleteBtn} onClick={(e) => deleteCustomer(c, e)}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.detailPanel}>
            {selected ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={[styles.avatar, styles.avLg, selected.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>{selected.name.slice(0, 2)}</div>
                  <div>
                    <div className={styles.detailName}>{selected.name}</div>
                    <div className={styles.detailMeta}>{selected.age}세 · {selected.gender} · {selected.job} · {selected.phone}</div>
                  </div>
                </div>

                {/* 추가 고객 정보 */}
                <div className={styles.extraInfoBox}>
                  <div className={styles.extraInfoGrid}>
                    {selected.address && (
                      <div className={styles.extraInfoItem}>
                        <div className={styles.extraInfoLabel}>주소</div>
                        <div className={styles.extraInfoValue}>{selected.address}</div>
                      </div>
                    )}
                    {selected.workplace && (
                      <div className={styles.extraInfoItem}>
                        <div className={styles.extraInfoLabel}>직장/소속</div>
                        <div className={styles.extraInfoValue}>{selected.workplace}</div>
                      </div>
                    )}
                    {selected.bank_name && selected.bank_account && (
                      <div className={styles.extraInfoItem}>
                        <div className={styles.extraInfoLabel}>계좌번호</div>
                        <div className={styles.extraInfoValue}>{selected.bank_name} {selected.bank_account}</div>
                      </div>
                    )}
                    {selected.driver_license && (
                      <div className={styles.extraInfoItem}>
                        <div className={styles.extraInfoLabel}>운전면허</div>
                        <div className={styles.extraInfoValue}>{selected.driver_license}</div>
                      </div>
                    )}
                    <div className={styles.extraInfoItem}>
                      <div className={styles.extraInfoLabel}>총 월납입</div>
                      <div className={styles.extraInfoValueGreen}>{totalMonthly.toLocaleString()}원</div>
                    </div>
                    <div className={styles.extraInfoItem}>
                      <div className={styles.extraInfoLabel}>계약 수</div>
                      <div className={styles.extraInfoValue}>{contracts.filter(ct => ct.customer_id === selected.id).length}건</div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>보장 현황</div>
                {getGauges().map(g => (
                  <div key={g.label} className={styles.gaugeRow}>
                    <div className={styles.gaugeLabel}>
                      <span>{g.label}</span>
                      <span className={styles[`gauge_${g.color}`]}>{g.display}</span>
                    </div>
                    <div className={styles.gaugeTrack}>
                      <div className={[styles.gaugeFill, styles[`fill_${g.color}`]].join(' ')} style={{ width: `${Math.min(100, Math.round(g.value / g.max * 100))}%` }} />
                    </div>
                  </div>
                ))}

                <div className={styles.section}>가입 보험</div>
                {contracts.filter(ct => ct.customer_id === selected.id).map(ct => (
                  <div key={ct.id} className={styles.insItem}>
                    <div className={styles.insLeft}>
                      <span className={styles.insName}>{ct.company}</span>
                      {ct.insurance_type && <span className={styles.insType}>{ct.insurance_type}</span>}
                      {ct.contract_start && <span className={styles.insMeta}>{ct.contract_start}</span>}
                      {ct.payment_years && <span className={styles.insMeta}>{ct.payment_years}납</span>}
                      {ct.expiry_age && <span className={styles.insMeta}>{ct.expiry_age}만기</span>}
                    </div>
                    <div className={styles.insRight}>
                      <span className={[styles.badge, ct.payment_status === '완납' ? styles.badgeGreen : ct.payment_rate >= 90 ? styles.badgeWarn : styles.badgeBlue].join(' ')}>
                        {ct.payment_status === '완납' ? '완납' : `${ct.payment_rate}%`}
                      </span>
                      <span className={styles.insFee}>{ct.monthly_fee.toLocaleString()}원/월</span>
                    </div>
                  </div>
                ))}
              </>
            ) : <div className={styles.empty}>고객을 선택해주세요</div>}
          </div>
        </div>
      )}

      {tab === 'prospect' && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <div className={styles.emptyText}>잠재 고객 관리 기능이 곧 추가됩니다!</div>
          <a href="/input" className={styles.addBtn} style={{ marginTop: 16 }}>+ 잠재 고객 추가</a>
        </div>
      )}
    </div>
  )
}
