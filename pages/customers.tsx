import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Customers.module.css'

type Tab = 'existing' | 'prospect'

export default function Customers() {
  const [tab, setTab] = useState<Tab>('existing')
  const [customers, setCustomers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)

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

  const getScript = () => {
    if (!selected) return ''
    const brainTypes = coverages.filter(c => c.category === '뇌혈관').map(c => c.brain_coverage_type)
    const hasGap = brainTypes.length === 0 || brainTypes.every(t => t === '뇌출혈')
    const nearDone = contracts.some((c: any) => c.payment_rate >= 90 && c.payment_status !== '완납')
    let script = `안녕하세요 ${selected.name} 님! 😊\n\n`
    if (hasGap) script += `최근 뇌혈관 질환 관련 뉴스가 많더라고요.\n${selected.name} 님 보험을 확인해보니 뇌출혈 외 뇌혈관 전체 보장이 빠져있어서 한번 말씀드리고 싶었어요.\n잠깐 시간 되실 때 통화 가능하실까요? 📞\n`
    else if (nearDone) script += `${selected.name} 님 납입이 거의 완료되어 가고 있어요! 🎉\n곧 완납이 되시면 같은 보장을 더 유리한 조건으로 재설계할 수 있는 기회가 생겨요.\n잠깐 시간 되실 때 말씀 나눠봐요! 😊\n`
    else script += `항상 건강하게 지내고 계신가요? 😊\n보험 관련해서 궁금하신 점 있으시면 언제든지 연락주세요!\n`
    return script
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <button className={[styles.tab, tab === 'existing' ? styles.activeTab : ''].join(' ')} onClick={() => setTab('existing')}>기존 고객</button>
        <button className={[styles.tab, tab === 'prospect' ? styles.activeTab : ''].join(' ')} onClick={() => setTab('prospect')}>잠재 고객</button>
        <a href="/input" className={styles.addBtn}>+ 고객 추가</a>
      </div>

      {tab === 'existing' && (
        <div className={styles.grid}>
          <div className={styles.listPanel}>
            {loading ? <div className={styles.empty}>불러오는 중...</div> : customers.length === 0 ? (
              <div className={styles.empty}>등록된 고객이 없어요</div>
            ) : customers.map(c => {
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
                  <span className={[styles.badge, c.grade === 'VIP' ? styles.badgeAmber : styles.badgeBlue].join(' ')}>{c.grade}</span>
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
                    <span className={styles.insName}>{ct.company}</span>
                    <span className={[styles.badge, ct.payment_status === '완납' ? styles.badgeGreen : ct.payment_rate >= 90 ? styles.badgeWarn : styles.badgeBlue].join(' ')}>
                      {ct.payment_status === '완납' ? '완납' : `${ct.payment_rate}%`}
                    </span>
                    <span className={styles.insFee}>{ct.monthly_fee.toLocaleString()}원/월</span>
                  </div>
                ))}

                <div className={styles.section}>카톡 스크립트</div>
                <div className={styles.scriptBox}>{getScript()}</div>
                <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(getScript()); alert('복사됐어요! 카톡에 붙여넣으세요 😊') }}>
                  클립보드 복사
                </button>
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
