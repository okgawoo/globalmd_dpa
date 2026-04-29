import { useEffect, useState, useRef } from 'react'
import SmsSlidePanel from '../components/SmsSlide'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import styles from '../styles/Customers.module.css'
import { Users, User, UserPlus, Search } from 'lucide-react'

type Tab = 'existing' | 'prospect'
const AGE_FILTERS = ['연령대전체', '유아(0-7)', '10대', '20대', '30대', '40대', '50대', '60대+']

// 보험사 목록
const SONHAE_COMPANIES = ['삼성화재','현대해상','DB손해보험','KB손해보험','메리츠화재','흥국화재','롯데손해보험','MG손해보험','한화손해보험','AIG손해보험','NH농협손해보험','하나손해보험','캐롯손해보험','AXA손해보험']
const SAENGMYEONG_COMPANIES = ['삼성생명','한화생명','교보생명','신한라이프','DB생명','흥국생명','동양생명','미래에셋생명','푸본현대생명','메트라이프','AIA생명','라이나생명','하나생명','ABL생명','KDB생명','NH농협생명','KB라이프','처브라이프','카디프생명','iM라이프','IBK연금보험','PCA생명','유니버셜생명','오렌지라이프','푸르덴셜생명','MG새마을금고']
const INSURANCE_TYPES = ['건강','실손','운전자','자동차','암','치아','간병','CI','종신','기타']
const PAYMENT_STATUSES = ['유지','완납','실효','실납','해지']
const PAYMENT_YEARS = ['1년납','3년납','5년납','10년납','15년납','20년납','25년납','30년납','40년납','전기납','종신납','일시납']
const EXPIRY_AGES = ['60세','65세','70세','75세','80세','85세','90세','95세','100세','종신']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({length: 30}, (_, i) => String(CURRENT_YEAR - i))
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']

// 가입연월 파싱 (YYYY.MM → {year, month})
function parseContractStart(v: string): {year: string, month: string} {
  if (!v) return {year: '', month: ''}
  const [y, m] = v.split('.')
  return {year: y || '', month: m ? m.padStart(2,'0') : ''}
}
// 가입연월 합치기
function joinContractStart(year: string, month: string): string {
  if (!year || !month) return ''
  return `${year}.${month}`
}

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
  if (!n && n !== 0) return ''
  if (n >= 100000000) {
    const v = n / 100000000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '억원'
  }
  if (n >= 10000000) {
    const v = n / 10000000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '천만원'
  }
  if (n >= 10000) {
    const v = n / 10000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '만원'
  }
  return n.toLocaleString() + '원'
}

// 납입률 실시간 계산 함수
function calcPaymentRate(ct: any): number {
  if (ct.payment_status === '완납') return 100
  // contract_start(YYYY.MM)와 payment_years(20년납) 있으면 자동 계산
  if (ct.contract_start && ct.payment_years) {
    const match = ct.payment_years.match(/(\d+)년/)
    if (match) {
      const totalMonths = parseInt(match[1]) * 12
      const [year, month] = ct.contract_start.split('.').map(Number)
      if (year && month) {
        const now = new Date()
        const paidMonths = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1
        const rate = Math.min(Math.round(Math.max(0, paidMonths) / totalMonths * 100), 100)
        return rate
      }
    }
  }
  // fallback: DB 저장값 사용
  return ct.payment_rate || 0
}

const emptyCustomerForm = {
  name: '', resident_number: '', age: '', gender: '남', job: '직장인', phone: '', grade: '일반',
  address: '', workplace: '', bank_name: '', bank_account: '', driver_license: ''
}


