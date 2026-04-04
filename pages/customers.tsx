import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Customers.module.css'

type Tab = 'existing' | 'prospect'
const AGE_FILTERS = ['연령대전체', '유아(0-7)', '10대', '20대', '30대', '40대', '50대', '60대+']

const COVERAGE_GROUPS = [
  { key: '암진단', icon: '💊', label: '암 보장' },
  { key: '뇌혈관', icon: '🧠', label: '뇌혈관' },
  { key: '심장', icon: '❤️', label: '심장' },
  { key: '간병', icon: '🤝', label: '간병' },
  { key: '수술비', icon: '🔬', label: '수술비' },
  { key: '실손', icon: '🏥', label: '실손' },
  { key: '비급여', icon: '💉', label: '비급여' },
  { key: '상해', icon: '🩹', label: '상해' },
  { key: '사고처리', icon: '⚖️', label: '사고처리' },
  { key: '벌금', icon: '💰', label: '벌금' },
  { key: '특이사항', icon: '📌', label: '특이사항' },
]

function getAgeGroup(age: number): string {
  if (age <= 7) return '유아(0-7)'
  if (age <= 19) return '10대'
  if (age <= 29) return '20대'
  if (age <= 39) return '30대'
  if (age <= 49) return '40대'
  if (age <= 59) return '50대'
  return '60대+'
}

function getBirthdayDays(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
  return Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function fmtAmount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(0)}억원`
  if (n >= 10000000) return `${(n / 10000000).toFixed(0)}천만원`
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만원`
  return `${n.toLocaleString()}원`
}

const emptyCustomerForm = {
  name: '', age: '', gender: '남', job: '직장인', phone: '', grade: '일반',
  address: '', workplace: '', bank_name: '', bank_account: '', driver_license: ''
}

