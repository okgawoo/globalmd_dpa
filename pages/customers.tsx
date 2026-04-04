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

function IconUsers({ active }: { active: boolean }) {
  const c = active ? '#1D9E75' : '#9CA3AF'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconUser({ active }: { active: boolean }) {
  const c = active ? '#1D9E75' : '#9CA3AF'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
function IconUserPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function formatPhone(val: string): string {
  const num = val.replace(/\D/g, '').slice(0, 11)
  if (num.length <= 3) return num
  if (num.length <= 7) return `${num.slice(0,3)}-${num.slice(3)}`
  return `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
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
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editContractId, setEditContractId] = useState<string | null>(null)
  const [editContractForm, setEditContractForm] = useState<any>({})
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState(emptyCustomerForm)
  const [addType, setAddType] = useState<'existing' | 'prospect'>('existing')
  const [slideOpen, setSlideOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: custs, error: e1 } = await supabase.from('dpa_customers').select('*').order('created_at')
    const { data: conts, error: e2 } = await supabase.from('dpa_contracts').select('*')
    const { data: covs, error: e3 } = await supabase.from('dpa_coverages').select('*')
    if (e1) console.error('customers error:', e1)
    if (e2) console.error('contracts error:', e2)
    if (e3) console.error('coverages error:', e3)
    console.log('custs:', custs?.length, 'conts:', conts?.length)
    setCustomers(custs || [])
    setContracts(conts || [])
    setCoverages(covs || [])
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
    if (window.innerWidth <= 768) setSlideOpen(true)
  }

  function closeSlide() {
    setSlideOpen(false)
    setTimeout(() => { setSelected(null); setEditMode(false) }, 300)
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
    closeSlide()
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
      await fetchAll()
      selectCustomer(cust)
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
    .filter(c => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    })

  const getCoveragesByContract = (ctId: string) => {
    const cvs = selectedCoverages.filter(cv => cv.contract_id === ctId)
    return COVERAGE_GROUPS
      .map(g => ({ ...g, items: cvs.filter((cv: any) => cv.category === g.key) }))
      .filter(g => g.items.length > 0)
  }

  return (
    <div className={styles.wrap}>
      {/* 탭바 */}
      <div className={styles.tabBar}>
        <button
          className={[styles.iconTab, tab === 'existing' ? styles.activeIconTab : ''].join(' ')}
          onClick={() => { setTab('existing'); setAddMode(false); closeSlide() }}
          title="기존 고객"
        >
          <span className={styles.tabIcon}><IconUsers active={tab === 'existing'} /></span>
          <span>기존 고객</span>
        </button>
        <button
          className={[styles.iconTab, tab === 'prospect' ? styles.activeIconTab : ''].join(' ')}
          onClick={() => { setTab('prospect'); setAddMode(false); closeSlide() }}
          title="잠재 고객"
        >
          <span className={styles.tabIcon}><IconUser active={tab === 'prospect'} /></span>
          <span>잠재 고객</span>
        </button>

        <select className={styles.ageFilter} value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
          {AGE_FILTERS.map(f => <option key={f}>{f}</option>)}
        </select>

        <div className={styles.searchBox}>
          <IconSearch />
          <input
            className={styles.searchInput}
            placeholder="검색"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className={styles.addIconBtn}
          onClick={() => { setAddMode(true); setSelected(null); setSlideOpen(false); setAddType(tab === 'existing' ? 'existing' : 'prospect') }}
          title="고객 추가"
        >
          <span className={styles.tabIcon}><IconUserPlus /></span>
          <span>+ 고객 추가</span>
        </button>
      </div>

      {/* 데스크탑: 좌우 분할 / 모바일: 단일 컬럼 */}
      <div className={isMobile ? '' : styles.desktopGrid}>
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
                <button className={styles.editBtn} onClick={e => { e.stopPropagation(); selectCustomer(c); setEditMode(true); setEditForm(c); setAddMode(false) }}>수정</button>
                <button className={styles.deleteBtn} onClick={e => deleteCustomer(c, e)}>삭제</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 데스크탑 상세 패널 */}
      {!isMobile && (
        <div className={styles.detailPanel}>
          {addMode ? (
            <div className={styles.editBox}>
              <div className={styles.editSectionTitle}>{addType === 'existing' ? '기존 고객' : '잠재 고객'} 추가</div>
              <div className={styles.editGrid}>
                <div className={styles.editField}><label>이름 *</label><input placeholder="홍길동" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} /></div>
                <div className={styles.editField}><label>연락처</label><input placeholder="010-0000-0000" inputMode="numeric" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: formatPhone(e.target.value) })} /></div>
                <div className={styles.editField}><label>나이</label><input placeholder="나이" inputMode="numeric" value={addForm.age} onChange={e => setAddForm({ ...addForm, age: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                <div className={styles.editField}><label>성별</label>
                  <select value={addForm.gender} onChange={e => setAddForm({ ...addForm, gender: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                    <option>남</option><option>여</option><option>기타</option>
                  </select>
                </div>
                <div className={styles.editField}><label>직업</label>
                  <select value={addForm.job} onChange={e => setAddForm({ ...addForm, job: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                    {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>
                <div className={styles.editField}><label>등급</label>
                  <select value={addForm.grade} onChange={e => setAddForm({ ...addForm, grade: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                    <option>일반</option><option>VIP</option>
                  </select>
                </div>
                <div className={styles.editField}><label>주소</label><input placeholder="서울시 강남구..." value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} /></div>
                <div className={styles.editField}><label>직장/소속</label><input placeholder="직장명" value={addForm.workplace} onChange={e => setAddForm({ ...addForm, workplace: e.target.value })} /></div>
              </div>
              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={saveAddCustomer}>저장</button>
                <button className={styles.cancelBtn} onClick={() => setAddMode(false)}>취소</button>
              </div>
            </div>
          ) : selected ? (
            <div className={styles.slideContent}>
              <div className={styles.slideHeader}>
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
                    <div className={styles.editField}><label>이름</label><input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
                    <div className={styles.editField}><label>연락처</label><input inputMode="numeric" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:formatPhone(e.target.value)})} /></div>
                    <div className={styles.editField}><label>성별</label>
                      <select value={editForm.gender||'남'} onChange={e=>setEditForm({...editForm,gender:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        <option>남</option><option>여</option><option>기타</option>
                      </select>
                    </div>
                    <div className={styles.editField}><label>직업</label>
                      <select value={editForm.job||'직장인'} onChange={e=>setEditForm({...editForm,job:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j=><option key={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>주소</label><input value={editForm.address||''} onChange={e=>setEditForm({...editForm,address:e.target.value})} /></div>
                    <div className={styles.editField}><label>직장/소속</label><input value={editForm.workplace||''} onChange={e=>setEditForm({...editForm,workplace:e.target.value})} /></div>
                    <div className={styles.editField}><label>은행명</label><input value={editForm.bank_name||''} onChange={e=>setEditForm({...editForm,bank_name:e.target.value})} /></div>
                    <div className={styles.editField}><label>계좌번호</label><input value={editForm.bank_account||''} onChange={e=>setEditForm({...editForm,bank_account:e.target.value.replace(/[^0-9-]/g,'')})} inputMode="numeric" /></div>
                  </div>
                  <div className={styles.editActions}>
                    <button className={styles.saveBtn} onClick={saveCustomerEdit}>저장</button>
                    <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                  </div>
                </div>
              )}
              <div className={styles.infoTable}>
                {selected.age && <div className={styles.infoRow}><span className={styles.infoLabel}>나이</span><span className={styles.infoValue}>{selected.age}세</span></div>}
                {selected.gender && <div className={styles.infoRow}><span className={styles.infoLabel}>성별</span><span className={styles.infoValue}>{selected.gender}</span></div>}
                {selected.phone && <div className={styles.infoRow}><span className={styles.infoLabel}>연락처</span><span className={styles.infoValue}>{selected.phone}</span></div>}
                {selected.job && <div className={styles.infoRow}><span className={styles.infoLabel}>직업</span><span className={styles.infoValue}>{selected.job}</span></div>}
                {selected.address && <div className={styles.infoRow}><span className={styles.infoLabel}>주소</span><span className={styles.infoValue}>{selected.address}</span></div>}
                {selected.workplace && <div className={styles.infoRow}><span className={styles.infoLabel}>직장/소속</span><span className={styles.infoValue}>{selected.workplace}</span></div>}
                {(selected.bank_name || selected.bank_account) && <div className={styles.infoRow}><span className={styles.infoLabel}>계좌번호</span><span className={styles.infoValue}>{selected.bank_name} {selected.bank_account}</span></div>}
                {selected.driver_license && <div className={styles.infoRow}><span className={styles.infoLabel}>운전면허</span><span className={styles.infoValue}>{selected.driver_license}</span></div>}
                <div className={styles.infoRowLast}>
                  <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>총 월납입</span><span className={[styles.infoValue, styles.infoGreen].join(' ')}>{selectedContracts.reduce((s,ct)=>s+(ct.monthly_fee||0),0).toLocaleString()}원</span></div>
                  <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>계약 수</span><span className={styles.infoValue}>{selectedContracts.length}건</span></div>
                </div>
              </div>
              <div className={styles.section}>보험 계약 현황</div>
              {selectedContracts.map((ct, idx) => {
                const cvs = selectedCoverages.filter(cv => cv.contract_id === ct.id)
                const groups = COVERAGE_GROUPS.map(g => ({ ...g, items: cvs.filter((cv:any) => cv.category === g.key) })).filter(g => g.items.length > 0)
                return (
                  <div key={ct.id} className={styles.insCard}>
                    <div className={styles.insCardHeader}>
                      <div className={styles.insCardLeft}>
                        <div className={styles.insCardTitle}>{idx+1}. {ct.company}{ct.product_name ? ` · ${ct.product_name}` : ''}</div>
                        <div className={styles.insCardMeta}>{ct.monthly_fee>0?`${ct.monthly_fee.toLocaleString()}원/월`:''}{ct.payment_years?` · ${ct.payment_years}`:''}{ct.expiry_age?` · ${ct.expiry_age}만기`:''}</div>
                      </div>
                      <div className={styles.insCardRight}>
                        <span className={[styles.badge, ct.payment_status==='완납'?styles.badgeGreen:ct.payment_rate>=90?styles.badgeWarn:styles.badgeBlue].join(' ')}>{ct.payment_status==='완납'?'완납':`${ct.payment_rate}%`}</span>
                        {ct.insurance_type && <span className={styles.insTypeBadge}>{ct.insurance_type}</span>}
                      </div>
                    </div>
                    {groups.length > 0 && (
                      <div className={styles.coverageList}>
                        {groups.map(g => (
                          <div key={g.key} className={styles.coverageRow}>
                            <span className={styles.covIcon}>{g.icon}</span>
                            <span className={styles.covLabel}>{g.label}</span>
                            <span className={styles.covVal}>{g.items.map((cv:any) => `${cv.coverage_name} ${cv.amount>=10000?`${(cv.amount/10000).toFixed(0)}만원`:cv.amount+'원'}`).join(' / ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <a href={`/input?customer_id=${selected.id}`} className={styles.addInsBtn}>+ 보험 추가</a>
            </div>
          ) : (
            <div className={styles.empty}>고객을 선택해주세요</div>
          )}
        </div>
      )}
      </div>

      {/* 슬라이드업 팝업 (모바일 전용) */}
      <div className={[styles.slideOverlay, slideOpen ? styles.overlayVisible : ''].join(' ')} onClick={closeSlide}>
        <div className={[styles.slidePanel, slideOpen ? styles.slideIn : styles.slideOut].join(' ')} onClick={e => e.stopPropagation()}>
          <div className={styles.slideHandle} />
          <div className={styles.slideContent}>
            {selected && (
              <>
                <div className={styles.slideHeader}>
                  <div className={[styles.avatar, styles.avLg, selected.grade === 'VIP' ? styles.avVip : styles.avNormal].join(' ')}>{selected.name.slice(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.detailName}>{selected.name}</div>
                    <div className={styles.detailMeta}>{selected.age}세 · {selected.gender} · {selected.job} · {selected.phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {!editMode && <button className={styles.editBtn} onClick={() => { setEditMode(true); setEditForm(selected) }}>수정</button>}
                    <button className={styles.slideCloseBtn} onClick={closeSlide}>✕</button>
                  </div>
                </div>

                {editMode && (
                  <div className={styles.editBox}>
                    <div className={styles.editSectionTitle}>개인정보 수정</div>
                    <div className={styles.editGrid}>
                      <div className={styles.editField}><label>이름</label><input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
                      <div className={styles.editField}><label>연락처</label><input inputMode="numeric" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:formatPhone(e.target.value)})} /></div>
                      <div className={styles.editField}><label>성별</label>
                        <select value={editForm.gender||'남'} onChange={e=>setEditForm({...editForm,gender:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                          <option>남</option><option>여</option><option>기타</option>
                        </select>
                      </div>
                      <div className={styles.editField}><label>직업</label>
                        <select value={editForm.job||'직장인'} onChange={e=>setEditForm({...editForm,job:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                          {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j=><option key={j}>{j}</option>)}
                        </select>
                      </div>
                      <div className={styles.editField}><label>주소</label><input value={editForm.address||''} onChange={e=>setEditForm({...editForm,address:e.target.value})} /></div>
                      <div className={styles.editField}><label>직장/소속</label><input value={editForm.workplace||''} onChange={e=>setEditForm({...editForm,workplace:e.target.value})} /></div>
                      <div className={styles.editField}><label>은행명</label><input value={editForm.bank_name||''} onChange={e=>setEditForm({...editForm,bank_name:e.target.value})} /></div>
                      <div className={styles.editField}><label>계좌번호</label><input inputMode="numeric" value={editForm.bank_account||''} onChange={e=>setEditForm({...editForm,bank_account:e.target.value.replace(/[^0-9-]/g,'')})} /></div>
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtn} onClick={saveCustomerEdit}>저장</button>
                      <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                    </div>
                  </div>
                )}

                <div className={styles.infoTable}>
                  <div className={styles.infoRowDouble}>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>나이</span><span className={styles.infoValue}>{selected.age}세</span></div>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>성별</span><span className={styles.infoValue}>{selected.gender}</span></div>
                  </div>
                  <div className={styles.infoRowDouble}>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>연락처</span><span className={styles.infoValue}>{selected.phone}</span></div>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>직업</span><span className={styles.infoValue}>{selected.job}</span></div>
                  </div>
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
                              <span className={styles.covVal}>{g.items.map((cv: any) => `${cv.coverage_name} ${fmtAmount(cv.amount)}`).join(' / ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <a href={`/input?customer_id=${selected.id}`} className={styles.addInsBtn}>+ 보험 추가</a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