function formatMoney(val: string): string {
  const num = val.replace(/[^0-9]/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function parseMoney(val: string): string {
  return val.replace(/,/g, '')
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
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('tab')
      if (t === 'prospect') return 'prospect'
    }
    return 'existing'
  })
  const handleTabChange = (t: Tab) => {
    setTab(t)
    router.replace({ pathname: router.pathname, query: { ...router.query, tab: t } }, undefined, { shallow: true })
  }
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [coverages, setCoverages] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCustomer, setSmsCustomer] = useState<any>(null)
  const [agentId, setAgentId] = useState<string>('')
  const [selectedContracts, setSelectedContracts] = useState<any[]>([])
  const [selectedCoverages, setSelectedCoverages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ageFilter, setAgeFilter] = useState('연령대전체')
  const [sortFilter, setSortFilter] = useState('최신 등록순')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editContractId, setEditContractId] = useState<string | null>(null)
  const [editContractForm, setEditContractForm] = useState<any>({})
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState(emptyCustomerForm)
  const [addType, setAddType] = useState<'existing' | 'prospect'>('existing')
  const [slideOpen, setSlideOpen] = useState(false)

  // URL 파라미터로 필터 자동 적용
  useEffect(() => {
    if (!router.isReady) return
    const sort = router.query.sort as string
    if (sort === 'AI추천') setSortFilter('🤖 AI추천 일정')
    else if (sort === '완납임박') setSortFilter('🔥 완납 임박순')
    else if (sort === '생일임박') setSortFilter('🎂 생일 임박순')
    else if (sort === '보장공백') setSortFilter('⚠️ 보장 공백순')
  }, [router.isReady, router.query.sort])

  // id 파라미터로 고객 슬라이드 자동 오픈
  useEffect(() => {
    if (!router.isReady || customers.length === 0) return
    const id = router.query.id as string
    if (id) {
      const target = customers.find(c => c.id === id)
      if (target) {
        // 해당 고객 타입에 맞게 탭 자동 전환
        if (target.customer_type === 'existing') handleTabChange('existing')
        else if (target.customer_type === 'prospect') handleTabChange('prospect')
        selectCustomer(target)
        // URL에서 id 파라미터 제거 (desktopGrid 깜빡임 방지)
        router.replace('/customers', undefined, { shallow: true })
        // 해당 고객 행을 리스트 맨 위로 스크롤
        setTimeout(() => {
          const el = document.getElementById(`customer-row-${id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 150)
      }
    }
  }, [router.isReady, router.query.id, customers])
  const isMobile = useIsMobile()
  const slideContentRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const selectedRef = useRef<any>(null)
  const zoomWrapperRef = useRef<HTMLDivElement>(null)
  const zoomStateRef = useRef({ scale: 1, tx: 0, ty: 0 })
  const { confirm, ConfirmDialog } = useConfirm()
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(new Set())
  const [reentryOpen, setReentryOpen] = useState(false)
  const [reentryTextFixed, setReentryTextFixed] = useState('')
  const [reentryTextLoss, setReentryTextLoss] = useState('')
  const [reentryParsing, setReentryParsing] = useState(false)
  const [reentryParsed, setReentryParsed] = useState<any>(null)
  const [reentryReplaceId, setReentryReplaceId] = useState<string | null>(null)
  const [reentryAddMode, setReentryAddMode] = useState(false)
  const [reSaving, setReSaving] = useState(false)
  const [reentryReturning, setReentryReturning] = useState(false)
  const reentryTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [addInsMode, setAddInsMode] = useState(false)
  const [insForm, setInsForm] = useState({ company: '', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
  const [insCoverages, setInsCoverages] = useState<any[]>([])
  const [newCov, setNewCov] = useState({ category: '암진단', coverage_name: '', amount: '' })
  // 고객 추가 시 보험 목록 (미리 쌓아두다가 한번에 저장)
  const [addContracts, setAddContracts] = useState<any[]>([{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
  const [addInsForm, setAddInsForm] = useState({ company: '', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
  const [addInsCoverages, setAddInsCoverages] = useState<any[]>([])
  const [addNewCov, setAddNewCov] = useState({ category: '암진단', coverage_name: '', amount: '' })
  const [showAddInsForm, setShowAddInsForm] = useState(false)

  useEffect(() => { fetchAll() }, [])

  // selectedRef 동기화 — fetchAll 내에서 stale closure 없이 현재 선택 고객 참조
  useEffect(() => { selectedRef.current = selected }, [selected])

  // 뒤로가기 버튼으로 슬라이드 닫기
  useEffect(() => {
    if (slideOpen) {
      window.history.pushState({ slideOpen: true }, '')
      const onPop = () => closeSlide()
      window.addEventListener('popstate', onPop)
      return () => window.removeEventListener('popstate', onPop)
    }
  }, [slideOpen])

  // 슬라이드 팝업 커스텀 pinch-zoom / pan (CSS transform 기반)
  useEffect(() => {
    const content = slideContentRef.current
    if (!content) return
    const MIN = 1, MAX = 4
    let mode: 'none' | 'pinch' | 'pan' = 'none'
    let startDist = 0
    let pivot = { x: 0, y: 0 }
    let startScale = 1
    let startTx = 0
    let startTy = 0
    let startTouchX = 0
    let startTouchY = 0

    const applyTransform = () => {
      const el = zoomWrapperRef.current
      if (!el) return
      const { scale, tx, ty } = zoomStateRef.current
      el.style.transformOrigin = '0 0'
      el.style.transform = scale === 1 && tx === 0 && ty === 0
        ? ''
        : `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
      content.style.touchAction = scale > 1 ? 'none' : 'pan-y'
    }

    const getRel = (x: number, y: number) => {
      const r = content.getBoundingClientRect()
      return { x: x - r.left, y: y - r.top }
    }
    const clamp = (scale: number, tx: number, ty: number) => {
      const r = content.getBoundingClientRect()
      const minTx = Math.min(0, r.width - r.width * scale)
      const minTy = Math.min(0, r.height - r.height * scale)
      return {
        tx: Math.max(minTx, Math.min(0, tx)),
        ty: Math.max(minTy, Math.min(0, ty)),
      }
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0], t2 = e.touches[1]
        const p1 = getRel(t1.clientX, t1.clientY)
        const p2 = getRel(t2.clientX, t2.clientY)
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        startDist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
        startScale = zoomStateRef.current.scale
        startTx = zoomStateRef.current.tx
        startTy = zoomStateRef.current.ty
        pivot = {
          x: (midX - startTx) / startScale,
          y: (midY - startTy) / startScale,
        }
        mode = 'pinch'
        e.stopPropagation()
        e.preventDefault()
      } else if (e.touches.length === 1 && zoomStateRef.current.scale > 1) {
        const t = e.touches[0]
        startTouchX = t.clientX
        startTouchY = t.clientY
        startTx = zoomStateRef.current.tx
        startTy = zoomStateRef.current.ty
        mode = 'pan'
        e.stopPropagation()
      } else {
        mode = 'none'
      }
    }

    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length >= 2) {
        const t1 = e.touches[0], t2 = e.touches[1]
        const p1 = getRel(t1.clientX, t1.clientY)
        const p2 = getRel(t2.clientX, t2.clientY)
        const curMidX = (p1.x + p2.x) / 2
        const curMidY = (p1.y + p2.y) / 2
        const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
        let newScale = startScale * (curDist / startDist)
        newScale = Math.max(MIN, Math.min(MAX, newScale))
        const newTx = curMidX - pivot.x * newScale
        const newTy = curMidY - pivot.y * newScale
        const c = clamp(newScale, newTx, newTy)
        zoomStateRef.current = { scale: newScale, tx: c.tx, ty: c.ty }
        applyTransform()
        e.stopPropagation()
        e.preventDefault()
      } else if (mode === 'pan' && e.touches.length === 1) {
        const t = e.touches[0]
        const dx = t.clientX - startTouchX
        const dy = t.clientY - startTouchY
        const { scale } = zoomStateRef.current
        const c = clamp(scale, startTx + dx, startTy + dy)
        zoomStateRef.current = { scale, tx: c.tx, ty: c.ty }
        applyTransform()
        e.stopPropagation()
        e.preventDefault()
      }
    }

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (zoomStateRef.current.scale <= MIN + 0.01) {
          zoomStateRef.current = { scale: 1, tx: 0, ty: 0 }
          applyTransform()
        }
        mode = 'none'
      } else if (e.touches.length === 1 && mode === 'pinch') {
        if (zoomStateRef.current.scale > 1) {
          const t = e.touches[0]
          startTouchX = t.clientX
          startTouchY = t.clientY
          startTx = zoomStateRef.current.tx
          startTy = zoomStateRef.current.ty
          mode = 'pan'
        } else {
          mode = 'none'
        }
      }
    }

    content.addEventListener('touchstart', onStart, { passive: false })
    content.addEventListener('touchmove', onMove, { passive: false })
    content.addEventListener('touchend', onEnd, { passive: false })
    content.addEventListener('touchcancel', onEnd, { passive: false })
    return () => {
      content.removeEventListener('touchstart', onStart)
      content.removeEventListener('touchmove', onMove)
      content.removeEventListener('touchend', onEnd)
      content.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // 슬라이드 닫힐 때 줌 리셋
  useEffect(() => {
    if (!slideOpen) {
      zoomStateRef.current = { scale: 1, tx: 0, ty: 0 }
      const el = zoomWrapperRef.current
      if (el) { el.style.transform = ''; el.style.transformOrigin = '0 0' }
      const content = slideContentRef.current
      if (content) content.style.touchAction = 'pan-y'
    }
  }, [slideOpen])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const agentId = user?.id
    if (agentId) setAgentId(agentId)

    // customers + contracts 병렬로 불러오기
    // .limit(10000) — Supabase 기본 limit 안전장치
    const [custsRes, contsRes] = await Promise.all([
      supabase.from('dpa_customers').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(10000),
      supabase.from('dpa_contracts').select('*').eq('agent_id', agentId).limit(10000)
    ])

    const custs = custsRes.data || []
    const conts = contsRes.data || []

    // coverages는 계약 ID 기준으로 필터링 (전체 X)
    // ⚠️ Supabase 기본 limit=1000 → 대량 데이터 누락 방지: 청크 분할 로딩
    let covs: any[] = []
    if (conts.length > 0) {
      const contractIds = conts.map((c: any) => c.id)
      const CHUNK_SIZE = 100 // URL 길이 제한 대비 분할
      const chunks: string[][] = []
      for (let i = 0; i < contractIds.length; i += CHUNK_SIZE) {
        chunks.push(contractIds.slice(i, i + CHUNK_SIZE))
      }
      const chunkResults = await Promise.all(
        chunks.map(chunk =>
          supabase
            .from('dpa_coverages')
            .select('*')
            .in('contract_id', chunk)
            .order('section', { ascending: true })
            .order('sort_order', { ascending: true })
            .limit(10000)
        )
      )
      covs = chunkResults.flatMap(r => r.data || [])
    }

    setCustomers(custs)
    setContracts(conts)
    setCoverages(covs)
    setLoading(false)

    if (isInitialLoad.current && window.innerWidth > 768) {
      // 첫 로드: 첫 번째 고객 자동 선택
      isInitialLoad.current = false
      const first = custs.find((c: any) => c.customer_type === 'existing') || custs[0]
      if (first) selectCustomer(first, conts, covs)
    } else if (selectedRef.current) {
      // 이후 fetchAll 호출 시: 현재 선택된 고객의 계약/보장 목록을 fresh 데이터로 갱신
      // (saveContractEdit, saveInsurance 등 후 selectedContracts stale 방지)
      const c = selectedRef.current
      const cContracts = conts.filter((ct: any) => ct.customer_id === c.id)
      setSelectedContracts(cContracts)
      const ids = cContracts.map((ct: any) => ct.id)
      setSelectedCoverages(covs.filter((cv: any) => ids.includes(cv.contract_id)))
    }

    return { custs, conts, covs }
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

  async function deleteCustomer(c: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
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
    await fetchAll()  // await → selectedRef 갱신으로 selectedContracts 즉시 반영
  }

  async function saveContractEdit() {
    await supabase.from('dpa_contracts').update(editContractForm).eq('id', editContractId)
    setEditContractId(null)
    await fetchAll()  // await → selectedRef 갱신으로 선택 고객 계약 최신화
  }

  async function deleteContract(ctId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({ title: '계약 삭제', message: '이 보험 계약을 삭제할까요?\n보장 내역도 모두 삭제됩니다.', confirmText: '삭제', danger: true })
    if (!ok) return
    await supabase.from('dpa_coverages').delete().eq('contract_id', ctId)
    await supabase.from('dpa_contracts').delete().eq('id', ctId)
    // 화면 즉시 갱신: 삭제된 계약을 state에서도 제거
    setSelectedContracts(prev => prev.filter(ct => ct.id !== ctId))
    setSelectedCoverages(prev => prev.filter(cv => cv.contract_id !== ctId))
    fetchAll()
  }

  async function saveAddCustomer() {
    if (!addForm.name) return alert('고객명은 필수예요!')
    const { data: { user } } = await supabase.auth.getUser()
    const agentId = user?.id
    if (agentId) setAgentId(agentId)
    const { gender, age, birthDate } = parseResident(addForm.resident_number)
    const { data: cust } = await supabase.from('dpa_customers').insert({
      ...addForm,
      age: age || parseInt(addForm.age) || null,
      gender: addForm.resident_number.length >= 8 ? gender : addForm.gender,
      birth_date: birthDate || null,
      resident_number: addForm.resident_number,
      customer_type: addType,
      agent_id: agentId
    }).select().single()
    if (cust) {
      // 보험 계약도 한번에 저장
      for (const ct of addContracts) {
        const totalM = parseInt(ct.total_months) || 0
        const paidM = parseInt(ct.paid_months) || 0
        const payRate = totalM > 0 ? Math.round(paidM / totalM * 100) : 0
        const { data: savedCt } = await supabase.from('dpa_contracts').insert({
          customer_id: cust.id,
          agent_id: agentId,
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
      setAddContracts([{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
      setShowAddInsForm(false)
      const { conts, covs } = await fetchAll()
      selectCustomer(cust, conts, covs)  // fresh 데이터로 선택 — stale closure 방지
    }
  }

  async function saveInsurance() {
    if (!selected) return
    if (!insForm.company || !insForm.monthly_fee) return alert('보험사와 월보험료는 필수예요!')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: ct } = await supabase.from('dpa_contracts').insert({
      customer_id: selected.id,
      agent_id: user?.id,
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
    setInsForm({ company: '', product_name: '', insurance_type: '건강', monthly_fee: '', payment_status: '유지', payment_years: '', expiry_age: '', contract_start: '' })
    setInsCoverages([])
    setNewCov({ category: '암진단', coverage_name: '', amount: '' })
    await fetchAll()  // await → selectedRef 자동 갱신으로 selectedContracts 즉시 반영
  }

  async function handleReentryParse() {
    const combined = [
      reentryTextFixed.trim() ? `[정액형]\n${reentryTextFixed.trim()}` : '',
      reentryTextLoss.trim() ? `[실손형]\n${reentryTextLoss.trim()}` : '',
    ].filter(Boolean).join('\n\n')
    if (!combined) return
    setReentryParsing(true)
    setReentryParsed(null)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combined }),
      })
      const data = await res.json()
      setReentryParsed(data)
    } catch (e: any) {
      alert('분석 중 오류: ' + e.message)
    }
    setReentryParsing(false)
  }

  async function handleRentrySave() {
    if (!reentryParsed?.contracts?.[0]) return
    setReSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ct = reentryParsed.contracts[0]
      if (reentryReplaceId) {
        await supabase.from('dpa_coverages').delete().eq('contract_id', reentryReplaceId)
        await supabase.from('dpa_contracts').delete().eq('id', reentryReplaceId)
      }
      const { data: newCt } = await supabase.from('dpa_contracts').insert({
        customer_id: selected.id,
        agent_id: user?.id,
        company: ct.company,
        product_name: ct.product_name,
        insurance_type: ct.insurance_type || '건강',
        monthly_fee: ct.monthly_fee || 0,
        payment_status: ct.payment_status || '유지',
        payment_rate: ct.payment_rate || 0,
        payment_years: ct.payment_years || null,
        expiry_age: ct.expiry_age || null,
        contract_start: ct.contract_start || null,
      }).select().single()
      if (newCt && ct.coverages?.length > 0) {
        await supabase.from('dpa_coverages').insert(
          ct.coverages.map((cv: any) => ({
            contract_id: newCt.id,
            category: cv.category,
            coverage_name: cv.name,
            amount: cv.amount || 0,
          }))
        )
      }
      setReentryOpen(false)
      setReentryTextFixed('')
      setReentryTextLoss('')
      setReentryParsed(null)
      setReentryReplaceId(null)
      setReentryAddMode(false)
      await fetchAll()
    } catch (e: any) {
      alert('저장 중 오류: ' + e.message)
    }
    setReSaving(false)
  }

  const getBadges = (c: any) => {
    const badges = []
    const cContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
    if (cContracts.some((ct: any) => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납'))
      badges.push({ label: '완납임박', cls: styles.flagWarn })
    const cCoverages = coverages.filter((cv: any) => cContracts.some((ct: any) => ct.id === cv.contract_id))
    const brainTypes = cCoverages.filter((cv: any) => cv.category === '뇌혈관').map((cv: any) => cv.brain_coverage_type)
    if (brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈'))
      badges.push({ label: '보장공백', cls: styles.flagRed })
    const days = getBirthdayDays(c.birth_date)
    if (days !== null)
      badges.push({ label: `D-${days}`, cls: days <= 10 ? styles.flagBirthday : styles.flagBirthdayFar })
    return badges
  }

  const totalMonthly = selectedContracts.reduce((s, ct) => s + (ct.monthly_fee || 0), 0)

  const getSortedCustomers = (list: any[]) => {
    const sorted = [...list]
    if (sortFilter === '최신 등록순') return sorted
    if (sortFilter === '오래된순') return sorted.reverse()
    if (sortFilter === '이름순') return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (sortFilter === '나이순') return sorted.sort((a, b) => (b.age || 0) - (a.age || 0))
    if (sortFilter === '월보험료 높은순') {
      return sorted.sort((a, b) => {
        const aFee = contracts.filter((ct: any) => ct.customer_id === a.id).reduce((s: number, ct: any) => s + (ct.monthly_fee || 0), 0)
        const bFee = contracts.filter((ct: any) => ct.customer_id === b.id).reduce((s: number, ct: any) => s + (ct.monthly_fee || 0), 0)
        return bFee - aFee
      })
    }
    if (sortFilter === '🎂 생일 임박순') {
      return sorted.sort((a, b) => {
        const getDays = (bd: string) => { if (!bd) return 999; const d = getBirthdayDays(bd); return d === null ? 999 : d }
        return getDays(a.birth_date) - getDays(b.birth_date)
      })
    }
    if (sortFilter === '🔥 완납 임박순') {
      return sorted.sort((a, b) => {
        const getRate = (c: any) => {
          const cts = contracts.filter((ct: any) => ct.customer_id === c.id)
          if (!cts.length) return 0
          return Math.max(...cts.map((ct: any) => calcPaymentRate(ct)))
        }
        return getRate(b) - getRate(a)
      })
    }
    return sorted
  }

  const isTodoFilter = router.isReady && router.query.filter === 'todo'
  const todoSorts = router.isReady ? ((router.query.sorts as string) || '').split(',').filter(Boolean) : []

  const matchesTodoCondition = (c: any) => {
    return todoSorts.some(s => {
      if (s === '완납임박') {
        const cts = contracts.filter((ct: any) => ct.customer_id === c.id)
        return cts.some((ct: any) => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납')
      }
      if (s === '생일임박') return getBirthdayDays(c.birth_date) !== null
      if (s === '보장공백') {
        const cContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
        const cCoverages = coverages.filter((cv: any) => cContracts.some((ct: any) => ct.id === cv.contract_id))
        const brainTypes = cCoverages.filter((cv: any) => cv.category === '뇌혈관').map((cv: any) => cv.brain_coverage_type)
        return brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈')
      }
      return false
    })
  }

  const isAIFilter = sortFilter === '🤖 AI추천 일정'

  const matchesAICondition = (c: any) => {
    // 생일임박 (7일 이내)
    const days = getBirthdayDays(c.birth_date)
    if (days !== null && days <= 7) return true
    // 완납임박 (90% 이상)
    const cts = contracts.filter((ct: any) => ct.customer_id === c.id)
    if (cts.some((ct: any) => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납')) return true
    // 보장공백
    const cCoverages = coverages.filter((cv: any) => cts.some((ct: any) => ct.id === cv.contract_id))
    const brainTypes = cCoverages.filter((cv: any) => cv.category === '뇌혈관').map((cv: any) => cv.brain_coverage_type)
    if (brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈')) return true
    return false
  }

  const filteredCustomers = getSortedCustomers(
    customers
      .filter(c => searchQuery ? true : (isTodoFilter || isAIFilter) ? true : c.customer_type === (tab === 'existing' ? 'existing' : 'prospect'))
      .filter(c => ageFilter === '연령대전체' || getAgeGroup(c.age) === ageFilter)
      .filter(c => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
      })
      .filter(c => {
        if (isAIFilter) return matchesAICondition(c)
        if (isTodoFilter) return matchesTodoCondition(c)
        if (sortFilter === '🔥 완납 임박순') {
          const cts = contracts.filter((ct: any) => ct.customer_id === c.id)
          return cts.some((ct: any) => calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납')
        }
        if (sortFilter === '🎂 생일 임박순') {
          const days = getBirthdayDays(c.birth_date)
          return days !== null
        }
        if (sortFilter === '⚠️ 보장 공백순') {
          const cContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
          const cCoverages = coverages.filter((cv: any) => cContracts.some((ct: any) => ct.id === cv.contract_id))
          const brainTypes = cCoverages.filter((cv: any) => cv.category === '뇌혈관').map((cv: any) => cv.brain_coverage_type)
          return brainTypes.length === 0 || brainTypes.every((t: string) => t === '뇌출혈')
        }
        return true
      })
  )

  const getCoveragesByContract = (ctId: string) => {
    const cvs = selectedCoverages.filter(cv => cv.contract_id === ctId)
    return COVERAGE_GROUPS
      .map(g => ({ ...g, items: cvs.filter((cv: any) => cv.category === g.key).sort((a: any, b: any) => a.coverage_name.localeCompare(b.coverage_name, 'ko', { numeric: true })) }))
      .filter(g => g.items.length > 0)
  }

  return (
    <div className={styles.page}>
      {smsOpen && smsCustomer && (
        <SmsSlidePanel
          isOpen={smsOpen}
          onClose={() => { setSmsOpen(false); setSmsCustomer(null) }}
          customer={smsCustomer}
          contracts={contracts}
          coverages={coverages}
          agentId={agentId}
        />
      )}

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>고객 관리</h1>
        <p className={styles.pageSub}>총 {customers.length}명의 고객을 관리하세요</p>
      </div>

      {/* 탭바 */}
      <div className={styles.tabBar}>
        <button
          className={[styles.iconTab, tab === 'existing' ? styles.activeIconTab : ''].join(' ')}
          onClick={() => { handleTabChange('existing'); setAddMode(false); setAddForm(emptyCustomerForm); setAddContracts([{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}]); closeSlide() }}
          title="마이고객"
          >
          <span className={styles.tabIcon}><Users style={{width:14,height:14}} /></span>
          <span>마이고객</span>
        </button>
        <button
          className={[styles.iconTab, tab === 'prospect' ? styles.activeIconTab : ''].join(' ')}
          onClick={() => { handleTabChange('prospect'); setAddMode(false); setAddForm(emptyCustomerForm); setAddContracts([{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}]); closeSlide() }}
          title="관심고객"
          >
          <span className={styles.tabIcon}><User style={{width:14,height:14}} /></span>
          <span>관심고객</span>
        </button>

        {/* 모바일 전용: 인라인 검색 + 고객추가 */}
        <div className={styles.searchBoxInline}>
          <Search style={{width:13,height:13,color:'hsl(var(--text-tertiary))',flexShrink:0}} />
          <input className={styles.searchInputInline} placeholder="검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <button
          className={styles.addIconBtn}
          onClick={() => { setAddMode(true); setSelected(null); setSlideOpen(isMobile); setAddType(tab === 'existing' ? 'existing' : 'prospect') }}
          title="고객 추가"
        >
          <UserPlus style={{width:13,height:13}} />
          <span>고객 추가</span>
        </button>
      </div>

      {/* 필터 행: 연령대 + 소팅 + 웹검색 */}
      <div className={styles.tabRow2}>
        <select className={styles.ageFilter} value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
          {AGE_FILTERS.map(f => <option key={f}>{f}</option>)}
        </select>
        <select className={styles.sortFilter} value={sortFilter} onChange={e => setSortFilter(e.target.value)}>
          {['최신 등록순','오래된순','이름순','나이순','월보험료 높은순','🎂 생일 임박순','🔥 완납 임박순','⚠️ 보장 공백순','🤖 AI추천 일정'].map(f => <option key={f}>{f}</option>)}
        </select>
        {/* 웹에서만 보이는 검색창 */}
        <div className={styles.searchBoxDesktop}>
          <Search style={{width:13,height:13,color:'hsl(var(--text-tertiary))',flexShrink:0}} />
          <input className={styles.searchInput} placeholder="검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* 모바일 검색창 토글 */}
      {searchOpen && (
        <div className={styles.searchBoxMobile}>
          <Search style={{width:13,height:13,color:'hsl(var(--text-tertiary))',flexShrink:0}} />
          <input className={styles.searchInput} placeholder="검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
        </div>
      )}

      {/* 데스크탑: 좌우 분할 / 모바일: 단일 컬럼 */}
      <div className={isMobile ? '' : styles.customersLayout}>
      <div className={styles.listPanel}>
        {loading ? <div className={styles.empty}>불러오는 중...</div> : filteredCustomers.length === 0 ? (
          <div className={styles.empty}>해당 고객이 없어요</div>
        ) : filteredCustomers.map(c => {
          const badges = getBadges(c)
          const cMonthly = contracts.filter((ct: any) => ct.customer_id === c.id).reduce((s: number, ct: any) => s + (ct.monthly_fee || 0), 0)
          const cCount = contracts.filter((ct: any) => ct.customer_id === c.id).length
          return (
            <div key={c.id} id={`customer-row-${c.id}`} className={[styles.custRow, c.customer_type === 'prospect' ? styles.custRowProspect : styles.custRowExisting, selected?.id === c.id ? styles.active : ''].join(' ')} onClick={() => selectCustomer(c)}>
              <div className={styles.custMain}>
                <span className={styles.custName}>{c.name}</span>
                {c.grade === 'VIP' && <span className={styles.gradeVip}>VIP</span>}
                <span className={styles.custSep}>·</span>
                <span className={styles.custMeta}>{c.age || (c.birth_date ? new Date().getFullYear() - new Date(c.birth_date).getFullYear() : '')}세 · {c.gender} · {cCount}건 · {cMonthly.toLocaleString()}원</span>
                {badges.length > 0 && (
                  <span className={styles.statusFlags}>
                    {badges.map((b, i) => <span key={i} className={b.cls}>{b.label}</span>)}
                  </span>
                )}
              </div>
              <div className={styles.custActions}>
                <button className={styles.smsBtn} onClick={e => { e.stopPropagation(); setSmsCustomer(c); setSmsOpen(true) }}>문자</button>
                <button className={styles.editBtn} onClick={e => { e.stopPropagation(); selectCustomer(c); setEditMode(true); setEditForm(c); setAddMode(false) }}>수정</button>
                <button className={styles.deleteBtn} onClick={e => deleteCustomer(c, e)}>삭제</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 데스크탑 상세 패널 */}
      {!isMobile && (
        <div className={styles.detailPanel} onWheel={e => { e.currentTarget.scrollTop += e.deltaY; }}>
          {!addMode && !selected ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👈</div>
              <p className={styles.emptyText}>고객을 선택하면 상세 정보가 표시됩니다</p>
            </div>
          ) : addMode ? (
            <div className={styles.editBox}>
              <div className={styles.editSectionTitle}>{addType === 'existing' ? '마이고객' : '관심고객'} 추가</div>
              <div className={styles.editGrid}>
                <div className={styles.editField}><label>이름 *</label><input placeholder="홍길동" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value.replace(/[0-9]/g, '') })} /></div>
                <div className={styles.editField}><label>연락처</label><input placeholder="010-0000-0000" inputMode="numeric" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: formatPhone(e.target.value) })} /></div>
                <div className={styles.editField}><label>주민등록번호 *</label>
                  <input placeholder="000000-0000000" inputMode="numeric" value={addForm.resident_number}
                    onChange={e => {
                      const rn = formatResident(e.target.value)
                      const parsed = parseResident(rn)
                      setAddForm({ ...addForm, resident_number: rn, gender: parsed.gender, age: String(parsed.age) })
                    }} />
                  {addForm.resident_number.length >= 8 && <span style={{fontSize:11,color:'hsl(var(--accent))',marginTop:3}}>✓ 만 {addForm.age}세</span>}
                </div>
                <div className={styles.editField}><label>성별</label>
                  <select value={addForm.gender||'남'} onChange={e => setAddForm({ ...addForm, gender: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                    <option>남</option><option>여</option>
                  </select>
                </div>
                <div className={styles.editField}><label>은행명</label><input placeholder="우리은행" value={addForm.bank_name||''} onChange={e => setAddForm({ ...addForm, bank_name: e.target.value })} /></div>
                <div className={styles.editField}><label>계좌번호</label><input placeholder="1002-3628-09746" inputMode="numeric" value={addForm.bank_account||''} onChange={e => setAddForm({ ...addForm, bank_account: e.target.value.replace(/[^0-9-]/g,'') })} /></div>
                <div className={styles.editField}><label>주소</label><input placeholder="서울시 강남구..." value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} /></div>
                <div className={styles.editField}><label>직업</label>
                  <select value={addForm.job} onChange={e => setAddForm({ ...addForm, job: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                    {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j => <option key={j}>{j}</option>)}
                  </select>
                </div>
                <div className={styles.editField}><label>직장/소속</label><input placeholder="직장명" value={addForm.workplace} onChange={e => setAddForm({ ...addForm, workplace: e.target.value })} /></div>
                <div className={styles.editField}><label>운전면허</label><input placeholder="26-06-009864-70" value={addForm.driver_license||''} onChange={e => setAddForm({ ...addForm, driver_license: e.target.value })} /></div>
                <div className={styles.editField}><label>등급</label>
                  <select value={addForm.grade} onChange={e => setAddForm({ ...addForm, grade: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                    <option>일반</option><option>VIP</option>
                  </select>
                </div>
              </div>
              {/* 보험 폼들이 쌓이는 구조 */}
              {addContracts.map((ct:any, i:number) => (
                <div key={i} style={{background:'hsl(var(--bg-panel))',border:'1px solid hsl(var(--border-default))',borderRadius:12,padding:14,marginTop:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div className={styles.editSectionTitle} style={{margin:0}}>보험 {i+1}</div>
                    {addContracts.length > 1 && <button onClick={()=>setAddContracts((v:any)=>v.filter((_:any,j:number)=>j!==i))} style={{background:'none',border:'none',color:'hsl(var(--text-tertiary))',cursor:'pointer',fontSize:12}}>✕ 삭제</button>}
                  </div>
                  <div className={styles.editGrid}>
                    <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>보험사</label>
                      <div style={{display:'flex',gap:6}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>손해보험</div>
                          <select value={SONHAE_COMPANIES.includes(ct.company)?ct.company:''} onChange={e=>{if(e.target.value)setAddContracts((prev:any)=>prev.map((c:any,j:number)=>j===i?{...c,company:e.target.value}:c));else setAddContracts((prev:any)=>prev.map((c:any,j:number)=>j===i?{...c,company:''}:c))}} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                            <option value="">-- 손해보험사 선택 --</option>
                            {SONHAE_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>생명보험</div>
                          <select value={SAENGMYEONG_COMPANIES.includes(ct.company)?ct.company:''} onChange={e=>{if(e.target.value)setAddContracts((prev:any)=>prev.map((c:any,j:number)=>j===i?{...c,company:e.target.value}:c));else setAddContracts((prev:any)=>prev.map((c:any,j:number)=>j===i?{...c,company:''}:c))}} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                            <option value="">-- 생명보험사 선택 --</option>
                            {SAENGMYEONG_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>상품명</label><input value={ct.product_name} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,product_name:e.target.value}:c))} placeholder="무배당 건강보험" /></div>
                    <div className={styles.editField}><label>보험 종류</label>
                      <select value={ct.insurance_type} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,insurance_type:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {INSURANCE_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>월보험료(원) *</label><input inputMode="numeric" value={ct.monthly_fee?formatMoney(String(ct.monthly_fee)):''} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,monthly_fee:parseMoney(e.target.value)}:c))} placeholder="50,000" /></div>
                    <div className={styles.editField}><label>납입상태</label>
                      <select value={ct.payment_status} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,payment_status:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {PAYMENT_STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>가입연월</label>
                      <div style={{display:'flex',gap:4}}>
                        <select value={parseContractStart(ct.contract_start).year} onChange={e=>{const m=parseContractStart(ct.contract_start).month;setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,contract_start:joinContractStart(e.target.value,m)}:c))}} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          <option value="">년</option>
                          {YEARS.map(y=><option key={y}>{y}</option>)}
                        </select>
                        <select value={parseContractStart(ct.contract_start).month} onChange={e=>{const y=parseContractStart(ct.contract_start).year;setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,contract_start:joinContractStart(y,e.target.value)}:c))}} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          <option value="">월</option>
                          {MONTHS.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.editField}><label>납입기간</label>
                      <select value={ct.payment_years} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,payment_years:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        <option value="">선택</option>
                        {PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>만기</label>
                      <select value={ct.expiry_age} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,expiry_age:e.target.value}:c))} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        <option value="">선택</option>
                        {EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>총 납입 회차</label><input inputMode="numeric" value={ct.total_months||''} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,total_months:e.target.value.replace(/[^0-9]/g,'')}:c))} placeholder="120" /></div>
                    <div className={styles.editField}><label>완료 회차</label><input inputMode="numeric" value={ct.paid_months||''} onChange={e=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,paid_months:e.target.value.replace(/[^0-9]/g,'')}:c))} placeholder="36" /></div>
                    <div className={styles.editField} style={{gridColumn:'span 2'}}>
                      <label>납입률 (%) <span style={{fontSize:10,color:'hsl(var(--accent))',fontWeight:600}}>자동</span></label>
                      <input readOnly value={ct.total_months&&ct.paid_months ? `${Math.round(parseInt(ct.paid_months)/parseInt(ct.total_months)*100)}%` : '자동 계산'} style={{background:'hsl(var(--bg-elevated))',color:'hsl(var(--text-tertiary))'}} />
                    </div>
                  </div>
                  {/* 보장 항목 - 수동입력과 완전 동일 */}
                  <div style={{marginTop:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color:'hsl(var(--text-primary))'}}>보장 항목</span>
                      <button style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid hsl(var(--accent) / 0.4)',background:'hsl(var(--accent-bg))',color:'hsl(var(--accent))',cursor:'pointer'}}
                        onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,showCovForm:!c.showCovForm}:c))}>+ 보장 추가</button>
                    </div>
                    {ct.showCovForm && (
                      <div style={{background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--accent) / 0.4)',borderRadius:10,padding:12,marginBottom:8}}>
                        <div className={styles.editGrid} style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                          <div className={styles.editField}><label>카테고리</label>
                            <select value={addNewCov.category} onChange={e=>setAddNewCov({...addNewCov,category:e.target.value})} style={{width:'100%',fontSize:13,padding:'9px 12px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-elevated))'}}>
                              {['암진단','뇌혈관','심장','간병','수술비','실손','비급여','상해','사고처리','벌금','특이사항'].map(c=><option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className={styles.editField}><label>보장명</label><input value={addNewCov.coverage_name} onChange={e=>setAddNewCov({...addNewCov,coverage_name:e.target.value})} placeholder="예: 급성심근경색진단비" style={{background:'hsl(var(--bg-elevated))'}} /></div>
                          <div className={styles.editField}><label>금액 (원)</label><input inputMode="numeric" value={addNewCov.amount?formatMoney(String(addNewCov.amount)):''} onChange={e=>setAddNewCov({...addNewCov,amount:parseMoney(e.target.value)})} placeholder="예: 30,000,000" style={{background:'hsl(var(--bg-elevated))'}} /></div>
                        </div>
                        <div style={{display:'flex',gap:6,marginTop:8}}>
                          <button style={{flex:1,padding:'7px',fontSize:13,background:'hsl(var(--accent))',color:'hsl(var(--accent-foreground))',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer'}}
                            onClick={()=>{if(addNewCov.coverage_name&&addNewCov.amount){setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,coverages:[...c.coverages,addNewCov],showCovForm:false}:c));setAddNewCov({category:'암진단',coverage_name:'',amount:''})}}}>추가하기</button>
                          <button style={{padding:'7px 14px',fontSize:13,background:'hsl(var(--bg-panel))',color:'hsl(var(--text-tertiary))',border:'1px solid hsl(var(--border-default))',borderRadius:8,cursor:'pointer'}}
                            onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,showCovForm:false}:c))}>닫기</button>
                        </div>
                      </div>
                    )}
                    {ct.coverages.length > 0 && (
                      <div style={{border:'1px solid hsl(var(--border-default))',borderRadius:8,overflow:'hidden'}}>
                        {ct.coverages.map((cv:any,ci:number)=>(
                          <div key={ci} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'6px 10px',borderBottom:'1px solid hsl(var(--border-default))'}}>
                            <span style={{color:'hsl(var(--text-tertiary))',minWidth:55,fontSize:11}}>{cv.category}</span>
                            <span style={{flex:1,color:'hsl(var(--text-primary))'}}>{cv.coverage_name}</span>
                            <span style={{color:'hsl(var(--accent))',fontWeight:600}}>{parseInt(cv.amount).toLocaleString()}원</span>
                            <button onClick={()=>setAddContracts((v:any)=>v.map((c:any,j:number)=>j===i?{...c,coverages:c.coverages.filter((_:any,k:number)=>k!==ci)}:c))} style={{background:'none',border:'none',color:'hsl(var(--text-tertiary))',cursor:'pointer',fontSize:13}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* + 보험 추가 버튼 */}
              <button style={{display:'block',width:'100%',padding:'10px',marginBottom:12,border:'1.5px dashed hsl(var(--border-default))',borderRadius:8,background:'transparent',color:'hsl(var(--text-tertiary))',fontSize:13,cursor:'pointer',textAlign:'center',marginTop:12}}
                onMouseOver={e=>{(e.target as HTMLButtonElement).style.borderColor='hsl(var(--accent))';(e.target as HTMLButtonElement).style.color='hsl(var(--accent))';(e.target as HTMLButtonElement).style.background='hsl(var(--accent-bg))'}}
                onMouseOut={e=>{(e.target as HTMLButtonElement).style.borderColor='hsl(var(--border-default))';(e.target as HTMLButtonElement).style.color='hsl(var(--text-tertiary))';(e.target as HTMLButtonElement).style.background='transparent'}}
                onClick={()=>{
                  if(!addForm.name) return alert('이름을 먼저 입력해주세요!')
                  setAddContracts((v:any)=>[...v,{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}])
                }}>+ 보험 추가</button>

              {/* 저장/취소 - 우측 정렬 */}
              <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid hsl(var(--border-default))',display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={saveAddCustomer} style={{padding:'8px 24px',background:'hsl(var(--accent))',color:'hsl(var(--accent-foreground))',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>저장</button>
                <button className={styles.cancelBtn} style={{borderColor:'hsl(var(--border-default))'}} onClick={() => { setAddMode(false); setAddContracts([{company:'',product_name:'',insurance_type:'건강',monthly_fee:'',payment_status:'유지',payment_years:'',expiry_age:'',contract_start:'',coverages:[],showCovForm:false}]) }}>취소</button>
              </div>
            </div>
          ) : selected ? (
            <div className={styles.slideContent}>
              <div className={styles.detailHeaderNew}>
                <div className={styles.detailHeaderRow1}>
                  <span className={[styles.detailTypeTag, selected.customer_type === 'prospect' ? styles.detailTypeTagProspect : styles.detailTypeTagMy].join(' ')}>
                    {selected.customer_type === 'prospect' ? '관심' : '마이'}
                  </span>
                  <span className={styles.detailNameLg}>{selected.name}</span>
                  {selected.grade === 'VIP' && <span className={styles.gradeVip}>VIP</span>}
                </div>
                <div className={styles.detailMetaRow}>
                  <div className={styles.detailHeaderRow2}>
                    {selected.age || (selected.birth_date ? new Date().getFullYear() - new Date(selected.birth_date).getFullYear() : "")}세 · {selected.gender} · {selected.job} · {selected.phone}
                  </div>
                  {!editMode && (
                    <div className={styles.detailHeaderRow3}>
                      <button className={styles.smsBtn} onClick={() => { setSmsCustomer(selected); setSmsOpen(true) }}>문자</button>
                      <button className={styles.editBtn} onClick={() => { setEditMode(true); setEditForm(selected) }}>수정</button>
                      <button className={styles.deleteBtn} onClick={() => deleteCustomer(selected)}>삭제</button>
                    </div>
                  )}
                </div>
              </div>
              {editMode && (
                <div className={styles.editBox}>
                  <div className={styles.editSectionTitle}>개인정보 수정</div>
                  <div className={styles.editGrid}>
                    <div className={styles.editField}><label>이름</label><input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
                    <div className={styles.editField}><label>연락처</label><input inputMode="numeric" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:formatPhone(e.target.value)})} /></div>
                    <div className={styles.editField}><label>주민등록번호</label><input value={editForm.resident_number||''} maxLength={14} placeholder="000000-0000000"
                      onChange={e=>{
                        const raw=e.target.value.replace(/[^0-9]/g,'').slice(0,13)
                        const fmt=raw.length<=6?raw:raw.slice(0,6)+'-'+raw.slice(6)
                        const {gender,age,birthDate}=parseResident(fmt)
                        setEditForm({...editForm,resident_number:fmt,...(raw.length>=7?{gender,age,birth_date:birthDate}:{})})
                      }} /></div>
                    <div className={styles.editField}><label>성별 <span style={{fontSize:10,background:'hsl(var(--accent)/0.12)',color:'hsl(var(--accent))',padding:'1px 5px',borderRadius:999,fontWeight:600,marginLeft:2}}>자동</span></label>
                      <select value={editForm.gender||'남'} onChange={e=>setEditForm({...editForm,gender:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        <option>남</option><option>여</option><option>기타</option>
                      </select>
                    </div>
                    <div className={styles.editField}><label>은행명</label>
                      <select value={editForm.bank_name||''} onChange={e=>setEditForm({...editForm,bank_name:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {['','KB국민','신한','하나','우리','NH농협','IBK기업','카카오뱅크','케이뱅크','토스뱅크','SC제일','새마을금고','신협','수협','우체국'].map(b=><option key={b} value={b}>{b||'선택'}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>계좌번호</label><input value={editForm.bank_account||''} onChange={e=>setEditForm({...editForm,bank_account:e.target.value.replace(/[^0-9-]/g,'')})} inputMode="numeric" /></div>
                    <div className={styles.editField} style={{gridColumn:'span 2'}}><label>주소</label><input value={editForm.address||''} onChange={e=>setEditForm({...editForm,address:e.target.value})} /></div>
                    <div className={styles.editField}><label>직업</label>
                      <select value={editForm.job||'직장인'} onChange={e=>setEditForm({...editForm,job:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j=><option key={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>직장/소속</label><input value={editForm.workplace||''} onChange={e=>setEditForm({...editForm,workplace:e.target.value})} /></div>
                    <div className={styles.editField}><label>운전면허</label><input value={editForm.driver_license||''} onChange={e=>setEditForm({...editForm,driver_license:e.target.value})} /></div>
                    <div className={styles.editField}><label>등급</label>
                      <select value={editForm.grade||'일반'} onChange={e=>setEditForm({...editForm,grade:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {['일반','우수','VIP','VVIP'].map(g=><option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.editActions} style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                    <button className={styles.saveBtn} onClick={saveCustomerEdit}>저장</button>
                    <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                  </div>
                </div>
              )}
              <div className={styles.infoTable2}>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>연락처</span><span className={styles.infoValue}>{selected.phone || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>나이</span><span className={styles.infoValue}>{selected.age || (selected.birth_date ? new Date().getFullYear() - new Date(selected.birth_date).getFullYear() : <span className={styles.infoEmpty}>-</span>)}{(selected.age || selected.birth_date) ? '세' : ''}</span></div>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>주민등록번호</span><span className={styles.infoValue}>{selected.resident_number || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>성별</span><span className={styles.infoValue}>{selected.gender || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>은행명</span><span className={styles.infoValue}>{selected.bank_name || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>계좌번호</span><span className={styles.infoValue}>{selected.bank_account || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={styles.infoCellFull}><span className={styles.infoLabel}>주소</span><span className={styles.infoValue}>{selected.address || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>직업</span><span className={styles.infoValue}>{selected.job || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>직장/소속</span><span className={styles.infoValue}>{selected.workplace || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>운전면허</span><span className={styles.infoValue}>{selected.driver_license || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>등급</span><span className={styles.infoValue}>{selected.grade || <span className={styles.infoEmpty}>-</span>}</span></div>
                <div className={[styles.infoCell, styles.infoCellL].join(' ')}><span className={styles.infoLabel}>계약 수</span><span className={styles.infoValue}>{selectedContracts.length}건</span></div>
                <div className={[styles.infoCell, styles.infoCellR].join(' ')}><span className={styles.infoLabel}>총 월납입</span><span className={[styles.infoValue, styles.infoGreen].join(' ')}>{selectedContracts.reduce((s,ct)=>s+(ct.monthly_fee||0),0).toLocaleString()}원</span></div>
              </div>
              <div className={styles.section}>
                보험 계약 현황
                <button onClick={() => { setReentryOpen(true); setReentryParsed(null); setReentryTextFixed(''); setReentryTextLoss(''); setReentryReplaceId(null); setReentryAddMode(false) }} style={{marginLeft:'auto',fontSize:11,padding:'3px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'white',color:'#636B78',cursor:'pointer',fontWeight:500,letterSpacing:0,textTransform:'none'}}>재입력</button>
              </div>
              {selectedContracts.map((ct, idx) => {
                const cvs = selectedCoverages.filter(cv => cv.contract_id === ct.id)
                const groups = COVERAGE_GROUPS.map(g => ({ ...g, items: cvs.filter((cv:any) => cv.category === g.key).sort((a:any, b:any) => a.coverage_name.localeCompare(b.coverage_name, 'ko', { numeric: true })) })).filter(g => g.items.length > 0)
                const isExpanded = expandedContractIds.has(ct.id)
                return (
                  <div key={ct.id} className={calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납' ? styles.insCardWarn : styles.insCard}
                    style={{cursor:'pointer'}}
                    onClick={() => setExpandedContractIds(prev => { const s = new Set(prev); isExpanded ? s.delete(ct.id) : s.add(ct.id); return s })}
                  >
                    <div className={styles.insCardHeader}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div className={styles.insCardTitle}>{idx+1}. {ct.company}{ct.product_name ? ` · ${ct.product_name}` : ''}</div>
                        <span style={{fontSize:11,color:'#8892A0',marginLeft:'auto',transition:'transform 0.2s',transform:isExpanded?'rotate(180deg)':'rotate(0deg)',display:'inline-block',lineHeight:1}}>▾</span>
                      </div>
                      <div className={styles.insCardBottomRow}>
                        <div className={styles.insCardMeta}>{ct.monthly_fee>0?`${ct.monthly_fee.toLocaleString()}원/월`:''}{ct.contract_start?` · ${ct.contract_start} 가입`:''}{ct.payment_years?` · ${ct.payment_years}`:''}{ct.expiry_age?` · ${ct.expiry_age}만기`:''}</div>
                        <div className={styles.insCardBadges}>
                          <span className={[styles.badge, ct.payment_status==='완납'?styles.badgeGreen:calcPaymentRate(ct)>=90?styles.badgeWarn:styles.badgeBlue].join(' ')}>{ct.payment_status==='완납'?'완납':`${calcPaymentRate(ct)}%`}</span>
                          {ct.insurance_type && <span className={styles.insTypeBadge}>{ct.insurance_type}</span>}
                        </div>
                        <div className={styles.insCardActions}>
                          <button className={styles.editBtn} onClick={e => { e.stopPropagation(); setEditContractId(editContractId === ct.id ? null : ct.id); setEditContractForm(ct) }}>수정</button>
                          <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteContract(ct.id, e) }}>삭제</button>
                        </div>
                      </div>
                    </div>
                    {editContractId === ct.id && (
                      <div className={styles.contractEditBox}>
                        <div className={styles.editGrid}>
                          <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>보험사</label>
                            <div style={{display:'flex',gap:6}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>손해보험</div>
                                <select value={SONHAE_COMPANIES.includes(editContractForm.company||'')?editContractForm.company:''} onChange={e=>setEditContractForm({...editContractForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                                  <option value="">-- 손해보험사 선택 --</option>
                                  {SONHAE_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>생명보험</div>
                                <select value={SAENGMYEONG_COMPANIES.includes(editContractForm.company||'')?editContractForm.company:''} onChange={e=>setEditContractForm({...editContractForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                                  <option value="">-- 생명보험사 선택 --</option>
                                  {SAENGMYEONG_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>상품명</label><input value={editContractForm.product_name||''} onChange={e=>setEditContractForm({...editContractForm,product_name:e.target.value})} /></div>
                          <div className={styles.editField}><label>월보험료(원)</label><input inputMode="numeric" value={editContractForm.monthly_fee?formatMoney(String(editContractForm.monthly_fee)):''} onChange={e=>setEditContractForm({...editContractForm,monthly_fee:parseMoney(e.target.value)})} placeholder="50,000" /></div>
                          <div className={styles.editField}><label>보험종류</label>
                            <select value={editContractForm.insurance_type||''} onChange={e=>setEditContractForm({...editContractForm,insurance_type:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                              {INSURANCE_TYPES.map(t=><option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className={styles.editField}><label>가입연월</label>
                            <div style={{display:'flex',gap:4}}>
                              <select value={parseContractStart(editContractForm.contract_start||'').year} onChange={e=>setEditContractForm({...editContractForm,contract_start:joinContractStart(e.target.value,parseContractStart(editContractForm.contract_start||'').month)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                <option value="">년</option>
                                {YEARS.map(y=><option key={y}>{y}</option>)}
                              </select>
                              <select value={parseContractStart(editContractForm.contract_start||'').month} onChange={e=>setEditContractForm({...editContractForm,contract_start:joinContractStart(parseContractStart(editContractForm.contract_start||'').year,e.target.value)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                <option value="">월</option>
                                {MONTHS.map(m=><option key={m}>{m}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className={styles.editField}><label>납입기간</label>
                            <select value={editContractForm.payment_years||''} onChange={e=>setEditContractForm({...editContractForm,payment_years:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                              <option value="">선택</option>
                              {PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                            </select>
                          </div>
                          <div className={styles.editField}><label>만기</label>
                            <select value={editContractForm.expiry_age||''} onChange={e=>setEditContractForm({...editContractForm,expiry_age:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                              <option value="">선택</option>
                              {EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                            </select>
                          </div>
                          <div className={styles.editField}><label>납입상태</label>
                            <select value={editContractForm.payment_status||''} onChange={e=>setEditContractForm({...editContractForm,payment_status:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                              {PAYMENT_STATUSES.map(s=><option key={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className={styles.editActions}>
                          <button className={styles.saveBtn} onClick={saveContractEdit}>저장</button>
                          <button className={styles.cancelBtn} onClick={() => setEditContractId(null)}>취소</button>
                        </div>
                      </div>
                    )}
                    {isExpanded && groups.length > 0 && (
                      <div className={styles.coverageList} onClick={e => e.stopPropagation()}>
                        {groups.map(g => (
                          <div key={g.key} className={styles.coverageRow}>
                            <span className={styles.covIcon}>{g.icon}</span>
                            <div className={styles.covRight}>
                              <span className={styles.covLabel}>{g.label}</span>
                              <div className={styles.covItems}>
                                {g.items.map((cv:any, ci:number) => (
                                  <span key={ci} className={styles.covItem} style={{paddingLeft:2}}>• {cv.coverage_name} <strong>{fmtAmount(cv.amount)}</strong></span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && groups.length === 0 && (
                      <div style={{padding:'8px 0 4px',fontSize:12,color:'#8892A0'}}>보장 내역이 없어요.</div>
                    )}
                  </div>
                )
              })}
              {!addInsMode ? (
                <button className={styles.addInsBtn} onClick={() => setAddInsMode(true)} style={{display:'block',width:'100%',textAlign:'center',cursor:'pointer',background:'none',border:'1px dashed hsl(var(--border-default))',borderRadius:8,padding:'8px',color:'hsl(var(--text-tertiary))',fontSize:13}}>+ 보험 추가</button>
              ) : (
                <div className={styles.editBox}>
                  <div className={styles.editSectionTitle}>보험 추가</div>
                  <div className={styles.editGrid}>
                    <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>보험사</label>
                      <div style={{display:'flex',gap:6}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>손해보험</div>
                          <select value={SONHAE_COMPANIES.includes(insForm.company)?insForm.company:''} onChange={e=>setInsForm({...insForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                            <option value="">-- 손해보험사 선택 --</option>
                            {SONHAE_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>생명보험</div>
                          <select value={SAENGMYEONG_COMPANIES.includes(insForm.company)?insForm.company:''} onChange={e=>setInsForm({...insForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                            <option value="">-- 생명보험사 선택 --</option>
                            {SAENGMYEONG_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>상품명</label><input value={insForm.product_name} onChange={e=>setInsForm({...insForm,product_name:e.target.value})} placeholder="무배당 건강보험" /></div>
                    <div className={styles.editField}><label>보험 종류</label>
                      <select value={insForm.insurance_type} onChange={e=>setInsForm({...insForm,insurance_type:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {INSURANCE_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>월보험료(원) *</label><input inputMode="numeric" value={insForm.monthly_fee?formatMoney(String(insForm.monthly_fee)):''} onChange={e=>setInsForm({...insForm,monthly_fee:parseMoney(e.target.value)})} placeholder="50,000" /></div>
                    <div className={styles.editField}><label>납입상태</label>
                      <select value={insForm.payment_status} onChange={e=>setInsForm({...insForm,payment_status:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {PAYMENT_STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>가입연월</label>
                      <div style={{display:'flex',gap:4}}>
                        <select value={parseContractStart(insForm.contract_start).year} onChange={e=>setInsForm({...insForm,contract_start:joinContractStart(e.target.value,parseContractStart(insForm.contract_start).month)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          <option value="">년</option>
                          {YEARS.map(y=><option key={y}>{y}</option>)}
                        </select>
                        <select value={parseContractStart(insForm.contract_start).month} onChange={e=>setInsForm({...insForm,contract_start:joinContractStart(parseContractStart(insForm.contract_start).year,e.target.value)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          <option value="">월</option>
                          {MONTHS.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.editField}><label>납입기간</label>
                      <select value={insForm.payment_years} onChange={e=>setInsForm({...insForm,payment_years:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        <option value="">선택</option>
                        {PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>만기</label>
                      <select value={insForm.expiry_age} onChange={e=>setInsForm({...insForm,expiry_age:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        <option value="">선택</option>
                        {EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.editSectionTitle} style={{marginTop:12}}>보장 항목</div>
                  {insCoverages.map((cv,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #E5E7EB'}}>
                      <span style={{color:'hsl(var(--text-tertiary))',minWidth:60}}>{cv.category}</span>
                      <span style={{flex:1}}>{cv.coverage_name}</span>
                      <span style={{color:'hsl(var(--accent))',fontWeight:600}}>{parseInt(cv.amount).toLocaleString()}원</span>
                      <button onClick={()=>setInsCoverages(v=>v.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'hsl(var(--text-tertiary))',cursor:'pointer',fontSize:13}}>✕</button>
                    </div>
                  ))}
                  <div className={styles.editGrid} style={{marginTop:8}}>
                    <div className={styles.editField}><label>카테고리</label>
                      <select value={newCov.category} onChange={e=>setNewCov({...newCov,category:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                        {['암진단','뇌혈관','심장','간병','수술비','실손','비급여','상해','사고처리','벌금','특이사항'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.editField}><label>보장명</label><input value={newCov.coverage_name} onChange={e=>setNewCov({...newCov,coverage_name:e.target.value})} placeholder="뇌출혈진단비" /></div>
                    <div className={styles.editField}><label>금액(원)</label><input inputMode="numeric" value={newCov.amount?formatMoney(String(newCov.amount)):''} onChange={e=>setNewCov({...newCov,amount:parseMoney(e.target.value)})} placeholder="30,000,000" /></div>
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

      {/* 재입력 모달 */}
      {reentryOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={() => { setReentryOpen(false); setReentryAddMode(false); setReentryReplaceId(null) }}>
          <div style={{background:'white',borderRadius:16,width:'100%',maxWidth:1040,maxHeight:'88vh',minHeight:'60vh',display:'flex',flexDirection:'column',boxSizing:'border-box',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:'1px solid #E5E7EB',flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:700,color:'#1A1A2E'}}>보험 재입력 — {selected?.name}</div>
              <button onClick={() => { setReentryOpen(false); setReentryAddMode(false); setReentryReplaceId(null) }} style={{background:'none',border:'none',fontSize:20,color:'#8892A0',cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
            </div>
            {/* 2열 본문 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',flex:1,overflow:'hidden',minHeight:320}}>
              {/* 왼쪽 — 붙여넣기 입력 */}
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:12,borderRight:'1px solid #E5E7EB',overflow:'hidden'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#636B78',textTransform:'uppercase',letterSpacing:'0.04em',flexShrink:0}}>보장내역 붙여넣기</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,flex:1,minHeight:0}}>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    <div style={{fontSize:13,color:'#5E6AD2',fontWeight:600,marginBottom:4,flexShrink:0,textTransform:'uppercase',letterSpacing:'0.04em'}}>정액형</div>
                    <textarea
                      ref={reentryTextareaRef}
                      value={reentryTextFixed}
                      onChange={e => { setReentryTextFixed(e.target.value); setReentryParsed(null) }}
                      placeholder="정액형 보장내역 붙여넣기 (Ctrl+V)"
                      style={{flex:1,width:'100%',padding:'12px 14px',borderRadius:8,border:'1px solid #E5E7EB',fontSize:13,fontFamily:'inherit',resize:'none',boxSizing:'border-box',lineHeight:1.7,color:'#1a1a1a',outline:'none',background:'#F7F8FA'}}
                    />
                  </div>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    <div style={{fontSize:13,color:'#636B78',fontWeight:600,marginBottom:4,flexShrink:0,textTransform:'uppercase',letterSpacing:'0.04em'}}>실손형</div>
                    <textarea
                      value={reentryTextLoss}
                      onChange={e => { setReentryTextLoss(e.target.value); setReentryParsed(null) }}
                      placeholder="실손형 보장내역 붙여넣기 (Ctrl+V)"
                      style={{flex:1,width:'100%',padding:'12px 14px',borderRadius:8,border:'1px solid #E5E7EB',fontSize:13,fontFamily:'inherit',resize:'none',boxSizing:'border-box',lineHeight:1.7,color:'#1a1a1a',outline:'none',background:'#F7F8FA'}}
                    />
                  </div>
                </div>
                {(() => {
                  const modeActive = !!reentryReplaceId || reentryAddMode
                  const hasText = !!(reentryTextFixed.trim() || reentryTextLoss.trim())
                  const canAnalyze = modeActive && hasText && !reentryParsing
                  return (
                    <button
                      onClick={handleReentryParse}
                      disabled={!canAnalyze}
                      style={{flexShrink:0,width:'100%',padding:'11px',borderRadius:8,border:'none',background:canAnalyze?'#5E6AD2':'#E5E7EB',color:canAnalyze?'white':'#8892A0',fontSize:14,fontWeight:600,cursor:canAnalyze?'pointer':'not-allowed',transition:'background 0.15s'}}
                    >
                      {reentryParsing ? 'AI 분석 중...' : !modeActive ? '교체할 계약 선택 또는 추가계약을 먼저' : 'AI 분석하기'}
                    </button>
                  )
                })()}
              </div>
              {/* 오른쪽 — 현재 계약 목록 + 분석 결과 */}
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',overflowY:'auto',justifyContent:'flex-start'}}>
                <style>{`
                  @keyframes reentryWaveUp {
                    0% { opacity:1; transform:translateY(0); max-height:60px; }
                    60% { opacity:0; transform:translateY(-28px); max-height:60px; }
                    100% { opacity:0; transform:translateY(-28px); max-height:0; padding:0; }
                  }
                  @keyframes reentryWaveDown {
                    0% { opacity:0; transform:translateY(-28px); max-height:0; }
                    40% { opacity:0; transform:translateY(-28px); max-height:60px; }
                    100% { opacity:1; transform:translateY(0); max-height:60px; }
                  }
                  @keyframes reentryFadeIn {
                    from { opacity:0; transform:translateY(8px); }
                    to { opacity:1; transform:translateY(0); }
                  }
                `}</style>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#636B78',textTransform:'uppercase',letterSpacing:'0.04em'}}>현재 계약 목록</div>
                  {!(reentryParsing || reentryParsed || reentryReturning) && (
                    <button
                      onClick={() => { setReentryAddMode(v => !v); setReentryReplaceId(null); setReentryParsed(null) }}
                      style={{fontSize:12,padding:'4px 12px',borderRadius:20,border:`1.5px solid ${reentryAddMode?'#5E6AD2':'#D0D3F0'}`,background:reentryAddMode?'#5E6AD2':'white',color:reentryAddMode?'white':'#5E6AD2',fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}}
                    >
                      + 추가계약
                    </button>
                  )}
                </div>
                {!(reentryParsing || reentryParsed || reentryReturning) && (
                  <div style={{flexShrink:0,padding:'8px 12px',borderRadius:8,background:reentryReplaceId?'#EEF0FB':reentryAddMode?'#EEF0FB':'#F7F8FA',border:`1px solid ${(reentryReplaceId||reentryAddMode)?'#5E6AD2':'#E5E7EB'}`,fontSize:13,color:(reentryReplaceId||reentryAddMode)?'#5E6AD2':'#8892A0',fontWeight:500,marginBottom:10}}>
                    {reentryReplaceId ? '교체 모드 — 왼쪽에 붙여넣고 AI 분석하기를 눌러주세요' : reentryAddMode ? '추가 모드 — 왼쪽에 붙여넣고 AI 분석하기를 눌러주세요' : '교체할 계약을 선택하거나 추가계약을 눌러주세요'}
                  </div>
                )}
                {selectedContracts.length === 0 && (
                  <div style={{fontSize:12,color:'#8892A0',padding:'6px 0'}}>등록된 계약이 없어요</div>
                )}
                {selectedContracts.map((ct, idx) => {
                  const isSelected = reentryReplaceId === ct.id
                  const isAnimating = (reentryParsing || !!reentryParsed) && !isSelected && !reentryReturning
                  const isReturning = reentryReturning && !isSelected
                  return (
                    <div key={ct.id} style={{
                      overflow: 'hidden',
                      animation: isAnimating
                        ? `reentryWaveUp 0.4s ease ${idx * 0.13}s forwards`
                        : isReturning
                        ? `reentryWaveDown 0.4s ease ${idx * 0.1}s both`
                        : undefined,
                      flexShrink: 0,
                      marginBottom: 8,
                    }}>
                      <div style={{display:'flex',alignItems:'center',gap:6,padding:'10px 12px',borderRadius:8,border:`1px solid ${isSelected?'#5E6AD2':'#E5E7EB'}`,background:isSelected?'#5E6AD2':'#F7F8FA',transition:'all 0.2s'}}>
                        <span style={{fontSize:13,color:isSelected?'white':'#1A1A2E',fontWeight:isSelected?600:400,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{idx+1}. {ct.company}{ct.product_name?` · ${ct.product_name}`:''}</span>
                        {isSelected ? (
                          <button onClick={() => {
                            setReentryParsed(null)
                            setReentryReturning(true)
                            const delay = (selectedContracts.length * 100) + 500
                            setTimeout(() => { setReentryReplaceId(null); setReentryReturning(false) }, delay)
                          }} style={{fontSize:11,padding:'3px 9px',borderRadius:4,border:'1px solid rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.15)',color:'white',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>취소</button>
                        ) : (
                          <button onClick={() => { setReentryReplaceId(ct.id); setReentryAddMode(false); setReentryParsed(null); setTimeout(() => reentryTextareaRef.current?.focus(), 50) }} style={{fontSize:11,padding:'3px 9px',borderRadius:4,border:'1px solid #D0D3F0',background:'white',color:'#5E6AD2',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>교체</button>
                        )}
                        {!isSelected && <button onClick={async (e) => { e.stopPropagation(); await deleteContract(ct.id, e as any); if (isSelected) setReentryReplaceId(null) }} style={{fontSize:11,padding:'3px 8px',borderRadius:4,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>삭제</button>}
                      </div>
                      {/* 분석 결과 or 에러 — 선택 계약 바로 아래 */}
                      {isSelected && reentryParsed && reentryParsed.contracts?.[0] && (() => {
                        const isDiff = reentryParsed.contracts[0].company && ct.company && reentryParsed.contracts[0].company !== ct.company
                        return (
                          <div style={{padding:'14px',background:'#F7F8FA',borderRadius:8,border:`1px solid ${isDiff?'#F59E0B':'#E5E7EB'}`,marginTop:8,animation:'reentryFadeIn 0.3s ease'}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                              <div style={{fontSize:12,fontWeight:600,color:'#5E6AD2'}}>분석 완료</div>
                              {isDiff && (
                                <div style={{fontSize:11,fontWeight:600,color:'#B45309',background:'#FEF3E2',border:'1px solid #FCD34D',borderRadius:4,padding:'1px 7px'}}>
                                  선택 계약과 다른 상품이에요
                                </div>
                              )}
                            </div>
                            <div style={{fontSize:13,color:'#1A1A2E',marginBottom:2}}>{reentryParsed.contracts[0].company} · {reentryParsed.contracts[0].product_name}</div>
                            <div style={{fontSize:12,color:'#636B78',marginBottom:10}}>{reentryParsed.contracts[0].monthly_fee>0?`${reentryParsed.contracts[0].monthly_fee.toLocaleString()}원/월 · `:''}{reentryParsed.contracts[0].coverages?.length||0}개 보장항목</div>
                            <div style={{display:'flex',justifyContent:'flex-end'}}>
                              <button onClick={handleRentrySave} disabled={reSaving} style={{padding:'10px 24px',borderRadius:8,border:'none',background:reSaving?'#E5E7EB':'#5E6AD2',color:reSaving?'#8892A0':'white',fontSize:14,fontWeight:600,cursor:reSaving?'not-allowed':'pointer'}}>
                                {reSaving ? '저장 중...' : '교체 저장'}
                              </button>
                            </div>
                          </div>
                        )
                      })()}
                      {isSelected && reentryParsed && !reentryParsed.contracts?.[0] && (
                        <div style={{padding:'10px 14px',background:'#F7F8FA',borderRadius:8,border:'1px solid #E5E7EB',fontSize:13,color:'#636B78',marginTop:8,animation:'reentryFadeIn 0.3s ease'}}>
                          계약 정보를 인식하지 못했어요. 텍스트를 확인 후 다시 시도해 주세요.
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* 새 계약 추가 모드 — 분석 결과 */}
                {!reentryReplaceId && reentryParsed && reentryParsed.contracts?.[0] && (
                  <div style={{padding:'14px',background:'#F7F8FA',borderRadius:8,border:'1px solid #E5E7EB',animation:'reentryFadeIn 0.3s ease'}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#5E6AD2',marginBottom:4}}>분석 완료</div>
                    <div style={{fontSize:13,color:'#1A1A2E',marginBottom:2}}>{reentryParsed.contracts[0].company} · {reentryParsed.contracts[0].product_name}</div>
                    <div style={{fontSize:12,color:'#636B78',marginBottom:10}}>{reentryParsed.contracts[0].monthly_fee>0?`${reentryParsed.contracts[0].monthly_fee.toLocaleString()}원/월 · `:''}{reentryParsed.contracts[0].coverages?.length||0}개 보장항목</div>
                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <button onClick={handleRentrySave} disabled={reSaving} style={{padding:'10px 24px',borderRadius:8,border:'none',background:reSaving?'#E5E7EB':'#5E6AD2',color:reSaving?'#8892A0':'white',fontSize:14,fontWeight:600,cursor:reSaving?'not-allowed':'pointer'}}>
                        {reSaving ? '저장 중...' : '추가 저장'}
                      </button>
                    </div>
                  </div>
                )}
                {!reentryReplaceId && reentryParsed && !reentryParsed.contracts?.[0] && (
                  <div style={{padding:'10px 14px',background:'#F7F8FA',borderRadius:8,border:'1px solid #E5E7EB',fontSize:13,color:'#636B78',animation:'reentryFadeIn 0.3s ease'}}>
                    계약 정보를 인식하지 못했어요. 텍스트를 확인 후 다시 시도해 주세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 슬라이드업 팝업 (모바일 전용) */}
      <div className={[styles.slideOverlay, slideOpen ? styles.overlayVisible : ''].join(' ')} onClick={closeSlide}>
        <div
          className={[styles.slidePanel, slideOpen ? styles.slideIn : styles.slideOut].join(' ')}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => {
            // 멀티터치(핀치 줌 등) 또는 확대 상태에서는 드래그 처리 안 함
            if (e.touches.length > 1) return
            if (zoomStateRef.current.scale > 1) return
            const startY = e.touches[0].clientY
            const panel = e.currentTarget as HTMLElement
            const content = slideContentRef.current
            let dragging = false

            const onMove = (ev: TouchEvent) => {
              // 드래그 중 손가락이 추가되면 드래그 취소 후 핀치 줌 허용
              if (ev.touches.length > 1) {
                dragging = false
                panel.style.transition = ''
                panel.style.transform = ''
                panel.removeEventListener('touchmove', onMove)
                document.removeEventListener('touchend', onEnd)
                return
              }
              const dy = ev.touches[0].clientY - startY
              // 콘텐츠 스크롤 중이면 패널 드래그 안 함
              if (content && content.scrollTop > 0 && dy > 0) return
              if (dy > 0) {
                dragging = true
                panel.style.transform = `translateY(${dy}px)`
                panel.style.transition = 'none'
              }
            }
            const onEnd = (ev: TouchEvent) => {
              const dy = ev.changedTouches[0].clientY - startY
              panel.style.transition = ''
              panel.style.transform = ''
              if (dragging && dy > 100) closeSlide()
              panel.removeEventListener('touchmove', onMove)
              document.removeEventListener('touchend', onEnd)
            }
            panel.addEventListener('touchmove', onMove, { passive: true })
            document.addEventListener('touchend', onEnd)
          }}
        >
          <div className={styles.slideHandle} />
          <div className={styles.slideContent} ref={slideContentRef} style={{ touchAction: 'pan-y', overflow: 'auto' }}>
            <div ref={zoomWrapperRef} style={{ transformOrigin: '0 0', willChange: 'transform' }}>
            {addMode && !selected && (
              <div className={styles.editBox} style={{padding:'20px 0'}}>
                <div className={styles.slideHeader} style={{marginBottom:12}}>
                  <div style={{flex:1,fontWeight:700,fontSize:15}}>{addType === 'existing' ? '마이고객' : '관심고객'} 추가</div>
                  <button className={styles.slideCloseBtn} onClick={closeSlide}>✕</button>
                </div>
                <div className={styles.editSectionTitle}>개인정보</div>
                <div className={styles.editGrid}>
                  <div className={styles.editField}><label>이름 *</label><input placeholder="홍길동" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value.replace(/[0-9]/g, '') })} /></div>
                  <div className={styles.editField}><label>연락처</label><input placeholder="010-0000-0000" inputMode="numeric" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: formatPhone(e.target.value) })} /></div>
                  <div className={styles.editField}><label>주민등록번호 *</label>
                    <input placeholder="000000-0000000" inputMode="numeric" value={addForm.resident_number}
                      onChange={e => { const v = formatResident(e.target.value); const parsed = parseResident(v); setAddForm({ ...addForm, resident_number: v, gender: parsed.gender || addForm.gender, age: parsed.age ? String(parsed.age) : addForm.age }) }} />
                  </div>
                  <div className={styles.editField}><label>성별</label>
                    <select value={addForm.gender||'남'} onChange={e => setAddForm({ ...addForm, gender: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                      <option>남</option><option>여</option>
                    </select>
                  </div>
                  <div className={styles.editField}><label>은행명</label><input placeholder="우리은행" value={addForm.bank_name||''} onChange={e => setAddForm({ ...addForm, bank_name: e.target.value })} /></div>
                  <div className={styles.editField}><label>계좌번호</label><input placeholder="1002-3628-09746" inputMode="numeric" value={addForm.bank_account||''} onChange={e => setAddForm({ ...addForm, bank_account: e.target.value.replace(/[^0-9-]/g,'') })} /></div>
                  <div className={styles.editField} style={{gridColumn:'span 2'}}><label>주소</label><input value={addForm.address||''} onChange={e => setAddForm({ ...addForm, address: e.target.value })} /></div>
                  <div className={styles.editField}><label>직업</label>
                    <select value={addForm.job} onChange={e => setAddForm({ ...addForm, job: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                      {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j=><option key={j}>{j}</option>)}
                    </select>
                  </div>
                  <div className={styles.editField}><label>직장/소속</label><input value={addForm.workplace||''} onChange={e => setAddForm({ ...addForm, workplace: e.target.value })} /></div>
                  <div className={styles.editField}><label>운전면허</label><input placeholder="26-06-009864-70" value={addForm.driver_license||''} onChange={e => setAddForm({ ...addForm, driver_license: e.target.value })} /></div>
                  <div className={styles.editField}><label>등급</label>
                    <select value={addForm.grade} onChange={e => setAddForm({ ...addForm, grade: e.target.value })} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                      {['일반','우수','VIP'].map(g=><option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.editActions} style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                  <button className={styles.saveBtn} onClick={saveAddCustomer}>저장</button>
                  <button className={styles.cancelBtn} onClick={() => { setAddMode(false); closeSlide() }}>취소</button>
                </div>
              </div>
            )}
            {selected && (
              <>
                <div className={styles.detailHeaderNew} style={{position:'relative'}}>
                  <div className={styles.detailHeaderRow1}>
                    <span className={[styles.detailTypeTag, selected.customer_type === 'prospect' ? styles.detailTypeTagProspect : styles.detailTypeTagMy].join(' ')}>
                      {selected.customer_type === 'prospect' ? '관심' : '마이'}
                    </span>
                    <span className={styles.detailNameLg}>{selected.name}</span>
                    {selected.grade === 'VIP' && <span className={styles.gradeVip}>VIP</span>}
                    <button className={styles.slideCloseBtn} style={{marginLeft:'auto'}} onClick={closeSlide}>✕</button>
                  </div>
                  <div className={styles.detailMetaRow}>
                    <div className={styles.detailHeaderRow2}>
                      {selected.age || (selected.birth_date ? new Date().getFullYear() - new Date(selected.birth_date).getFullYear() : "")}세 · {selected.gender} · {selected.job} · {selected.phone}
                    </div>
                    {!editMode && (
                      <div className={styles.detailHeaderRow3}>
                        <button className={styles.smsBtn} onClick={() => { setSmsCustomer(selected); setSmsOpen(true) }}>문자</button>
                        <button className={styles.editBtn} onClick={() => { setEditMode(true); setEditForm(selected) }}>수정</button>
                        <button className={styles.deleteBtn} onClick={() => deleteCustomer(selected)}>삭제</button>
                      </div>
                    )}
                  </div>
                </div>

                {editMode && (
                  <div className={styles.editBox}>
                    <div className={styles.editSectionTitle}>개인정보 수정</div>
                    <div className={styles.editGrid}>
                      <div className={styles.editField}><label>이름</label><input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
                      <div className={styles.editField}><label>연락처</label><input inputMode="numeric" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:formatPhone(e.target.value)})} /></div>
                      <div className={styles.editField}><label>주민등록번호</label><input value={editForm.resident_number||''} maxLength={14} placeholder="000000-0000000"
                        onChange={e=>{
                          const raw=e.target.value.replace(/[^0-9]/g,'').slice(0,13)
                          const fmt=raw.length<=6?raw:raw.slice(0,6)+'-'+raw.slice(6)
                          const {gender,age,birthDate}=parseResident(fmt)
                          setEditForm({...editForm,resident_number:fmt,...(raw.length>=7?{gender,age,birth_date:birthDate}:{})})
                        }} /></div>
                      <div className={styles.editField}><label>성별 <span style={{fontSize:10,background:'hsl(var(--accent)/0.12)',color:'hsl(var(--accent))',padding:'1px 5px',borderRadius:999,fontWeight:600,marginLeft:2}}>자동</span></label>
                        <select value={editForm.gender||'남'} onChange={e=>setEditForm({...editForm,gender:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          <option>남</option><option>여</option><option>기타</option>
                        </select>
                      </div>
                      <div className={styles.editField}><label>은행명</label>
                        <select value={editForm.bank_name||''} onChange={e=>setEditForm({...editForm,bank_name:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          {['','KB국민','신한','하나','우리','NH농협','IBK기업','카카오뱅크','케이뱅크','토스뱅크','SC제일','새마을금고','신협','수협','우체국'].map(b=><option key={b} value={b}>{b||'선택'}</option>)}
                        </select>
                      </div>
                      <div className={styles.editField}><label>계좌번호</label><input inputMode="numeric" value={editForm.bank_account||''} onChange={e=>setEditForm({...editForm,bank_account:e.target.value.replace(/[^0-9-]/g,'')})} /></div>
                      <div className={styles.editField} style={{gridColumn:'span 2'}}><label>주소</label><input value={editForm.address||''} onChange={e=>setEditForm({...editForm,address:e.target.value})} /></div>
                      <div className={styles.editField}><label>직업</label>
                        <select value={editForm.job||'직장인'} onChange={e=>setEditForm({...editForm,job:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          {['직장인','자영업자','공무원','교사/교직원','의료인','전문직','주부','학생','농업/어업','프리랜서','은퇴/무직','기타'].map(j=><option key={j}>{j}</option>)}
                        </select>
                      </div>
                      <div className={styles.editField}><label>직장/소속</label><input value={editForm.workplace||''} onChange={e=>setEditForm({...editForm,workplace:e.target.value})} /></div>
                      <div className={styles.editField}><label>운전면허</label><input value={editForm.driver_license||''} onChange={e=>setEditForm({...editForm,driver_license:e.target.value})} /></div>
                      <div className={styles.editField}><label>등급</label>
                        <select value={editForm.grade||'일반'} onChange={e=>setEditForm({...editForm,grade:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                          {['일반','우수','VIP','VVIP'].map(g=><option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.editActions} style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                      <button className={styles.saveBtn} onClick={saveCustomerEdit}>저장</button>
                      <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>취소</button>
                    </div>
                  </div>
                )}

                <div className={styles.infoTable}>
                  <div className={styles.infoRowDouble}>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>나이</span><span className={styles.infoValue}>{selected.age || (selected.birth_date ? new Date().getFullYear() - new Date(selected.birth_date).getFullYear() : "")}세</span></div>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>성별</span><span className={styles.infoValue}>{selected.gender}</span></div>
                  </div>
                  <div className={styles.infoRowDouble}>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>연락처</span><span className={styles.infoValue}>{selected.phone}</span></div>
                    <div className={styles.infoHalf}><span className={styles.infoLabel}>직업</span><span className={styles.infoValue}>{selected.job}</span></div>
                  </div>
                  {selected.resident_number && <div className={styles.infoRow}><span className={styles.infoLabel}>주민번호</span><span className={styles.infoValue}>{selected.resident_number}</span></div>}
                  {selected.workplace && <div className={styles.infoRow}><span className={styles.infoLabel}>직장/소속</span><span className={styles.infoValue}>{selected.workplace}</span></div>}
                  {selected.address && <div className={styles.infoRow}><span className={styles.infoLabel}>주소</span><span className={styles.infoValue}>{selected.address}</span></div>}
                  {(selected.bank_name || selected.bank_account) && <div className={styles.infoRow}><span className={styles.infoLabel}>계좌번호</span><span className={styles.infoValue}>{selected.bank_name} {selected.bank_account}</span></div>}
                  {selected.driver_license && <div className={styles.infoRow}><span className={styles.infoLabel}>운전면허</span><span className={styles.infoValue}>{selected.driver_license}</span></div>}
                  {selected.grade && <div className={styles.infoRow}><span className={styles.infoLabel}>등급</span><span className={styles.infoValue}>{selected.grade}</span></div>}
                  <div className={styles.infoRowLast}>
                    <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>계약 수</span><span className={styles.infoValue}>{selectedContracts.length}건</span></div>
                    <div className={styles.infoRow} style={{ borderBottom: 'none', paddingBottom: 0 }}><span className={styles.infoLabel}>총 월납입</span><span className={[styles.infoValue, styles.infoGreen].join(' ')}>{totalMonthly.toLocaleString()}원</span></div>
                  </div>
                </div>

                <div className={styles.section} style={{justifyContent:'space-between'}}>
                  <span>보험 계약 현황</span>
                  <button onClick={() => { setReentryOpen(true); setReentryParsed(null); setReentryTextFixed(''); setReentryTextLoss(''); setReentryReplaceId(null); setReentryAddMode(false) }} style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'white',color:'#636B78',cursor:'pointer',fontWeight:500,letterSpacing:0,textTransform:'none'}}>재입력</button>
                </div>
                {selectedContracts.map((ct, idx) => {
                  const groups = getCoveragesByContract(ct.id)
                  const isEditing = editContractId === ct.id
                  return (
                    <div key={ct.id} className={calcPaymentRate(ct) >= 90 && ct.payment_status !== '완납' ? styles.insCardWarn : styles.insCard}>
                      <div className={styles.insCardHeader}>
                        <div className={styles.insCardTitle}>{idx + 1}. {ct.company}{ct.product_name ? ` · ${ct.product_name}` : ''}</div>
                        <div className={styles.insCardBottomRow}>
                          <div className={styles.insCardMeta}>
                            {ct.monthly_fee > 0 ? `${ct.monthly_fee.toLocaleString()}원/월` : ''}
                            {ct.contract_start ? ` · ${ct.contract_start} 가입` : ''}
                            {ct.payment_years ? ` · ${ct.payment_years}` : ''}
                            {ct.expiry_age ? ` · ${ct.expiry_age}만기` : ''}
                          </div>
                          <div className={styles.insCardBadges}>
                            <span className={[styles.badge, ct.payment_status === '완납' ? styles.badgeGreen : calcPaymentRate(ct) >= 90 ? styles.badgeWarn : styles.badgeBlue].join(' ')}>
                              {ct.payment_status === '완납' ? '완납' : `${calcPaymentRate(ct)}%`}
                            </span>
                            {ct.insurance_type && <span className={styles.insTypeBadge}>{ct.insurance_type}</span>}
                          </div>
                          <div className={styles.insCardActions}>
                            <button className={styles.editBtn} onClick={() => { setEditContractId(isEditing ? null : ct.id); setEditContractForm(ct) }}>수정</button>
                            <button className={styles.deleteBtn} onClick={e => deleteContract(ct.id, e)}>삭제</button>
                          </div>
                        </div>
                      </div>
                      {isEditing && (
                        <div className={styles.contractEditBox}>
                          <div className={styles.editGrid}>
                            <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>보험사</label>
                              <div style={{display:'flex',gap:6}}>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>손해보험</div>
                                  <select value={SONHAE_COMPANIES.includes(editContractForm.company||'')?editContractForm.company:''} onChange={e=>setEditContractForm({...editContractForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                                    <option value="">-- 손해보험사 선택 --</option>
                                    {SONHAE_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                                  </select>
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,color:'#636B78',marginBottom:3}}>생명보험</div>
                                  <select value={SAENGMYEONG_COMPANIES.includes(editContractForm.company||'')?editContractForm.company:''} onChange={e=>setEditContractForm({...editContractForm,company:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',fontFamily:'inherit'}}>
                                    <option value="">-- 생명보험사 선택 --</option>
                                    {SAENGMYEONG_COMPANIES.map(n=><option key={n} value={n}>{n}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div className={styles.editField} style={{gridColumn:'1 / -1'}}><label>상품명</label><input value={editContractForm.product_name||''} onChange={e=>setEditContractForm({...editContractForm,product_name:e.target.value})} /></div>
                            <div className={styles.editField}><label>월보험료(원)</label><input inputMode="numeric" value={editContractForm.monthly_fee?formatMoney(String(editContractForm.monthly_fee)):''} onChange={e=>setEditContractForm({...editContractForm,monthly_fee:parseMoney(e.target.value)})} placeholder="50,000" /></div>
                            <div className={styles.editField}><label>보험종류</label>
                              <select value={editContractForm.insurance_type||''} onChange={e=>setEditContractForm({...editContractForm,insurance_type:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                {INSURANCE_TYPES.map(t=><option key={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className={styles.editField}><label>가입연월</label>
                              <div style={{display:'flex',gap:4}}>
                                <select value={parseContractStart(editContractForm.contract_start||'').year} onChange={e=>setEditContractForm({...editContractForm,contract_start:joinContractStart(e.target.value,parseContractStart(editContractForm.contract_start||'').month)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                  <option value="">년</option>
                                  {YEARS.map(y=><option key={y}>{y}</option>)}
                                </select>
                                <select value={parseContractStart(editContractForm.contract_start||'').month} onChange={e=>setEditContractForm({...editContractForm,contract_start:joinContractStart(parseContractStart(editContractForm.contract_start||'').year,e.target.value)})} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                  <option value="">월</option>
                                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className={styles.editField}><label>납입기간</label>
                              <select value={editContractForm.payment_years||''} onChange={e=>setEditContractForm({...editContractForm,payment_years:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                <option value="">선택</option>
                                {PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                              </select>
                            </div>
                            <div className={styles.editField}><label>만기</label>
                              <select value={editContractForm.expiry_age||''} onChange={e=>setEditContractForm({...editContractForm,expiry_age:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                <option value="">선택</option>
                                {EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                              </select>
                            </div>
                            <div className={styles.editField}><label>납입상태</label>
                              <select value={editContractForm.payment_status||''} onChange={e=>setEditContractForm({...editContractForm,payment_status:e.target.value})} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid hsl(var(--border-default))',background:'hsl(var(--bg-panel))'}}>
                                {PAYMENT_STATUSES.map(s=><option key={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className={styles.editActions}>
                            <button className={styles.saveBtn} onClick={saveContractEdit}>저장</button>
                            <button className={styles.cancelBtn} onClick={() => setEditContractId(null)}>취소</button>
                          </div>
                        </div>
                      )}
                      {groups.length > 0 && (
                        <div className={styles.coverageList}>
                          {(() => {
                            // section 값이 있는지 확인
                            const hasSections = groups.some((g: any) => g.items.some((cv: any) => cv.section && cv.section !== '정액형'))
                            const sections = hasSections
                              ? ['정액형', '실손형']
                              : ['정액형']

                            return sections.map(section => {
                              const sectionGroups = hasSections
                                ? groups.map((g: any) => ({ ...g, items: g.items.filter((cv: any) => (cv.section || '정액형') === section) })).filter((g: any) => g.items.length > 0)
                                : groups

                              if (sectionGroups.length === 0) return null
                              return (
                                <div key={section}>
                                  {hasSections && (
                                    <div style={{fontSize:11, fontWeight:600, color:'hsl(var(--text-tertiary))', padding:'6px 0 2px', borderBottom:'1px solid #F3F4F6', marginBottom:4}}>
                                      {section === '정액형' ? '📋 정액형 보장' : '🏥 실손형 보장'}
                                    </div>
                                  )}
                                  {sectionGroups.map((g: any) => (
                                    <div key={g.key} className={styles.coverageRow}>
                                      <span className={styles.covIcon}>{g.icon}</span>
                                      <div className={styles.covRight}>
                                        <span className={styles.covLabel}>{g.label}</span>
                                        <div className={styles.covItems}>
                                          {g.items.map((cv: any, ci: number) => (
                                            <span key={ci} className={styles.covItem} style={{paddingLeft:2}}>• {cv.coverage_name} <strong>{fmtAmount(cv.amount)}</strong></span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            })
                          })()}
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
    </div>
  )
}

// v2