export default function Customers() {
  const [tab, setTab] = useState<Tab>('existing')
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [selectedContracts, setSelectedContracts] = useState<any[]>([])
  const [selectedCoverages, setSelectedCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ageFilter, setAgeFilter] = useState('연령대전체')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editContractId, setEditContractId] = useState<string | null>(null)
  const [editContractForm, setEditContractForm] = useState<any>({})
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState(emptyCustomerForm)
  const [addType, setAddType] = useState<'existing' | 'prospect'>('existing')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: custs } = await supabase.from('dpa_customers').select('*').order('created_at')
    const { data: conts } = await supabase.from('dpa_contracts').select('*')
    const { data: covs } = await supabase.from('dpa_coverages').select('*')
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
    if (custs && custs.length > 0) selectCustomer(custs[0], conts || [], covs || [])
    setLoading(false)
  }

  function selectCustomer(c: any, allContracts?: any[], allCoverages?: any[]) {
    setSelected(c)
    setEditMode(false)
    setAddMode(false)
    setEditContractId(null)
    const conts = allContracts || contracts
    const covs = allCoverages || coverages
    const cContracts = conts.filter((ct: any) => ct.customer_id === c.id)
    setSelectedContracts(cContracts)
    const ids = cContracts.map((ct: any) => ct.id)
    setSelectedCoverages(covs.filter((cv: any) => ids.includes(cv.contract_id)))
  }

  async function deleteCustomer(c: any, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`${c.name} 님을 삭제할까요?\n관련 계약과 보장 내역도 모두 삭제됩니다.`)) return
    const cContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
    if (cContracts.length > 0) {
      const ids = cContracts.map((ct: any) => ct.id)
      await supabase.from('dpa_coverages').delete().in('contract_id', ids)
      await supabase.from('dpa_contracts').delete().eq('customer_id', c.id)
    }
    await supabase.from('dpa_customers').delete().eq('id', c.id)
    if (selected?.id === c.id) setSelected(null)
    fetchAll()
  }

  async function saveCustomerEdit() {
    await supabase.from('dpa_customers').update(editForm).eq('id', selected.id)
    setEditMode(false)
    fetchAll()
  }

  async function saveContractEdit() {
    await supabase.from('dpa_contracts').update(editContractForm).eq('id', editContractId)
    setEditContractId(null)
    fetchAll()
  }

  async function deleteContract(ctId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('이 보험 계약을 삭제할까요?\n보장 내역도 모두 삭제됩니다.')) return
    await supabase.from('dpa_coverages').delete().eq('contract_id', ctId)
    await supabase.from('dpa_contracts').delete().eq('id', ctId)
    fetchAll()
  }

  async function saveAddCustomer() {
    if (!addForm.name) return alert('고객명은 필수예요!')
    const { data: cust } = await supabase.from('dpa_customers').insert({
      ...addForm, age: parseInt(addForm.age) || null, customer_type: addType
    }).select().single()
    if (cust) {
      setAddMode(false)
      setAddForm(emptyCustomerForm)
      fetchAll()
    }
  }

  const getBadges = (c: any) => {
    const badges = []
    const cContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
    if (cContracts.some((ct: any) => ct.payment_rate >= 90 && ct.payment_status !== '완납'))
      badges.push({ label: '🔥 완납임박', cls: styles.badgeWarn })
    const cCoverages = coverages.filter((cv: any) => cContracts.some((ct: any) => ct.id === cv.contract_id))
    const brainTypes = cCoverages.filter((cv: any) => cv.category === '뇌혈관').map((cv: any) => cv.brain_coverage_type)
    if (brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈'))
      badges.push({ label: '⚠ 보장공백', cls: styles.badgeRed })
    const days = getBirthdayDays(c.birth_date)
    if (days !== null)
      badges.push({ label: `🎂 D-${days}`, cls: days <= 10 ? styles.badgeBirthday : styles.badgeBirthdayFar })
    return badges
  }

  const totalMonthly = selectedContracts.reduce((s, ct) => s + (ct.monthly_fee || 0), 0)

  const filteredCustomers = customers
    .filter(c => c.customer_type === (tab === 'existing' ? 'existing' : 'prospect'))
    .filter(c => ageFilter === '연령대전체' || getAgeGroup(c.age) === ageFilter)

  const getCoveragesByContract = (ctId: string) => {
    const cvs = selectedCoverages.filter(cv => cv.contract_id === ctId)
    return COVERAGE_GROUPS
      .map(g => ({ ...g, items: cvs.filter(cv => cv.category === g.key) }))
      .filter(g => g.items.length > 0)
  }

  const renderDetail = () => (
    <>
      <div className={styles.detailHeader}>
        <div className={[styles.avatar, styles.avLg, selected.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>{selected.name.slice(0, 2)}</div>
        <div style={{ flex: 1 }}>
          <div className={styles.detailName}>{selected.name}</div>
          <div className={styles.detailMeta}>{selected.age}세 · {selected.gender} · {selected.job} · {selected.phone}</div>
        </div>
        {!editMode && <button className={styles.editBtn} onClick={() => { setEditMode(true); setEditForm(selected) }}>수정</button>}
      </div>

      {editMode && (
        <div className={styles.editBox}>
          <div className={styles.editSectionTitle}>개인정보 수정</div>
          <div className={styles.editGrid}>
            {[
              { key: 'name', label: '이름' }, { key: 'phone', label: '연락처' },
              { key: 'job', label: '직업' }, { key: 'address', label: '주소' },
              { key: 'workplace', label: '직장/소속' }, { key: 'bank_name', label: '은행명' },
              { key: 'bank_account', label: '계좌번호' }, { key: 'driver_license', label: '운전면허' },
            ].map(f => (
              <div key={f.key} className={styles.editField}>
                <label>{f.label}</label>
                <input value={editForm[f.key] || ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className={styles.editActions}>
            <button className={styles.saveBtn} onClick={saveCustomerEdit}>저장</button>
            <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
          </div>
        </div>
      )}
      <>
          <div className={styles.infoTable}>
            {selected.address && <div className={styles.infoRow}><span className={styles.infoLabel}>주소</span><span className={styles.infoValue}>{selected.address}</span></div>}
            {selected.workplace && <div className={styles.infoRow}><span className={styles.infoLabel}>직장/소속</span><span className={styles.infoValue}>{selected.workplace}</span></div>}
            {(selected.bank_name || selected.bank_account) && <div className={styles.infoRow}><span className={styles.infoLabel}>계좌번호</span><span className={styles.infoValue}>{selected.bank_name} {selected.bank_account}</span></div>}
            {selected.driver_license && <div className={styles.infoRow}><span className={styles.infoLabel}>운전면허</span><span className={styles.infoValue}>{selected.driver_license}</span></div>}
            <div className={styles.infoRowLast}>
              <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>총 월납입</span><span className={[styles.infoValue, styles.infoGreen].join(' ')}>{totalMonthly.toLocaleString()}원</span></div>
              <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>계약 수</span><span className={styles.infoValue}>{selectedContracts.length}건</span></div>
            </div>
          </div>

          <div className={styles.section}>보험 계약 현황</div>
          {selectedContracts.map((ct, idx) => {
            const groups = getCoveragesByContract(ct.id)
            const isEditing = editContractId === ct.id
            return (
              <div key={ct.id} className={styles.insCard}>
                <div className={styles.insCardHeader}>
                  <div className={styles.insCardLeft}>
                    <div className={styles.insCardTitle}>{idx + 1}. {ct.company}{ct.product_name ? ` · ${ct.product_name}` : ''}</div>
                    <div className={styles.insCardMeta}>
                      {ct.monthly_fee > 0 ? `${ct.monthly_fee.toLocaleString()}원/월` : ''}
                      {ct.contract_start ? ` · ${ct.contract_start} 가입` : ''}
                      {ct.payment_years ? ` · ${ct.payment_years}` : ''}
                      {ct.expiry_age ? ` · ${ct.expiry_age}만기` : ''}
                    </div>
                  </div>
                  <div className={styles.insCardRight}>
                    <span className={[styles.badge, ct.payment_status === '완납' ? styles.badgeGreen : ct.payment_rate >= 90 ? styles.badgeWarn : styles.badgeBlue].join(' ')}>
                      {ct.payment_status === '완납' ? '완납' : `${ct.payment_rate}%`}
                    </span>
                    {ct.insurance_type && <span className={styles.insTypeBadge}>{ct.insurance_type}</span>}
                    <button className={styles.editBtn} onClick={() => { setEditContractId(isEditing ? null : ct.id); setEditContractForm(ct) }}>수정</button>
                    <button className={styles.deleteBtn} onClick={e => deleteContract(ct.id, e)}>삭제</button>
                  </div>
                </div>
                {isEditing && (
                  <div className={styles.contractEditBox}>
                    <div className={styles.editGrid}>
                      {[
                        { key: 'company', label: '보험사' }, { key: 'product_name', label: '상품명' },
                        { key: 'monthly_fee', label: '월보험료' }, { key: 'insurance_type', label: '보험종류' },
                        { key: 'contract_start', label: '가입연월' }, { key: 'payment_years', label: '납입기간' },
                        { key: 'expiry_age', label: '만기' }, { key: 'payment_status', label: '납입상태' },
                      ].map(f => (
                        <div key={f.key} className={styles.editField}>
                          <label>{f.label}</label>
                          <input value={editContractForm[f.key] || ''} onChange={e => setEditContractForm({ ...editContractForm, [f.key]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtn} onClick={saveContractEdit}>저장</button>
                      <button className={styles.cancelBtn} onClick={() => setEditContractId(null)}>취소</button>
                    </div>
                  </div>
                )}
                {groups.length > 0 && (
                  <div className={styles.coverageList}>
                    {groups.map(g => (
                      <div key={g.key} className={styles.coverageRow}>
                        <span className={styles.covIcon}>{g.icon}</span>
                        <span className={styles.covLabel}>{g.label}</span>
                        <span className={styles.covVal}>{g.items.map(cv => `${cv.coverage_name} ${fmtAmount(cv.amount)}`).join(' / ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <a href={`/input?customer_id=${selected.id}`} className={styles.addInsBtn}>+ 보험 추가</a>
        </>
    </>
  )

  const renderAddForm = () => (
    <div className={styles.editBox}>
      <div className={styles.editSectionTitle}>{addType === 'existing' ? '기존 고객' : '잠재 고객'} 추가</div>
      <div className={styles.editGrid}>
        {[
          { key: 'name', label: '이름 *' }, { key: 'phone', label: '연락처' },
          { key: 'age', label: '나이' }, { key: 'gender', label: '성별' },
          { key: 'job', label: '직업' }, { key: 'grade', label: '등급' },
          { key: 'address', label: '주소' }, { key: 'workplace', label: '직장/소속' },
          { key: 'bank_name', label: '은행명' }, { key: 'bank_account', label: '계좌번호' },
          { key: 'driver_license', label: '운전면허' },
        ].map(f => (
          <div key={f.key} className={styles.editField}>
            <label>{f.label}</label>
            <input value={(addForm as any)[f.key] || ''} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className={styles.editActions}>
        <button className={styles.saveBtn} onClick={saveAddCustomer}>저장</button>
        <button className={styles.cancelBtn} onClick={() => setAddMode(false)}>취소</button>
      </div>
    </div>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <button className={[styles.tab, tab === 'existing' ? styles.activeTab : ''].join(' ')} onClick={() => { setTab('existing'); setAddMode(false) }}>기존 고객</button>
        <button className={[styles.tab, tab === 'prospect' ? styles.activeTab : ''].join(' ')} onClick={() => { setTab('prospect'); setAddMode(false) }}>잠재 고객</button>
        <select className={styles.ageFilter} value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
          {AGE_FILTERS.map(f => <option key={f}>{f}</option>)}
        </select>
        <button className={styles.addBtn} onClick={() => { setAddMode(true); setSelected(null); setAddType(tab === 'existing' ? 'existing' : 'prospect') }}>+ 고객 추가</button>
      </div>

      <div className={styles.grid}>
        <div className={styles.listPanel}>
          {loading ? <div className={styles.empty}>불러오는 중...</div> : filteredCustomers.length === 0 ? (
            <div className={styles.empty}>해당 고객이 없어요</div>
          ) : filteredCustomers.map(c => {
            const badges = getBadges(c)
            const cMonthly = contracts.filter((ct: any) => ct.customer_id === c.id).reduce((s: number, ct: any) => s + (ct.monthly_fee || 0), 0)
            const cCount = contracts.filter((ct: any) => ct.customer_id === c.id).length
            return (
              <div key={c.id} className={[styles.custRow, selected?.id === c.id ? styles.active : ''].join(' ')} onClick={() => selectCustomer(c)}>
                <div className={[styles.avatar, c.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>{c.name.slice(0, 2)}</div>
                <div className={styles.custInfo}>
                  <div className={styles.custName}>
                    {c.name}
                    <span className={[styles.badge, c.grade === 'VIP' ? styles.badgeAmber : styles.badgeBlue].join(' ')}>{c.grade}</span>
                  </div>
                  <div className={styles.custMeta}>{c.age}세 · {c.gender} · {c.job} · {cMonthly.toLocaleString()}원 · {cCount}건</div>
                  {badges.length > 0 && (
                    <div className={styles.badgeRow}>
                      {badges.map((b, i) => <span key={i} className={b.cls}>{b.label}</span>)}
                    </div>
                  )}
                </div>
                <div className={styles.custActions}>
                  <button className={styles.editBtn} onClick={e => { e.stopPropagation(); selectCustomer(c); setEditMode(true); setEditForm(c) }}>수정</button>
                  <button className={styles.deleteBtn} onClick={e => deleteCustomer(c, e)}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.detailPanel}>
          {addMode ? renderAddForm() : selected ? renderDetail() : <div className={styles.empty}>고객을 선택해주세요</div>}
        </div>
      </div>
    </div>
  )
}
