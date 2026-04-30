import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useConfirm } from '../lib/useConfirm'
import styles from '../styles/Consultations.module.css'
import AdminLayout from '../components/AdminLayout'
import { ChevronLeft, ChevronRight, Edit2, X, Check, MapPin, Clock } from 'lucide-react'
import { ReportPreviewDoc } from '../components/ReportPreviewDoc'

/* ─── Constants ─── */
const COVERAGE_GROUPS = [
  { key: '암진단', icon: '💊', label: '암 보장' },
  { key: '뇌혈관', icon: '🧠', label: '뇌혈관' },
  { key: '심장',   icon: '❤️', label: '심장' },
  { key: '간병',   icon: '🤝', label: '간병' },
  { key: '수술비', icon: '🔬', label: '수술비' },
  { key: '실손',   icon: '🏥', label: '실손' },
  { key: '비급여', icon: '💉', label: '비급여' },
  { key: '상해',   icon: '🩹', label: '상해' },
  { key: '사고처리', icon: '⚖️', label: '사고처리' },
  { key: '벌금',   icon: '💰', label: '벌금' },
  { key: '특이사항', icon: '📌', label: '특이사항' },
]

function calcPaymentRate(ct: any): number {
  if (ct.payment_status === '완납') return 100
  if (ct.contract_start && ct.payment_years) {
    const match = ct.payment_years.match(/(\d+)년/)
    if (match) {
      const totalMonths = parseInt(match[1]) * 12
      const [year, month] = ct.contract_start.split('.').map(Number)
      if (year && month) {
        const now = new Date()
        const paid = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1
        return Math.min(Math.round(Math.max(0, paid) / totalMonths * 100), 100)
      }
    }
  }
  return ct.payment_rate || 0
}

function fmtAmount(n: number): string {
  if (!n && n !== 0) return ''
  if (n >= 100000000) { const v = n / 100000000; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '억원' }
  if (n >= 10000000)  { const v = n / 10000000;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '천만원' }
  if (n >= 10000)     { const v = n / 10000;     return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '만원' }
  return n.toLocaleString() + '원'
}

const MEETING_TYPES = [
  { value: '첫 만남',      desc: '신규 고객 초면',          color: 'hsl(214 80% 58%)' },
  { value: '니즈 분석',    desc: '고객 상황/필요 파악',      color: 'hsl(270 55% 58%)' },
  { value: '상품 설명',    desc: '보험 상품 제안/설명',      color: 'hsl(237 47% 59%)' },
  { value: '계약 체결',    desc: '청약서 작성',              color: 'hsl(142 55% 42%)' },
  { value: '계약 후 관리', desc: '가입 후 안부/유지 관리',  color: 'hsl(168 55% 38%)' },
  { value: '보험금 청구',  desc: '사고/질병 발생 시 도움',  color: 'hsl(30 75% 52%)' },
  { value: '갱신 상담',    desc: '만기/갱신 시점 상담',     color: 'hsl(45 80% 44%)' },
  { value: '추가 가입',    desc: '기존 고객 추가 상품 제안', color: 'hsl(320 55% 55%)' },
  { value: '불만 처리',    desc: '민원/불만 고객 응대',     color: 'hsl(0 65% 50%)' },
]
const TYPE_COLOR: Record<string, string> = Object.fromEntries(MEETING_TYPES.map(t => [t.value, t.color]))
const STATUS_OPTIONS = ['대기', '확정', '완료', '취소']
const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const EMPTY_FORM = {
  customer_id: '', meeting_date: new Date().toISOString().split('T')[0],
  meeting_time: '', location: '', meeting_type: '첫 만남', notes: '', status: '대기',
}

/* ─── Week bounds ─── */
function getWeekBounds() {
  const today = new Date()
  const dow = today.getDay()
  const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const sun = new Date(mon);   sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] }
}

/* ─── Mock 리포트 데이터 (성복경 고객 기준 샘플) ─── */
const MOCK_REPORTS = [
  {
    id: 'r-001', label: '최초 보장 분석', meeting_type: '첫 만남', date: '2026.01.15',
    sections: [
      { heading: '고객 기본 정보', items: [
        { label: '고객명', value: '성복경', warn: false },
        { label: '나이/성별', value: '48세 / 여', warn: false },
        { label: '직업', value: '자영업 (식당)', warn: false },
        { label: '가족 구성', value: '배우자 + 자녀 2명', warn: false },
      ]},
      { heading: '보유 계약 (8건)', items: [
        { label: '총 월납입', value: '476,189원', warn: false },
        { label: '손보 계약', value: '5건 (DB·현대·KB·메리츠·롯데)', warn: false },
        { label: '생보 계약', value: '3건 (삼성·교보·한화)', warn: false },
      ]},
      { heading: '보장 공백', items: [
        { label: '뇌혈관 진단비', value: '2천만 미만 → 보강 필요', warn: true },
        { label: '심장 진단비', value: '3천만 미만 → 보강 필요', warn: true },
        { label: '간병/LTC', value: '미가입 → 심각한 공백', warn: true },
      ]},
      { heading: '추천 상담 스크립트', text: '① 뇌혈관·심장 보강: "48세 이후 뇌심혈관 발병률이 3배 높아집니다. 지금 2,000만→5,000만원으로 올려두시면 안심이 되세요."\n② 간병 공백: "자녀 둘이 성인이 된 후 간병 비용은 본인이 감당해야 합니다. 월 3만원대 LTC로 준비하세요."\n③ 자영업 소득보상: "가게 쉬는 기간 소득이 없어요. 취업불능보험으로 월 100만원 이상 보장 가능합니다."' },
    ],
  },
  {
    id: 'r-002', label: '니즈 분석', meeting_type: '니즈 분석', date: '2026.02.10',
    sections: [
      { heading: '고객 기본 정보', items: [
        { label: '월 순소득', value: '약 350만원 (자영업)', warn: false },
        { label: '부채', value: '주택담보대출 1.2억', warn: false },
        { label: '보험 한도', value: '배우자 합산 월 30만원 이내', warn: false },
      ]},
      { heading: '니즈 분석 결과', text: '자영업 특성상 소득 불안정. 간병·뇌심혈관이 최우선 보강 필요.\n배우자 합산 월 납입 한도: 30만원 이내로 설계 필요.' },
      { heading: '다음 단계', items: [
        { label: '제안 상품', value: 'LTC + 뇌심혈관 통합보장', warn: false },
        { label: '다음 미팅', value: '2026.03.05 상품 설명 예정', warn: false },
      ]},
    ],
  },
  {
    id: 'r-003', label: '만기 재설계', meeting_type: '갱신 상담', date: '2026.03.20',
    sections: [
      { heading: '갱신 대상 계약', items: [
        { label: 'DB손해보험', value: '운전자보험 2026.05 만기', warn: true },
        { label: '현대해상', value: '실손의료비 2026.06 갱신', warn: true },
      ]},
      { heading: '재설계 방향', text: '운전자보험 갱신 시 법률비용 한도 3천→5천만원 상향 권고.\n실손 갱신료 인상분 협의 및 4세대 실손 전환 검토.' },
      { heading: '결론', items: [
        { label: '우선순위', value: '운전자보험 재가입 선처리', warn: false },
        { label: '고객 요청', value: '실손 갱신료 비교 자료 요청', warn: false },
      ]},
    ],
  },
  {
    id: 'r-004', label: '추가 보장', meeting_type: '추가 가입', date: '2026.04.08',
    sections: [
      { heading: '추가 가입 내용', items: [
        { label: '상품', value: 'KB손해보험 간병보험', warn: false },
        { label: '월 보험료', value: '28,900원', warn: false },
        { label: '보장', value: '중증간병 월 100만원', warn: false },
        { label: '부책일', value: '2026.04.22', warn: false },
      ]},
      { heading: '계약 후 안내', text: '청약 완료. 14일 이내 철회 가능.\n1개월 후 보장 개시 확인 안내 예정.' },
    ],
  },
]

