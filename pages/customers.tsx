import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
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
  name: '', resident_number: '', age: '', gender: '남', job: '직장인', phone: '', grade: '일반',
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

function formatResident(val: string): string {
  const num = val.replace(/\D/g, '').slice(0, 13)
  if (num.length <= 6) return num
  return `${num.slice(0,6)}-${num.slice(6)}`
}

function parseResident(rn: string): { gender: string; age: number; birthDate: string } {
  const num = rn.replace(/-/g, '')
  if (num.length < 7) return { gender: '남', age: 0, birthDate: '' }
  const firstDigit = parseInt(num[6])
  const gender = [2,4,6,8].includes(firstDigit) ? '여' : '남'
  const year = [1,2].includes(firstDigit) ? 1900 : 2000
  const fullYear = year + parseInt(num.slice(0,2))
  const month = parseInt(num.slice(2,4))
  const day = parseInt(num.slice(4,6))
  const today = new Date()
  let age = today.getFullYear() - fullYear
  if (today.getMonth()+1 < month || (today.getMonth()+1 === month && today.getDate() < day)) age--
  const birthDate = `${fullYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  return { gender, age, birthDate }
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
  const { confirm, ConfirmDialog } = useConfirm()
  const [addInsMode, setAddInsMode] = useState(false)
  const [insForm, setInsForm] = useState({ company: '삼성생명', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
  const [insCoverages, setInsCoverages] = useState<any[]>([])
  const [newCov, setNewCov] = useState({ category: '암진단', coverage_name: '', amount: '' })
  // 고객 추가 시 보험 목록 (미리 쌓아두다가 한번에 저장)
  const [addContracts, setAddContracts] = useState<any[]>([{company:'삼성생명',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
  const [addInsForm, setAddInsForm] = useState({ company: '삼성생명', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
  const [addInsCoverages, setAddInsCoverages] = useState<any[]>([])
  const [addNewCov, setAddNewCov] = useState({ category: '암진단', coverage_name: '', amount: '' })
  const [showAddInsForm, setShowAddInsForm] = useState(false)

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
    const ok = await confirm({ title: '고객 삭제', message: `${c.name} 님을 삭제할까요?\n관련 계약과 보장 내역도 모두 삭제됩니다.`, confirmText: '삭제', danger: true })
    if (!ok) return
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
    const ok = await confirm({ title: '계약 삭제', message: '이 보험 계약을 삭제할까요?\n보장 내역도 모두 삭제됩니다.', confirmText: '삭제', danger: true })
    if (!ok) return
    await supabase.from('dpa_coverages').delete().eq('contract_id', ctId)
    await supabase.from('dpa_contracts').delete().eq('id', ctId)
    fetchAll()
  }

  async function saveAddCustomer() {
    if (!addForm.name) return alert('고객명은 필수예요!')
    const { gender, age, birthDate } = parseResident(addForm.resident_number)
    const { data: cust } = await supabase.from('dpa_customers').insert({
      ...addForm,
      age: age || parseInt(addForm.age) || null,
      gender: addForm.resident_number.length >= 8 ? gender : addForm.gender,
      birth_date: birthDate || null,
      resident_number: addForm.resident_number,
      customer_type: addType
    }).select().single()
    if (cust) {
      // 보험 계약도 한번에 저장
      for (const ct of addContracts) {
        const totalM = parseInt(ct.total_months) || 0
        const paidM = parseInt(ct.paid_months) || 0
        const payRate = totalM > 0 ? Math.round(paidM / totalM * 100) : 0
        const { data: savedCt } = await supabase.from('dpa_contracts').insert({
          customer_id: cust.id,
          company: ct.company, product_name: ct.product_name,
          insurance_type: ct.insurance_type,
          monthly_fee: parseInt(ct.monthly_fee) || 0,
          payment_status: ct.payment_status,
          payment_years: ct.payment_years,
          expiry_age: ct.expiry_age,
          contract_start: ct.contract_start,
          payment_rate: payRate
        }).select().single()
        if (savedCt && ct.coverages.length > 0) {
          await supabase.from('dpa_coverages').insert(
            ct.coverages.map((cv: any) => ({ contract_id: savedCt.id, category: cv.category, coverage_name: cv.coverage_name, amount: parseInt(cv.amount) || 0 }))
          )
        }
      }
      setAddMode(false)
      setAddForm(emptyCustomerForm)
      setAddContracts([{company:'삼성생명',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
      setShowAddInsForm(false)
      await fetchAll()
      selectCustomer(cust)
    }
  }

  async function saveInsurance() {
    if (!selected) return
    if (!insForm.company || !insForm.monthly_fee) return alert('보험사와 월보험료는 필수예요!')
    const { data: ct } = await supabase.from('dpa_contracts').insert({
      customer_id: selected.id,
      company: insForm.company, product_name: insForm.product_name,
      insurance_type: insForm.insurance_type,
      monthly_fee: parseInt(insForm.monthly_fee) || 0,
      payment_status: insForm.payment_status,
      payment_years: insForm.payment_years,
      expiry_age: insForm.expiry_age,
      contract_start: insForm.contract_start,
      payment_rate: 0
    }).select().single()
    if (ct && insCoverages.length > 0) {
      await supabase.from('dpa_coverages').insert(
        insCoverages.map(cv => ({ contract_id: ct.id, category: cv.category, coverage_name: cv.coverage_name, amount: parseInt(cv.amount) || 0 }))
      )
    }
    setAddInsMode(false)
    setInsForm({ company: '삼성생명', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
    setInsCoverages([])
    setNewCov({ category: '암진단', coverage_name: '', amount: '' })
    fetchAll()
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
                <div className={styles.editField}><label>이름 *</label><input placeholder="홍길동" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value.replace(/[0-9]/g, '') })} /></div>
                <div className={styles.editField}><label>연락처</label><input placeholder="010-0000-0000" inputMode="numeric" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: formatPhone(e.target.value) })} /></div>
                <div className={styles.editField} style={{gridColumn:'span 2'}}><label>주민등록번호 *</label>
                  <input placeholder="000000-0000000" inputMode="numeric" value={addForm.resident_number}
                    onChange={e => {
                      const rn = formatResident(e.target.value)
                      const parsed = parseResident(rn)
                      setAddForm({ ...addForm, resident_number: rn, gender: parsed.gender, age: String(parsed.age) })
                    }} />
                  {addForm.resident_number.length >= 8 && <span style={{fontSize:11,color:'#1D9E75',marginTop:3}}>✓ {addForm.gender} · 만 {addForm.age}세</span>}
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
              {/* 보험 폼들이 쌓이는 구조 */}
              {addContracts.map((ct:any, i:number) => (
                <div key={i} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:12,padding:14,marginTop:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div className={styles.editSectionTitle} style={{margin:0}}>보험 {i+1}</div>
                    {addContracts.length > 1 && <button onClick={()=>setAddContracts((v:any)=>v.filter((_:any,j:number)=>j!==i))} style={{background:'none',border:'none',color:'#9CA3AF',cursor:'pointer',fontSize:12}}>✕ 삭제</button>}
                  </div>
                  <div className={styles.editGrid}>
                    <div className={styles.editField}><label>보험사</label>
                      <select value={ct.company} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,company:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['삼성생명','한화생명','교보생명','신한라이프','DB생명','흥국생명','동양생명','미래에셋생명','삼성화재','현대해상','DB손해보험','KB손해보험','메리츠화재','롯데손해보험','기타'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>상품명</label><input value={ct.product_name} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,product_name:e.target.value}:c))} placeholder="무배당 건강보험" /></div>
                    <div className={styles.editField}><label>보험 종류</label>
                      <select value={ct.insurance_type} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,insurance_type:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['건강','실손','운전자','자동차','암','치아','간병','CI','종신','기타'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>월보험료(원) *</label><input inputMode="numeric" value={ct.monthly_fee} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,monthly_fee:e.target.value.replace(/[^0-9]/g,'')}:c))} placeholder="50000" /></div>
                    <div className={styles.editField}><label>납입상태</label>
                      <select value={ct.payment_status} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,payment_status:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        <option>유지</option><option>완납</option><option>실효</option>
                      </select>
                    </div>
                    <div className={styles.editField}><label>가입연월</label><input value={ct.contract_start} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,contract_start:e.target.value}:c))} placeholder="2020.01" /></div>
                    <div className={styles.editField}><label>납입기간</label><input value={ct.payment_years} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,payment_years:e.target.value}:c))} placeholder="20년납" /></div>
                    <div className={styles.editField}><label>만기</label><input value={ct.expiry_age} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,expiry_age:e.target.value}:c))} placeholder="90세" /></div>
                    <div className={styles.editField}><label>총 납입 회차</label><input inputMode="numeric" value={ct.total_months||''} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,total_months:e.target.value.replace(/[^0-9]/g,'')}:c))} placeholder="120" /></div>
                    <div className={styles.editField}><label>완료 회차</label><input inputMode="numeric" value={ct.paid_months||''} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,paid_months:e.target.value.replace(/[^0-9]/g,'')}:c))} placeholder="36" /></div>
                    <div className={styles.editField} style={{gridColumn:'span 2'}}>
                      <label>납입률 (%) <span style={{fontSize:10,color:'#1D9E75',fontWeight:600}}>자동</span></label>
                      <input readOnly value={ct.total_months&&ct.paid_months ? `${Math.round(parseInt(ct.paid_months)/parseInt(ct.total_months)*100)}%` : '자동 계산'} style={{background:'#F9FAFB',color:'#6B7280'}} />
                    </div>
                  </div>
                  {/* 보장 항목 - 수동입력과 완전 동일 */}
                  <div style={{marginTop:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color:'#374151'}}>보장 항목</span>
                      <button style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #1D9E75',background:'#E1F5EE',color:'#085041',cursor:'pointer'}}
                        onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,showCovForm:!c.showCovForm}:c))}>+ 보장 추가</button>
                    </div>
                    {ct.showCovForm && (
                      <div style={{background:'#FAF9F5',border:'1px solid #1D9E75',borderRadius:10,padding:12,marginBottom:8}}>
                        <div className={styles.editGrid} style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                          <div className={styles.editField}><label>카테고리</label>
                            <select value={addNewCov.category} onChange={e=>setAddNewCov({...addNewCov,category:e.target.value})} style={{width:'100%',fontSize:13,padding:'9px 12px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F9FAFB'}}>
                              {['암진단','뇌혈관','심장','간병','수술비','실손','비급여','상해','사고처리','벌금','특이사항'].map(c=><option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className={styles.editField}><label>보장명</label><input value={addNewCov.coverage_name} onChange={e=>setAddNewCov({...addNewCov,coverage_name:e.target.value})} placeholder="예: 급성심근경색진단비" style={{background:'#F9FAFB'}} /></div>
                          <div className={styles.editField}><label>금액 (원)</label><input inputMode="numeric" value={addNewCov.amount} onChange={e=>setAddNewCov({...addNewCov,amount:e.target.value.replace(/[^0-9]/g,'')})} placeholder="예: 30000000" style={{background:'#F9FAFB'}} /></div>
                        </div>
                        <div style={{display:'flex',gap:6,marginTop:8}}>
                          <button style={{flex:1,padding:'7px',fontSize:13,background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer'}}
                            onClick={()=>{if(addNewCov.coverage_name&&addNewCov.amount){setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,coverages:[...c.coverages,addNewCov],showCovForm:false}:c));setAddNewCov({category:'암진단',coverage_name:'',amount:''})}}}>추가하기</button>
                          <button style={{padding:'7px 14px',fontSize:13,background:'#fff',color:'#6B7280',border:'1px solid #E5E7EB',borderRadius:8,cursor:'pointer'}}
                            onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,showCovForm:false}:c))}>닫기</button>
                        </div>
                      </div>
                    )}
                    {ct.coverages.length > 0 && (
                      <div style={{border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden'}}>
                        {ct.coverages.map((cv:any,ci:number)=>(
                          <div key={ci} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'6px 10px',borderBottom:'0.5px solid #F3F4F6'}}>
                            <span style={{color:'#6B7280',minWidth:55,fontSize:11}}>{cv.category}</span>
                            <span style={{flex:1,color:'#111827'}}>{cv.coverage_name}</span>
                            <span style={{color:'#1D9E75',fontWeight:600}}>{parseInt(cv.amount).toLocaleString()}원</span>
                            <button onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,coverages:c.coverages.filter((_:any,k:number)=>k!==ci)}:c))} style={{background:'none',border:'none',color:'#D1D5DB',cursor:'pointer',fontSize:13}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* + 보험 추가 버튼 */}
              <button style={{display:'block',width:'100%',padding:'10px',marginBottom:12,border:'1.5px dashed #E5E7EB',borderRadius:10,background:'#FAF9F5',color:'#9CA3AF',fontSize:13,cursor:'pointer',textAlign:'center',marginTop:12}}
                onMouseOver={e=>{(e.target as HTMLButtonElement).style.borderColor='#1D9E75';(e.target as HTMLButtonElement).style.color='#1D9E75';(e.target as HTMLButtonElement).style.background='#E1F5EE'}}
                onMouseOut={e=>{(e.target as HTMLButtonElement).style.borderColor='#E5E7EB';(e.target as HTMLButtonElement).style.color='#9CA3AF';(e.target as HTMLButtonElement).style.background='#FAF9F5'}}
                onClick={()=>{
                  if(!addForm.name) return alert('이름을 먼저 입력해주세요!')
                  setAddContracts((v:any)=>[...v,{company:'삼성생명',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
                }}>+ 보험 추가</button>

              {/* 저장/취소 - 우측 정렬 */}
              <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #E5E7EB'}}>
                <button onClick={saveAddCustomer} style={{width:"100%",marginTop:12,padding:"7px",background:"#1D9E75",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:8}}>저장하기</button>
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <button className={styles.cancelBtn} style={{borderColor:'#9CA3AF'}} onClick={() => { setAddMode(false); setAddContracts([{company:'삼성생명',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}]) }}>취소</button>
                </div>
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
              {!addInsMode ? (
                <button className={styles.addInsBtn} onClick={() => setAddInsMode(true)} style={{display:'block',width:'100%',textAlign:'center',cursor:'pointer',background:'none',border:'1px dashed #D1D5DB',borderRadius:8,padding:'8px',color:'#6B7280',fontSize:13}}>+ 보험 추가</button>
              ) : (
                <div className={styles.editBox}>
                  <div className={styles.editSectionTitle}>보험 추가</div>
                  <div className={styles.editGrid}>
                    <div className={styles.editField}><label>보험사</label>
                      <select value={insForm.company} onChange={e=>setInsForm({...insForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['삼성생명','한화생명','교보생명','신한라이프','DB생명','흥국생명','동양생명','미래에셋생명','삼성화재','현대해상','DB손해보험','KB손해보험','메리츠화재','롯데손해보험','기타'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>상품명</label><input value={insForm.product_name} onChange={e=>setInsForm({...insForm,product_name:e.target.value})} placeholder="무배당 건강보험" /></div>
                    <div className={styles.editField}><label>보험 종류</label>
                      <select value={insForm.insurance_type} onChange={e=>setInsForm({...insForm,insurance_type:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['건강','실손','운전자','자동차','암','치아','간병','CI','종신','기타'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>월보험료(원) *</label><input inputMode="numeric" value={insForm.monthly_fee} onChange={e=>setInsForm({...insForm,monthly_fee:e.target.value.replace(/[^0-9]/g,'')})} placeholder="50000" /></div>
                    <div className={styles.editField}><label>납입상태</label>
                      <select value={insForm.payment_status} onChange={e=>setInsForm({...insForm,payment_status:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        <option>유지</option><option>완납</option><option>실효</option>
                      </select>
                    </div>
                    <div className={styles.editField}><label>가입연월</label><input value={insForm.contract_start} onChange={e=>setInsForm({...insForm,contract_start:e.target.value})} placeholder="2020.01" /></div>
                    <div className={styles.editField}><label>납입기간</label><input value={insForm.payment_years} onChange={e=>setInsForm({...insForm,payment_years:e.target.value})} placeholder="20년납" /></div>
                    <div className={styles.editField}><label>만기</label><input value={insForm.expiry_age} onChange={e=>setInsForm({...insForm,expiry_age:e.target.value})} placeholder="90세" /></div>
                  </div>
                  <div className={styles.editSectionTitle} style={{marginTop:12}}>보장 항목</div>
                  {insCoverages.map((cv,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #E5E7EB'}}>
                      <span style={{color:'#6B7280',minWidth:60}}>{cv.category}</span>
                      <span style={{flex:1}}>{cv.coverage_name}</span>
                      <span style={{color:'#1D9E75',fontWeight:600}}>{parseInt(cv.amount).toLocaleString()}원</span>
                      <button onClick={()=>setInsCoverages(v=>v.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#9CA3AF',cursor:'pointer',fontSize:13}}>✕</button>
                    </div>
                  ))}
                  <div className={styles.editGrid} style={{marginTop:8}}>
                    <div className={styles.editField}><label>카테고리</label>
                      <select value={newCov.category} onChange={e=>setNewCov({...newCov,category:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                        {['암진단','뇌혈관','심장','간병','수술비','실손','비급여','상해','사고처리','벌금','특이사항'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>보장명</label><input value={newCov.coverage_name} onChange={e=>setNewCov({...newCov,coverage_name:e.target.value})} placeholder="뇌출혈진단비" /></div>
                    <div className={styles.editField}><label>금액(원)</label><input inputMode="numeric" value={newCov.amount} onChange={e=>setNewCov({...newCov,amount:e.target.value.replace(/[^0-9]/g,'')})} placeholder="30000000" /></div>
                    <div className={styles.editField} style={{display:'flex',alignItems:'flex-end'}}>
                      <button className={styles.saveBtn} style={{width:'100%'}} onClick={()=>{ if(newCov.coverage_name&&newCov.amount){setInsCoverages(v=>[...v,newCov]);setNewCov({category:'암진단',coverage_name:'',amount:''})}}}>+ 추가</button>
                    </div>
                  </div>
                  <div className={styles.editActions} style={{marginTop:12}}>
                    <button className={styles.saveBtn} onClick={saveInsurance}>저장</button>
                    <button className={styles.cancelBtn} onClick={()=>{setAddInsMode(false);setInsCoverages([])}}>취소</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.empty}>고객을 선택해주세요</div>
          )}
        </div>
      )}
      </div>

      {ConfirmDialog}
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