/* ─── Page ─── */
export default function Consultations() {
  const router = useRouter()
  const [consultations, setConsultations] = useState<any[]>([])
  const [customers, setCustomers]         = useState<any[]>([])
  const [agentId, setAgentId]             = useState('')
  const [loading, setLoading]             = useState(true)

  /* Calendar */
  const todayStr = new Date().toISOString().split('T')[0]
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })


  /* Popup — 0:closed 1:820px(기본) 2:+리포트패널 */
  const [popupStage, setPopupStage]       = useState<0 | 1 | 2>(0)
  const [popupRightTab, setPopupRightTab] = useState<'coverage' | 'history' | 'report'>('coverage')
  const [expandedContractIds, setExpandedContractIds] = useState<string[]>([])

  /* 캘린더 유형 필터 */
  const [calTypeFilter, setCalTypeFilter] = useState<string | null>(null)
  const [form, setForm]                   = useState({ ...EMPTY_FORM })
  const [editId, setEditId]               = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [custSearch, setCustSearch]       = useState('')
  const [showCustDrop, setShowCustDrop]   = useState(false)
  const [custActiveIdx, setCustActiveIdx] = useState(-1)
  const dropRef                           = useRef<HTMLDivElement>(null)
  const dropListRef                       = useRef<HTMLDivElement>(null)
  const layoutRef                         = useRef<HTMLDivElement>(null)

  /* Note editing (inside popup timeline) */
  const [editNoteId, setEditNoteId] = useState<string | null>(null)
  const [noteText, setNoteText]     = useState('')

  /* Coverage data for popup */
  const [popupContracts, setPopupContracts] = useState<any[]>([])
  const [popupCoverages, setPopupCoverages] = useState<any[]>([])
  const [coverageLoading, setCoverageLoading] = useState(false)

  /* 미팅 리포트 패널 */
  const [popupMeetings, setPopupMeetings]     = useState<any[]>([])
  const [reportLoading, setReportLoading]     = useState(false)

  /* 저장된 리포트 */
  const [savedReport, setSavedReport]         = useState<any>(null)
  const [reportFetching, setReportFetching]   = useState(false)

  /* Confirm dialog */
  const { confirm, ConfirmDialog } = useConfirm()

  /* Toast */
  const [toast, setToast] = useState('')
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }, [])

  /* 고객 리포트 선택 */
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  /* SVG 도트라인 커넥터 */
  const popupRef        = useRef<HTMLDivElement>(null)
  const tlItemRefs      = useRef<Record<string, HTMLDivElement | null>>({})
  const reportListRefs  = useRef<Record<string, HTMLDivElement | null>>({})
  const reportTitleRef  = useRef<HTMLDivElement | null>(null)
  const [connLines, setConnLines] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>>([])

  useLayoutEffect(() => {
    if (popupStage < 2 || popupRightTab !== 'history' || !popupRef.current) { setConnLines([]); return }
    const recalc = () => {
      if (!popupRef.current) return
      const popup = popupRef.current.getBoundingClientRect()
      const lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = []
      MOCK_REPORTS.forEach(r => {
        const tlEl = tlItemRefs.current[r.id]
        const rpEl = reportListRefs.current[r.id]
        if (!tlEl || !rpEl) return
        const tl = tlEl.getBoundingClientRect()
        const rp = rpEl.getBoundingClientRect()
        lines.push({
          id: r.id,
          x1: tl.right - popup.left,
          y1: tl.top + tl.height / 2 - popup.top,
          x2: rp.left - popup.left,
          y2: rp.top + rp.height / 2 - popup.top,
        })
      })
      setConnLines(lines)
    }
    const t = setTimeout(recalc, 380)
    recalc()
    return () => clearTimeout(t)
  }, [popupStage, popupRightTab, form.customer_id])

  useEffect(() => { fetchAll() }, [])

  /* Layout height — fill remaining viewport below layout top */
  useLayoutEffect(() => {
    function updateLayoutH() {
      const el = layoutRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      el.style.height = `${window.innerHeight - top - 76}px`
    }
    updateLayoutH()
    window.addEventListener('resize', updateLayoutH)
    return () => window.removeEventListener('resize', updateLayoutH)
  }, [loading])

  /* 고객 선택 시 계약/보장 데이터 fetch */
  useEffect(() => {
    if (!form.customer_id) { setPopupContracts([]); setPopupCoverages([]); return }
    setCoverageLoading(true)
    ;(async () => {
      const { data: cts } = await supabase.from('dpa_contracts').select('*').eq('customer_id', form.customer_id).order('created_at', { ascending: true })
      const ids = (cts || []).map((c: any) => c.id)
      const { data: cvs } = ids.length > 0
        ? await supabase.from('dpa_coverages').select('*').in('contract_id', ids).order('section', { ascending: true }).order('sort_order', { ascending: true })
        : { data: [] }
      setPopupContracts(cts || [])
      setPopupCoverages(cvs || [])
      setCoverageLoading(false)
    })()
  }, [form.customer_id])

  /* 리포트 패널 닫히거나 고객 바뀌면 선택 초기화 */
  useEffect(() => { if (popupStage < 2) setSelectedReportId(null) }, [popupStage])
  useEffect(() => { setSelectedReportId(null) }, [form.customer_id])

  /* Close customer dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowCustDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* Close popup on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setAgentId(user.id)
    const [{ data: custs }, { data: cons }] = await Promise.all([
      supabase.from('dpa_customers').select('id, name, customer_type, phone, email, memo, age, birth_date, gender, job, workplace, driver_license, address, grade').eq('agent_id', user.id).order('name'),
      supabase.from('dpa_consultations').select('*').eq('agent_id', user.id).order('meeting_date').order('meeting_time'),
    ])
    setCustomers(custs || [])
    setConsultations(cons || [])
    setLoading(false)
  }

  /* ─── Popup helpers ─── */
  function openNewPopup(date: string) {
    setForm({ ...EMPTY_FORM, meeting_date: date })
    setCustSearch(''); setEditId(null)
    setPopupRightTab('coverage')
    setSelectedReportId(null)
    setPopupStage(1)
    document.body.style.overflow = 'hidden'
  }

  function openEditPopup(c: any) {
    const cust = customers.find(cu => cu.id === c.customer_id)
    setForm({
      customer_id: c.customer_id, meeting_date: c.meeting_date,
      meeting_time: c.meeting_time || '', location: c.location || '',
      meeting_type: c.meeting_type, notes: c.notes || '', status: c.status,
    })
    setCustSearch(cust?.name || ''); setEditId(c.id)
    setPopupRightTab('history')
    setSelectedReportId(null)
    setPopupStage(1)
    document.body.style.overflow = 'hidden'
  }

  function closePopup() {
    setPopupStage(0); setEditId(null)
    setForm({ ...EMPTY_FORM }); setCustSearch('')
    setEditNoteId(null); setPopupMeetings([])
    setSelectedReportId(null)
    document.body.style.overflow = ''
  }

  async function saveConsultation() {
    if (!form.customer_id) return alert('고객을 선택해주세요.')
    if (!form.meeting_date) return alert('날짜를 입력해주세요.')
    setSaving(true)
    const payload = { ...form, agent_id: agentId }
    let error: any = null
    if (editId) {
      const res = await supabase.from('dpa_consultations').update(payload).eq('id', editId)
      error = res.error
    } else {
      const res = await supabase.from('dpa_consultations').insert(payload)
      error = res.error
    }
    setSaving(false)
    if (error) {
      console.error('저장 오류:', error)
      alert(`저장 실패: ${error.message}`)
      return
    }
    closePopup()
    showToast(editId ? '일정이 수정됐어요 ✓' : '일정이 등록됐어요 ✓')
    await fetchAll()
  }

  async function deleteConsultation(id: string) {
    const ok = await confirm({ title: '일정 삭제', message: '이 상담 일정을 삭제할까요?', confirmText: '삭제' })
    if (!ok) return
    await supabase.from('dpa_consultations').delete().eq('id', id)
    showToast('일정이 삭제됐어요')
    await fetchAll()
  }

  async function saveNote(id: string) {
    await supabase.from('dpa_consultations').update({ notes: noteText }).eq('id', id)
    setEditNoteId(null)
    await fetchAll()
  }

  /* ─── Calendar helpers ─── */
  const calYear     = calMonth.getFullYear()
  const calMonthNum = calMonth.getMonth()
  const startDow    = new Date(calYear, calMonthNum, 1).getDay()
  const totalDays   = new Date(calYear, calMonthNum + 1, 0).getDate()

  const dateMap: Record<string, any[]> = {}
  consultations.forEach(c => {
    if (!dateMap[c.meeting_date]) dateMap[c.meeting_date] = []
    dateMap[c.meeting_date].push(c)
  })

  const calCells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) calCells.push(null)
  for (let d = 1; d <= totalDays; d++) calCells.push(d)
  while (calCells.length % 7 !== 0) calCells.push(null)

  function getDateStr(day: number) {
    return `${calYear}-${String(calMonthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  /* ─── Right panel data ─── */
  const todayConsults = consultations
    .filter(c => c.meeting_date === todayStr)
    .sort((a, b) => (a.meeting_time || '').localeCompare(b.meeting_time || ''))

  const { start: weekStart, end: weekEnd } = getWeekBounds()
  const weekConsults = consultations
    .filter(c => c.meeting_date >= weekStart && c.meeting_date <= weekEnd)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || (a.meeting_time || '').localeCompare(b.meeting_time || ''))

  const restOfWeekConsults = weekConsults.filter(c => c.meeting_date !== todayStr)

  const monthStr = `${calYear}-${String(calMonthNum + 1).padStart(2, '0')}`
  const restOfMonthConsults = consultations
    .filter(c => c.meeting_date.startsWith(monthStr) && !weekConsults.find(w => w.id === c.id))
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || (a.meeting_time || '').localeCompare(b.meeting_time || ''))

  /* ─── Popup data ─── */
  const selectedCust       = customers.find(c => c.id === form.customer_id)
  const selectedCustName   = selectedCust?.name || ''
  const filteredCusts      = customers.filter(c =>
    !custSearch || c.name.includes(custSearch) || (c.phone || '').includes(custSearch)
  )

  function getCustomerTimeline(customerId: string) {
    return [...consultations]
      .filter(c => c.customer_id === customerId)
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || (a.meeting_time || '').localeCompare(b.meeting_time || ''))
  }

  /* ─── Render ─── */
  return (
    <div className={styles.page}>
      {ConfirmDialog}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1A2E', color: '#fff', padding: '10px 22px',
          borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)', zIndex: 99999,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          animation: 'fadeInUp 0.18s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>상담 일정</h1>
        <p className={styles.pageSub}>고객 상담 일정을 관리하고 이력을 기록하세요</p>
      </div>

      <div className={styles.layout} ref={layoutRef}>

        {/* ════════ LEFT — Calendar ════════ */}
        <div className={styles.card}>

          {/* Calendar nav */}
          <div className={styles.calNav}>
            <div />
            <div className={styles.calNavGroup}>
              <button className={styles.calNavBtn} onClick={() => setCalMonth(new Date(calYear, calMonthNum - 1, 1))}>
                <ChevronLeft style={{ width: 15, height: 15 }} />
              </button>
              <span className={styles.calMonthLabel}>{calYear}년 {calMonthNum + 1}월</span>
              <button className={styles.calNavBtn} onClick={() => setCalMonth(new Date(calYear, calMonthNum + 1, 1))}>
                <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            </div>
            <button
              className={styles.calTodayBtn}
              onClick={() => { const t = new Date(); t.setDate(1); setCalMonth(t) }}
            >
              오늘
            </button>
          </div>

          {/* Legend — 클릭 필터 + 이번달 건수 */}
          {(() => {
            const monthStr = `${calYear}-${String(calMonthNum + 1).padStart(2, '0')}`
            const totalCnt = consultations.filter(c => c.meeting_date.startsWith(monthStr)).length
            return (
              <div className={styles.calLegend}>
                <button
                  className={[styles.calLegendItem, styles.calLegendBtn, !calTypeFilter ? styles.calLegendBtnActive : ''].join(' ')}
                  onClick={() => setCalTypeFilter(null)}
                >
                  <span className={styles.calLegendLabel} style={{ fontWeight: !calTypeFilter ? 700 : 400, color: !calTypeFilter ? '#5E6AD2' : undefined }}>전체</span>
                  {totalCnt > 0 && <span className={styles.calLegendCount} style={{ background: 'rgba(94,106,210,0.12)', color: '#5E6AD2' }}>{totalCnt}</span>}
                </button>
                {MEETING_TYPES.map(t => {
                  const cnt = consultations.filter(c => c.meeting_date.startsWith(monthStr) && c.meeting_type === t.value).length
                  const isActive = calTypeFilter === t.value
                  return (
                    <button
                      key={t.value}
                      className={[styles.calLegendItem, styles.calLegendBtn, isActive ? styles.calLegendBtnActive : ''].join(' ')}
                      style={{ opacity: cnt === 0 ? 0.35 : 1 }}
                      onClick={() => setCalTypeFilter(isActive ? null : t.value)}
                    >
                      <span className={styles.calLegendDot} style={{ background: t.color }} />
                      <span className={styles.calLegendLabel} style={{ color: isActive ? t.color : undefined, fontWeight: isActive ? 700 : 400 }}>{t.value}</span>
                      {cnt > 0 && <span className={styles.calLegendCount} style={{ background: t.color + '22', color: t.color }}>{cnt}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {/* Calendar grid */}
          <div className={styles.calGrid}>
            {DAYS_KR.map((d, i) => (
              <div key={d} className={styles.calDayHeader}
                style={{ color: i === 0 ? '#E24B4A' : i === 6 ? '#378ADD' : undefined }}>
                {d}
              </div>
            ))}

            {calCells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className={styles.calCell} />
              const dateStr     = getDateStr(day)
              const dayConsults = dateMap[dateStr] || []
              const displayConsults = calTypeFilter
                ? dayConsults.filter((c: any) => c.meeting_type === calTypeFilter)
                : dayConsults
              const isToday    = dateStr === todayStr
              const dow        = (startDow + day - 1) % 7
              const isSun = dow === 0, isSat = dow === 6

              return (
                <div
                  key={dateStr}
                  className={[styles.calCell, styles.calCellDay, isToday ? styles.calCellToday : ''].join(' ')}
                  onClick={() => openNewPopup(dateStr)}
                >
                  <span className={[styles.calDayNum, isSun ? styles.calDaySun : isSat ? styles.calDaySat : ''].join(' ')}>
                    {day}
                  </span>

                  {displayConsults.slice(0, 3).map((c: any) => {
                    const cust  = customers.find(cu => cu.id === c.customer_id)
                    const color = TYPE_COLOR[c.meeting_type] || 'hsl(237 47% 59%)'
                    return (
                      <div key={c.id} className={styles.calEvent}
                        style={{ '--ev-color': color } as any}
                        onClick={e => { e.stopPropagation(); openEditPopup(c) }}>
                        <span className={styles.calEventDot} />
                        <span className={styles.calEventName}>{cust?.name || '?'}</span>
                      </div>
                    )
                  })}
                  {displayConsults.length > 3 && (
                    <span className={styles.calEventMore}>+{displayConsults.length - 3}</span>
                  )}
                </div>
              )
            })}
          </div>

        </div>

        {/* ════════ RIGHT — Today + Week stacked ════════ */}
        <div className={styles.rightPanelCard}>

            <div className={styles.dashContent}>

              {/* ── 오늘 일정 ── */}
              <div className={[styles.dashSectionTitle, styles.dashSectionTitleToday].join(' ')}>
                오늘 일정
                {todayConsults.length > 0 && (
                  <span className={styles.countBadge}>{todayConsults.length}</span>
                )}
              </div>
              {todayConsults.length === 0 ? (
                <div className={styles.dashEmptyRow}>예정된 상담이 없어요</div>
              ) : (
                <div className={styles.dashList}>
                  {todayConsults.map((c: any) => {
                    const cust  = customers.find(cu => cu.id === c.customer_id)
                    const color = TYPE_COLOR[c.meeting_type] || 'hsl(237 47% 59%)'
                    return (
                      <div key={c.id} className={styles.dashItem} onClick={() => openEditPopup(c)}>
                        <span className={styles.dashDot} style={{ background: color }} />
                        <div className={styles.dashItemBody}>
                          <div className={styles.dashItemTop}>
                            <span className={styles.dashCustName}>{cust?.name || '?'}</span>
                            <span className={styles.typeBadge} style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                              {c.meeting_type}
                            </span>
                            <span className={[styles.statusChip, c.status === '완료' ? styles.statusDone : c.status === '취소' ? styles.statusCancel : c.status === '확정' ? styles.statusConfirmed : styles.statusScheduled].join(' ')}>
                              {c.status}
                            </span>
                          </div>
                          <div className={styles.dashItemMeta}>
                            {c.meeting_time && <><Clock style={{ width: 12, height: 12 }} />{c.meeting_time}</>}
                            {c.location && <><MapPin style={{ width: 12, height: 12 }} />{c.location}</>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── 섹션 구분선 ── */}
              <div className={styles.dashSectionDivider} />

              {/* ── 이번 주 일정 ── */}
              <div className={styles.dashSectionTitle}>
                이번 주 일정
                {restOfWeekConsults.length > 0 && (
                  <span className={styles.countBadge}>{restOfWeekConsults.length}</span>
                )}
              </div>
              {restOfWeekConsults.length === 0 ? (
                <div className={styles.dashEmptyRow}>이번 주 다른 일정이 없어요</div>
              ) : (
                <div className={styles.dashList}>
                  {(() => {
                    let lastDate = ''
                    return restOfWeekConsults.map((c: any) => {
                      const cust      = customers.find(cu => cu.id === c.customer_id)
                      const color     = TYPE_COLOR[c.meeting_type] || 'hsl(237 47% 59%)'
                      const showDate  = c.meeting_date !== lastDate
                      lastDate        = c.meeting_date
                      const dateLabel = new Date(c.meeting_date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' })
                      return (
                        <div key={c.id}>
                          {showDate && (
                            <div className={styles.weekDateHeader}>{dateLabel}</div>
                          )}
                          <div className={styles.dashItem} onClick={() => openEditPopup(c)}>
                            <span className={styles.dashDot} style={{ background: color }} />
                            <div className={styles.dashItemBody}>
                              <div className={styles.dashItemTop}>
                                <span className={styles.dashCustName}>{cust?.name || '?'}</span>
                                <span className={styles.typeBadge} style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                                  {c.meeting_type}
                                </span>
                                <span className={[styles.statusChip, c.status === '완료' ? styles.statusDone : c.status === '취소' ? styles.statusCancel : c.status === '확정' ? styles.statusConfirmed : styles.statusScheduled].join(' ')}>
                                  {c.status}
                                </span>
                              </div>
                              <div className={styles.dashItemMeta}>
                                {c.meeting_time && <><Clock style={{ width: 12, height: 12 }} />{c.meeting_time}</>}
                                {c.location && <><MapPin style={{ width: 12, height: 12 }} />{c.location}</>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}

              {/* ── 섹션 구분선 ── */}
              <div className={styles.dashSectionDivider} />

              {/* ── 이번 달 일정 ── */}
              <div className={styles.dashSectionTitle}>
                이번 달 일정
                {restOfMonthConsults.length > 0 && (
                  <span className={styles.countBadge}>{restOfMonthConsults.length}</span>
                )}
              </div>
              {restOfMonthConsults.length === 0 ? (
                <div className={styles.dashEmptyRow}>이번 달 다른 일정이 없어요</div>
              ) : (
                <div className={styles.dashList}>
                  {(() => {
                    let lastDate = ''
                    return restOfMonthConsults.map((c: any) => {
                      const cust      = customers.find(cu => cu.id === c.customer_id)
                      const color     = TYPE_COLOR[c.meeting_type] || 'hsl(237 47% 59%)'
                      const showDate  = c.meeting_date !== lastDate
                      lastDate        = c.meeting_date
                      const dateLabel = new Date(c.meeting_date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' })
                      return (
                        <div key={c.id}>
                          {showDate && (
                            <div className={styles.weekDateHeader}>{dateLabel}</div>
                          )}
                          <div className={styles.dashItem} onClick={() => openEditPopup(c)}>
                            <span className={styles.dashDot} style={{ background: color }} />
                            <div className={styles.dashItemBody}>
                              <div className={styles.dashItemTop}>
                                <span className={styles.dashCustName}>{cust?.name || c.customer_name || '?'}</span>
                                <span className={styles.typeBadge} style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                                  {c.meeting_type}
                                </span>
                                <span className={[styles.statusChip, c.status === '완료' ? styles.statusDone : c.status === '취소' ? styles.statusCancel : c.status === '확정' ? styles.statusConfirmed : styles.statusScheduled].join(' ')}>
                                  {c.status}
                                </span>
                              </div>
                              <div className={styles.dashItemMeta}>
                                {c.meeting_time && <><Clock style={{ width: 12, height: 12 }} />{c.meeting_time}</>}
                                {c.location && <><MapPin style={{ width: 12, height: 12 }} />{c.location}</>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}

            </div>
        </div>
      </div>

      {/* ════════ POPUP ════════ */}

      {popupStage > 0 && (
        <div className={styles.popupOverlay} onClick={closePopup}>
          <div
            ref={popupRef}
            className={[styles.popup, popupStage === 2 ? styles.popupStage2 : ''].join(' ')}
            style={{ position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >

            {/* ═══ 1열: 등록/수정 폼 ═══ */}
            <div className={styles.popupLeft}>
              <div className={styles.popupHeader}>
                <span className={styles.popupTitle}>{editId ? '일정 수정' : '일정 등록'}</span>
                <button className={styles.popupClose} onClick={closePopup} style={{ marginLeft: 'auto' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div className={styles.popupBody}>

                {/* 고객 선택 */}
                <div className={styles.formField}>
                  <label className={styles.label}>고객 선택 *</label>
                  <div className={styles.custSelectWrap} ref={dropRef}>
                    <input
                      className={styles.custInput}
                      placeholder="이름 또는 연락처 검색..."
                      value={custSearch || selectedCustName}
                      onChange={e => { setCustSearch(e.target.value); setForm(f => ({ ...f, customer_id: '' })); setShowCustDrop(true); setCustActiveIdx(-1) }}
                      onFocus={() => { setShowCustDrop(true); setCustActiveIdx(-1) }}
                      onKeyDown={e => {
                        if (!showCustDrop || filteredCusts.length === 0) return
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          const next = Math.min(custActiveIdx + 1, filteredCusts.length - 1)
                          setCustActiveIdx(next)
                          dropListRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          const prev = Math.max(custActiveIdx - 1, 0)
                          setCustActiveIdx(prev)
                          dropListRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' })
                        } else if (e.key === 'Enter' && custActiveIdx >= 0) {
                          e.preventDefault()
                          const c = filteredCusts[custActiveIdx]
                          setForm(f => ({ ...f, customer_id: c.id }))
                          setCustSearch(c.name); setShowCustDrop(false); setCustActiveIdx(-1)
                        } else if (e.key === 'Escape') {
                          setShowCustDrop(false); setCustActiveIdx(-1)
                        }
                      }}
                    />
                    {showCustDrop && filteredCusts.length > 0 && (
                      <div className={styles.custDropdown} ref={dropListRef}>
                        {filteredCusts.map((c, i) => (
                          <div key={c.id}
                            className={[styles.custOption, i === custActiveIdx ? styles.custOptionActive : ''].join(' ')}
                            onMouseEnter={() => setCustActiveIdx(i)}
                            onClick={() => {
                              setForm(f => ({ ...f, customer_id: c.id }))
                              setCustSearch(c.name); setShowCustDrop(false); setCustActiveIdx(-1)
                            }}>
                            <span className={styles.custOptionName}>{c.name}</span>
                            <span className={styles.custOptionMeta}>{c.customer_type === 'prospect' ? '관심' : '일반'} · {c.phone || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 날짜 */}
                <div className={styles.formField}>
                  <label className={styles.label}>날짜 *</label>
                  <div className={styles.timePicker}>
                    {(() => {
                      const [dY, dM, dD] = form.meeting_date ? form.meeting_date.split('-') : ['2026', '01', '01']
                      const curYear = new Date().getFullYear()
                      return <>
                        <select className={styles.timeSelect} style={{ flex: '1.7' }} value={dY}
                          onChange={e => {
                            const newY = e.target.value
                            const max = new Date(parseInt(newY), parseInt(dM), 0).getDate()
                            const clamp = String(Math.min(parseInt(dD), max)).padStart(2, '0')
                            setForm(f => ({ ...f, meeting_date: `${newY}-${dM}-${clamp}` }))
                          }}>
                          {[curYear - 1, curYear, curYear + 1, curYear + 2].map(y => (
                            <option key={y} value={String(y)}>{y}년</option>
                          ))}
                        </select>
                        <select className={styles.timeSelect} value={dM}
                          onChange={e => {
                            const newM = e.target.value
                            const max = new Date(parseInt(dY), parseInt(newM), 0).getDate()
                            const clamp = String(Math.min(parseInt(dD), max)).padStart(2, '0')
                            setForm(f => ({ ...f, meeting_date: `${dY}-${newM}-${clamp}` }))
                          }}>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                            <option key={m} value={m}>{parseInt(m)}월</option>
                          ))}
                        </select>
                        <select className={styles.timeSelect} value={dD}
                          onChange={e => setForm(f => ({ ...f, meeting_date: `${dY}-${dM}-${e.target.value}` }))}>
                          {Array.from({ length: new Date(parseInt(dY), parseInt(dM), 0).getDate() }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                            <option key={d} value={d}>{parseInt(d)}일</option>
                          ))}
                        </select>
                      </>
                    })()}
                  </div>
                </div>

                {/* 시간 / 장소 */}
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.label}>시간</label>
                    <div className={styles.timePicker}>
                      <select className={styles.timeSelect}
                        value={form.meeting_time ? form.meeting_time.split(':')[0] : ''}
                        onChange={e => {
                          const min = form.meeting_time ? form.meeting_time.split(':')[1] : '00'
                          setForm(f => ({ ...f, meeting_time: e.target.value ? `${e.target.value}:${min}` : '' }))
                        }}>
                        <option value="">시간</option>
                        {Array.from({ length: 24 }, (_, i) => i).map(h => {
                          const hh = String(h).padStart(2, '0')
                          return <option key={hh} value={hh}>{hh}</option>
                        })}
                      </select>
                      <span className={styles.timeColon}>:</span>
                      <select className={styles.timeSelect}
                        value={form.meeting_time ? form.meeting_time.split(':')[1] : ''}
                        onChange={e => {
                          const hour = form.meeting_time ? form.meeting_time.split(':')[0] : '00'
                          setForm(f => ({ ...f, meeting_time: `${hour}:${e.target.value}` }))
                        }}>
                        <option value="">분</option>
                        {['00', '10', '20', '30', '40', '50'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.label}>장소</label>
                    <input type="text" className={styles.input} placeholder="카페, 사무실, 자택..."
                      value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                </div>

                {/* 상담 유형 */}
                <div className={styles.formField}>
                  <label className={styles.label}>상담 유형 *</label>
                  <select className={styles.input} value={form.meeting_type}
                    onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))}>
                    {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                </div>

                {/* 상태 */}
                <div className={styles.formField}>
                  <label className={styles.label}>상태</label>
                  <div className={styles.statusGroup}>
                    {STATUS_OPTIONS.map(s => (
                      <button key={s}
                        className={[styles.statusBtn, form.status === s ? styles.statusBtnActive : ''].join(' ')}
                        onClick={() => setForm(f => ({ ...f, status: s }))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 이번 미팅 메모 */}
                <div className={styles.formField} style={{ flex: 1, minHeight: 0 }}>
                  <label className={styles.label}>이번 미팅 메모</label>
                  <textarea
                    className={styles.textarea}
                    style={{ flex: 1, resize: 'none', minHeight: 80 }}
                    placeholder="상담 내용, 고객 반응, 다음 액션 등 자유롭게 기록하세요..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

              </div>

              {/* 액션 버튼 */}
              <div className={styles.popupActions}>
                {editId && (
                  <button className={styles.deleteBtn} onClick={() => { deleteConsultation(editId); closePopup() }}>
                    삭제
                  </button>
                )}
                <button className={styles.saveBtn} onClick={saveConsultation} disabled={saving}>
                  {saving ? '저장 중...' : editId ? '수정 완료' : '저장'}
                </button>
                <button className={styles.cancelBtn} onClick={closePopup}>취소</button>
              </div>
            </div>

            {/* ═══ 2열: 보장내역 / 상담이력 ═══ */}
            <div className={styles.popupRight}>
              <div className={styles.popupRightTabs}>
                <button
                  className={[styles.popupRightTab, popupRightTab === 'coverage' ? styles.popupRightTabActive : ''].join(' ')}
                  onClick={() => { setPopupRightTab('coverage'); setPopupStage(1) }}>보장 내역</button>
                <button
                  className={[styles.popupRightTab, popupRightTab === 'history' ? styles.popupRightTabActive : ''].join(' ')}
                  onClick={() => { setPopupRightTab('history'); setPopupStage(1) }}>상담 이력</button>
                <button
                  className={[styles.popupRightTab, popupRightTab === 'report' ? styles.popupRightTabActive : ''].join(' ')}
                  onClick={async () => {
                    setPopupRightTab('report'); setPopupStage(2)
                    const custId = form.customer_id
                    if (!custId) return
                    setReportFetching(true)
                    setSavedReport(null)
                    const { data } = await supabase
                      .from('dpa_reports')
                      .select('*')
                      .eq('customer_id', custId)
                      .order('updated_at', { ascending: false })
                      .limit(1)
                      .single()
                    setSavedReport(data || null)
                    setReportFetching(false)
                  }}>고객 리포트</button>
              </div>

              <div className={styles.popupRightBody}>

                {/* 보장 내역 */}
                {popupRightTab === 'coverage' && (
                  !selectedCust ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>👤</div>
                      <p className={styles.emptyText}>고객을 선택하면<br />보장 내역이 표시됩니다</p>
                    </div>
                  ) : coverageLoading ? (
                    <div className={styles.emptyState}>
                      <p className={styles.emptyText}>불러오는 중...</p>
                    </div>
                  ) : (
                    <div className={styles.coverageWrap}>
                      <div className={styles.coverageCustCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                          <span className={[styles.custTypeTag, selectedCust.customer_type === 'prospect' ? styles.custTypeTagProspect : styles.custTypeTagMy].join(' ')}>
                            {selectedCust.customer_type === 'prospect' ? '관심' : '마이'}
                          </span>
                          <span className={styles.coverageCustName} style={{ marginBottom: 0 }}>{selectedCust.name}</span>
                          {selectedCust.grade === 'VIP' && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'hsl(45 90% 92%)', color: 'hsl(45 70% 30%)' }}>VIP</span>
                          )}
                        </div>
                        <div className={styles.coverageCustMeta}>
                          {selectedCust.phone && <span>{selectedCust.phone}</span>}
                          {selectedCust.email && <span>{selectedCust.email}</span>}
                        </div>
                        {selectedCust.memo && <p className={styles.coverageMemo}>{selectedCust.memo}</p>}
                        <div className={styles.custInfoGrid}>
                          <div className={[styles.custInfoCell, styles.custInfoCellL].join(' ')}>
                            <span className={styles.custInfoLabel}>연락처</span>
                            <span className={styles.custInfoValue}>{selectedCust.phone || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellR].join(' ')}>
                            <span className={styles.custInfoLabel}>나이</span>
                            <span className={styles.custInfoValue}>
                              {selectedCust.age || (selectedCust.birth_date ? new Date().getFullYear() - new Date(selectedCust.birth_date).getFullYear() : null)
                                ? `${selectedCust.age || (new Date().getFullYear() - new Date(selectedCust.birth_date).getFullYear())}세`
                                : <span className={styles.custInfoEmpty}>-</span>}
                            </span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellL].join(' ')}>
                            <span className={styles.custInfoLabel}>성별</span>
                            <span className={styles.custInfoValue}>{selectedCust.gender || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellR].join(' ')}>
                            <span className={styles.custInfoLabel}>직업</span>
                            <span className={styles.custInfoValue}>{selectedCust.job || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellL].join(' ')}>
                            <span className={styles.custInfoLabel}>직장/소속</span>
                            <span className={styles.custInfoValue}>{selectedCust.workplace || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellR].join(' ')}>
                            <span className={styles.custInfoLabel}>운전면허</span>
                            <span className={styles.custInfoValue}>{selectedCust.driver_license || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={styles.custInfoCellFull}>
                            <span className={styles.custInfoLabel}>주소</span>
                            <span className={styles.custInfoValue}>{selectedCust.address || <span className={styles.custInfoEmpty}>-</span>}</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellL].join(' ')}>
                            <span className={styles.custInfoLabel}>계약 수</span>
                            <span className={styles.custInfoValue}>{popupContracts.length}건</span>
                          </div>
                          <div className={[styles.custInfoCell, styles.custInfoCellR].join(' ')}>
                            <span className={styles.custInfoLabel}>총 월납입</span>
                            <span className={[styles.custInfoValue, styles.custInfoGreen].join(' ')}>
                              {popupContracts.reduce((s, ct) => s + (ct.monthly_fee || 0), 0).toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>

                      {popupContracts.length === 0 && (
                        <div className={styles.coveragePlaceholder}>
                          <span className={styles.coveragePlaceholderIcon}>📋</span>
                          <p>등록된 보험 계약이 없어요</p>
                        </div>
                      )}

                      {popupContracts.map((ct, idx) => {
                        const cvs = popupCoverages.filter(cv => cv.contract_id === ct.id)
                        const groups = COVERAGE_GROUPS
                          .map(g => ({ ...g, items: cvs.filter((cv: any) => cv.category === g.key).sort((a: any, b: any) => a.coverage_name.localeCompare(b.coverage_name, 'ko', { numeric: true })) }))
                          .filter(g => g.items.length > 0)
                        const rate = calcPaymentRate(ct)
                        const isWarn = rate >= 90 && ct.payment_status !== '완납'
                        const isExpanded = expandedContractIds.includes(ct.id)
                        return (
                          <div key={ct.id} className={isWarn ? styles.insCardWarn : styles.insCard}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpandedContractIds(prev => isExpanded ? prev.filter(id => id !== ct.id) : [...prev, ct.id])}
                          >
                            <div className={styles.insCardHeader}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className={styles.insCardTitle}>{idx + 1}. {ct.company}{ct.product_name ? ` · ${ct.product_name}` : ''}</div>
                                {groups.length > 0 && (
                                  <span style={{ fontSize: 16, color: '#8892A0', marginLeft: 'auto', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', lineHeight: 1 }}>▾</span>
                                )}
                              </div>
                              <div className={styles.insCardBottomRow}>
                                <div className={styles.insCardMeta}>
                                  {[ct.monthly_fee > 0 ? `${ct.monthly_fee.toLocaleString()}원/월` : '',
                                    ct.contract_start ? `${ct.contract_start} 가입` : '',
                                    ct.payment_years || '',
                                    ct.expiry_age ? `${ct.expiry_age}만기` : ''
                                  ].filter(Boolean).map((s, i) => <span key={i}>· {s} </span>)}
                                </div>
                                <div className={styles.insCardBadges}>
                                  <span className={[styles.badge, ct.payment_status === '완납' ? styles.badgeGreen : isWarn ? styles.badgeWarn : styles.badgeBlue].join(' ')}>
                                    {ct.payment_status === '완납' ? '완납' : `${rate}%`}
                                  </span>
                                  {ct.insurance_type && <span className={styles.insTypeBadge}>{ct.insurance_type}</span>}
                                </div>
                              </div>
                            </div>
                            {isExpanded && (
                              groups.length > 0 ? (
                                <div className={styles.coverageList}>
                                  {groups.map(g => (
                                    <div key={g.key} className={styles.coverageRow}>
                                      <span className={styles.covIcon}>{g.icon}</span>
                                      <div className={styles.covRight}>
                                        <span className={styles.covLabel}>{g.label}</span>
                                        <div className={styles.covItems}>
                                          {g.items.map((cv: any, ci: number) => (
                                            <span key={ci} className={styles.covItem}>• {cv.coverage_name}{cv.amount ? <> <strong>{fmtAmount(cv.amount)}</strong></> : ''}</span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ padding: '10px 12px', fontSize: 12, color: '#8892A0' }}>등록된 보장 내역이 없어요</div>
                              )
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                {/* 상담 이력 */}
                {popupRightTab === 'history' && (
                  !form.customer_id ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📋</div>
                      <p className={styles.emptyText}>고객을 선택하면<br />상담 이력이 표시됩니다</p>
                    </div>
                  ) : (
                    <div className={styles.timeline}>
                      {getCustomerTimeline(form.customer_id).map((t: any, idx: number) => {
                        const tColor    = TYPE_COLOR[t.meeting_type] || 'hsl(237 47% 59%)'
                        const isDone    = t.status === '완료'
                        const isCancel  = t.status === '취소'
                        const isCurrent = editId ? t.id === editId : t.meeting_date === form.meeting_date
                        const isLast    = idx === getCustomerTimeline(form.customer_id).length - 1
                        const matchReport = MOCK_REPORTS.find(r => r.meeting_type === t.meeting_type)
                        const isRepSelected = popupStage === 2 && matchReport && selectedReportId === matchReport.id
                        return (
                          <div
                            key={t.id}
                            ref={matchReport ? (el => { tlItemRefs.current[matchReport.id] = el }) : undefined}
                            className={[
                              styles.tlItem,
                              popupStage === 2 && matchReport ? styles.tlItemClickable : '',
                              isRepSelected ? styles.tlItemSelected : '',
                            ].join(' ')}
                            onClick={popupStage === 2 && matchReport ? () => setSelectedReportId(matchReport.id === selectedReportId ? null : matchReport.id) : undefined}
                          >
                            <div className={styles.tlLeft}>
                              <div className={styles.tlDot} style={{
                                background: isDone ? tColor : isCancel ? '#EFEFF1' : isCurrent ? tColor + '22' : 'transparent',
                                border: `2px solid ${isDone ? tColor : isCancel ? '#D5DAE2' : isCurrent ? tColor : '#C0C7D1'}`,
                                boxShadow: isCurrent ? `0 0 0 3px ${tColor}30` : 'none',
                              }}>
                                {isDone && <Check style={{ width: 9, height: 9, color: '#fff' }} />}
                              </div>
                              {!isLast && <div className={styles.tlLine} />}
                            </div>

                            <div className={styles.tlContent}>
                              <div className={styles.tlHeader}>
                                <span className={styles.tlType}
                                  style={{ color: isCancel ? '#8892A0' : isDone || isCurrent ? tColor : '#1A1A2E' }}>
                                  {t.meeting_type}
                                </span>
                                {isCurrent && (
                                  <span className={styles.tlCurrentBadge}
                                    style={{ background: tColor + '20', color: tColor, border: `1px solid ${tColor}40` }}>
                                    현재
                                  </span>
                                )}
                                {matchReport && popupStage === 2 && (
                                  <span style={{ fontSize: 10, color: '#5E6AD2', marginLeft: 2, opacity: 0.65 }}>리포트</span>
                                )}
                                <span className={styles.tlStatus}>{t.status}</span>
                                <button className={styles.tlEditBtn} onClick={e => { e.stopPropagation(); setEditNoteId(t.id); setNoteText(t.notes || '') }}>
                                  <Edit2 style={{ width: 10, height: 10 }} />
                                </button>
                              </div>

                              <div className={styles.tlMeta}>
                                {t.meeting_date}{t.meeting_time && ` · ${t.meeting_time}`}{t.location && ` · ${t.location}`}
                              </div>

                              {/* 메모 한 줄 미리보기 */}
                              {t.notes && editNoteId !== t.id && (
                                <p className={styles.tlNote} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: 0.7 }}>
                                  {t.notes}
                                </p>
                              )}

                              {editNoteId === t.id ? (
                                <div className={styles.tlNoteEdit}>
                                  <textarea className={styles.tlNoteTextarea} rows={3}
                                    value={noteText} onChange={e => setNoteText(e.target.value)}
                                    placeholder="상담 내용을 입력하세요..." autoFocus />
                                  <div className={styles.tlNoteActions}>
                                    <button className={styles.tlNoteSave} onClick={() => saveNote(t.id)}>저장</button>
                                    <button className={styles.tlNoteCancel} onClick={() => setEditNoteId(null)}>취소</button>
                                  </div>
                                </div>
                              ) : !t.notes ? (
                                <button className={styles.tlNoteAdd} onClick={e => { e.stopPropagation(); setEditNoteId(t.id); setNoteText('') }}>
                                  + 메모 추가
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                {/* 고객 리포트 */}
                {popupRightTab === 'report' && (
                  !selectedCust ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📊</div>
                      <p className={styles.emptyText}>고객을 선택하면<br />리포트가 표시됩니다</p>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📊</div>
                      <p className={styles.emptyText}>준비 중입니다</p>
                    </div>
                  )
                )}

              </div>
            </div>

            {/* ═══ 3열: 고객 리포트 패널 ═══ */}
            <div className={styles.reportPanel}>
              <div className={styles.reportPanelHeader}>
                <span className={styles.reportPanelTitle}>고객 리포트</span>
                {selectedCust && <span className={styles.reportPanelMeta}>{selectedCust.name}</span>}
              </div>
              <div className={styles.reportPanelBody}>
                {!selectedCust ? (
                  <div className={styles.reportPanelEmpty}>
                    <p>고객을 선택하면<br />리포트가 표시됩니다</p>
                  </div>
                ) : reportFetching ? (
                  <div className={styles.reportPanelEmpty}>
                    <p style={{ color: '#8892A0' }}>리포트 불러오는 중...</p>
                  </div>
                ) : !savedReport ? (
                  <div className={styles.reportPanelEmpty}>
                    <p>저장된 리포트가 없어요</p>
                    <p style={{ fontSize: 11, color: '#8892A0', marginTop: 6 }}>
                      리포트 페이지에서 AI 분석 후<br />저장하면 여기에 표시됩니다
                    </p>
                    <a href="/report" target="_blank" style={{ marginTop: 12, display: 'inline-block', fontSize: 12, color: '#5E6AD2', textDecoration: 'underline' }}>
                      리포트 페이지 열기 →
                    </a>
                  </div>
                ) : (
                  <div>
                    {/* 저장 시각 + 리포트 링크 */}
                    <div style={{ fontSize: 11, color: '#8892A0', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{new Date(savedReport.updated_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 저장</span>
                      <a href="/report" target="_blank" style={{ fontSize: 12, color: '#5E6AD2', textDecoration: 'underline' }}>전체 편집 →</a>
                    </div>
                    {/* 그래프 포함 전체 리포트 미리보기 */}
                    <ReportPreviewDoc
                      data={savedReport.report_data}
                      editContent={savedReport.edit_content || {}}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── SVG 도트라인 커넥터 (2열↔3열) ── */}
            {popupStage === 2 && popupRightTab === 'history' && connLines.length > 0 && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 10 }}>
                {connLines.map(line => {
                  const isSelected = line.id === selectedReportId
                  const midX = line.x1 + (line.x2 - line.x1) * 0.52
                  return (
                    <g key={line.id}>
                      <path
                        d={`M ${line.x1} ${line.y1} H ${midX} V ${line.y2} H ${line.x2}`}
                        stroke="#5E6AD2"
                        strokeWidth={isSelected ? 2.5 : 1.2}
                        strokeDasharray="4 8"
                        strokeLinecap="round"
                        fill="none"
                        opacity={isSelected ? 0.9 : 0.28}
                        style={{ transition: 'opacity 0.2s ease, stroke-width 0.2s ease' }}
                      />
                      <circle cx={line.x1} cy={line.y1} r={isSelected ? 4 : 2.5}
                        fill="#5E6AD2" opacity={isSelected ? 0.9 : 0.28} />
                      <circle cx={line.x2} cy={line.y2} r={isSelected ? 5 : 3}
                        fill="#5E6AD2" opacity={isSelected ? 0.9 : 0.28} />
                    </g>
                  )
                })}
              </svg>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

Consultations.getLayout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>
