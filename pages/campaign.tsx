import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import InsuranceCompanySelect from '../components/InsuranceCompanySelect'

// ── 타입 ──────────────────────────────────────────
interface Customer {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  gender: string | null
  customer_type: string
  age?: number
}

interface Campaign {
  id: string
  name: string
  target_filters: any
  message: string
  send_method: string
  status: string
  total_targets: number
  sent_count: number
  failed_count: number
  sent_at: string | null
  created_at: string
}

interface TargetFilter {
  age_min: string
  age_max: string
  gender: string        // '' | '남' | '여'
  customer_type: string // '' | 'existing' | 'prospect'
  has_gap: boolean
  near_deadline: boolean
}

const DEFAULT_FILTER: TargetFilter = {
  age_min: '', age_max: '', gender: '', customer_type: '',
  has_gap: false, near_deadline: false,
}

interface Promotion {
  id: string
  created_by: string
  company: string
  product_name: string
  valid_from: string | null
  valid_to: string | null
  details: string
  ai_analysis: string | null
  target_filters: any
  message_template: string | null
  is_active: boolean
  created_at: string
}

interface PromoForm {
  company: string
  product_name: string
  valid_from: string
  valid_to: string
  details: string
}

const DEFAULT_PROMO_FORM: PromoForm = {
  company: '', product_name: '', valid_from: '', valid_to: '', details: '',
}

// ── 유틸 ─────────────────────────────────────────
function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function fmtDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}

const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장', sent: '발송완료', scheduled: '예약됨',
}

// ── 커스텀 DatePicker ─────────────────────────────
const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useState(() => ({ current: null as HTMLDivElement | null }))[0]

  const today = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth())

  // 달력 닫기 (외부 클릭)
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function getDays() {
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const last = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(first).fill(null)
    for (let i = 1; i <= last; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function select(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  const displayVal = parsed
    ? `${parsed.getFullYear()}. ${String(parsed.getMonth()+1).padStart(2,'0')}. ${String(parsed.getDate()).padStart(2,'0')}`
    : ''

  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  const isSelected = (d: number) => parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === d

  return (
    <div ref={el => { ref.current = el }} style={{ position:'relative' }}>
      {/* 인풋 필드 */}
      <div
        onClick={() => { setOpen(v => !v); if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) } }}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 10px', border:'1px solid #E5E7EB', borderRadius:6,
          background:'#F7F8FA', cursor:'pointer', fontSize:13,
          color: displayVal ? '#1A1A2E' : '#8892A0',
          userSelect:'none',
        }}
      >
        <span>{displayVal || placeholder || '날짜 선택'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8892A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {/* 달력 팝오버 */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:999,
          background:'#fff', border:'1px solid #E5E7EB', borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding:14, width:240,
        }}>
          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#636B78', fontSize:16, lineHeight:1, padding:'2px 6px' }}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{viewYear}년 {MONTHS[viewMonth]}</span>
            <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#636B78', fontSize:16, lineHeight:1, padding:'2px 6px' }}>›</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ textAlign:'center', fontSize:11, fontWeight:600, color: i===0 ? '#EF4444' : i===6 ? '#5E6AD2' : '#8892A0', padding:'3px 0' }}>{w}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1 }}>
            {getDays().map((d, i) => (
              <button key={i} disabled={!d}
                onClick={() => d && select(d)}
                style={{
                  textAlign:'center', fontSize:12, padding:'5px 0',
                  border:'none', borderRadius:6, cursor: d ? 'pointer' : 'default',
                  background: d && isSelected(d) ? '#5E6AD2' : d && isToday(d) ? 'rgba(94,106,210,0.08)' : 'transparent',
                  color: !d ? 'transparent' : isSelected(d) ? '#fff' : i % 7 === 0 ? '#EF4444' : i % 7 === 6 ? '#5E6AD2' : '#1A1A2E',
                  fontWeight: d && (isSelected(d) || isToday(d)) ? 700 : 400,
                }}
              >{d || ''}</button>
            ))}
          </div>

          {/* 오늘 버튼 */}
          <div style={{ marginTop:8, borderTop:'1px solid #F3F4F6', paddingTop:8, textAlign:'center' }}>
            <button onClick={() => { const t = new Date(); select(t.getDate()); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()) }}
              style={{ fontSize:11, color:'#5E6AD2', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              오늘
            </button>
            {value && (
              <button onClick={() => { onChange(''); setOpen(false) }}
                style={{ fontSize:11, color:'#8892A0', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', marginLeft:12 }}>
                지우기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#8892A0', sent: '#1D9E75', scheduled: '#5E6AD2',
}

// ── 메인 컴포넌트 ────────────────────────────────
export default function CampaignPage() {
  const router = useRouter()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [planType, setPlanType] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // 탭: 'new' | 'history' | 'promo'
  const [tab, setTab] = useState<'new' | 'history' | 'promo'>('new')

  // 필터
  const [filter, setFilter] = useState<TargetFilter>(DEFAULT_FILTER)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [matched, setMatched] = useState<Customer[]>([])

  // 메시지
  const [campaignName, setCampaignName] = useState('')
  const [message, setMessage] = useState('')
  const [sendMethod, setSendMethod] = useState<'sms' | 'kakao'>('sms')
  const [aiLoading, setAiLoading] = useState(false)

  // 발송 상태
  const [sending, setSending] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // 이력
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [campaignSends, setCampaignSends] = useState<Record<string, any[]>>({})
  const [sendsLoading, setSendsLoading] = useState<Set<string>>(new Set())
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({})

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }
  async function toggleItem(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // 처음 펼칠 때만 sends 로드
    if (!expandedItems.has(id) && !campaignSends[id]) {
      setSendsLoading(prev => new Set(prev).add(id))
      const { data } = await supabase
        .from('dpa_campaign_sends')
        .select('id, customer_name, phone, send_status, sent_at')
        .eq('campaign_id', id)
        .order('customer_name', { ascending: true })
      setCampaignSends(prev => ({ ...prev, [id]: data || [] }))
      setSendsLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  // 긴급 특약
  const [promoForm, setPromoForm] = useState<PromoForm>(DEFAULT_PROMO_FORM)
  const [promoDragOver, setPromoDragOver] = useState(false)
  const [promoImageExtracting, setPromoImageExtracting] = useState(false)
  const [promoAnalyzing, setPromoAnalyzing] = useState(false)
  const [promoAnalysis, setPromoAnalysis] = useState('')
  const [promoFilter, setPromoFilter] = useState<TargetFilter>(DEFAULT_FILTER)
  const [promoMessage, setPromoMessage] = useState('')
  const [promoMatched, setPromoMatched] = useState<Customer[]>([])
  const [promoSendMethod, setPromoSendMethod] = useState<'sms' | 'kakao'>('kakao')
  const [promoSending, setPromoSending] = useState(false)
  const [promos, setPromos] = useState<Promotion[]>([])
  const [promosLoading, setPromosLoading] = useState(false)
  const [promoSaveMsg, setPromoSaveMsg] = useState('')

  // ── 초기 로드 ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: agent } = await supabase
        .from('dpa_agents').select('id, plan_type, settings')
        .eq('user_id', user.id).single()
      if (!agent) { router.replace('/'); return }
      setAgentId(agent.id)
      const plan = agent.settings?.plan || agent.plan_type || 'basic'
      setPlanType(plan)
      // 고객 목록 로드
      const { data: custs } = await supabase
        .from('dpa_customers')
        .select('id, name, phone, birth_date, gender, customer_type')
        .eq('agent_id', agent.id)
        .not('phone', 'is', null)
      const list = (custs || []).map((c: any) => ({
        ...c,
        age: c.birth_date ? calcAge(c.birth_date) : null,
      }))
      setAllCustomers(list)
      setMatched(list)
      setLoading(false)
    }
    init()
  }, [])

  // ── 필터 적용 ─────────────────────────────────
  useEffect(() => {
    let result = [...allCustomers]
    if (filter.age_min) result = result.filter(c => c.age != null && c.age >= Number(filter.age_min))
    if (filter.age_max) result = result.filter(c => c.age != null && c.age <= Number(filter.age_max))
    if (filter.gender) result = result.filter(c => c.gender === filter.gender)
    if (filter.customer_type) result = result.filter(c => c.customer_type === filter.customer_type)
    // 보장공백/완납임박은 계약 데이터 필요 → 추후 구현, 현재는 전체 표시
    setMatched(result)
  }, [filter, allCustomers])

  // ── AI 멘트 생성 ──────────────────────────────
  async function generateAiMessage() {
    if (matched.length === 0) return
    setAiLoading(true)
    try {
      const ageMin = filter.age_min || '전체'
      const ageMax = filter.age_max || '전체'
      const gender = filter.gender || '전체'
      const prompt = `보험 설계사가 고객에게 보낼 문자 메시지를 작성해주세요.
타겟: ${gender === '전체' ? '' : gender + '성 '}${ageMin === '전체' ? '' : ageMin + '~' + ageMax + '세'}
목적: 고객이 먼저 연락하고 싶게 만드는 자연스러운 보험 상품 안내
조건:
- 100자 이내
- 딱딱하지 않고 친근하게
- 구체적인 혜택 언급 (예: 신생아보험, 생명보험, 실손보험 등 연령대에 맞게)
- 상담 유도 문구 포함
- 이름은 [고객명] 으로 표시
메시지만 출력해주세요.`
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (data.content) setMessage(data.content)
    } catch (e) {
      console.error(e)
    }
    setAiLoading(false)
  }

  // ── 이력 로드 ────────────────────────────────
  async function loadHistory() {
    if (!agentId) return
    setHistLoading(true)
    const { data } = await supabase
      .from('dpa_campaigns')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
    const list = data || []
    setCampaigns(list)
    // 가장 최근 날짜 자동 펼침
    if (list.length > 0) {
      const latestDate = fmtDate(list[0].created_at)
      setExpandedDates(new Set([latestDate]))
    }
    setHistLoading(false)
  }

  useEffect(() => {
    if (tab === 'history' && agentId) loadHistory()
    if (tab === 'promo' && agentId) loadPromos()
  }, [tab, agentId])

  // 긴급 특약 — 필터 적용
  useEffect(() => {
    let result = [...allCustomers]
    if (promoFilter.age_min) result = result.filter(c => c.age != null && c.age >= Number(promoFilter.age_min))
    if (promoFilter.age_max) result = result.filter(c => c.age != null && c.age <= Number(promoFilter.age_max))
    if (promoFilter.gender) result = result.filter(c => c.gender === promoFilter.gender)
    if (promoFilter.customer_type) result = result.filter(c => c.customer_type === promoFilter.customer_type)
    setPromoMatched(result)
  }, [promoFilter, allCustomers])

  // ── 임시저장 ─────────────────────────────────
  async function saveDraft() {
    if (!agentId || !campaignName.trim()) { setSaveMsg('캠페인 이름을 입력해주세요'); return }
    const { error } = await supabase.from('dpa_campaigns').insert({
      agent_id: agentId,
      name: campaignName,
      target_filters: filter,
      message,
      send_method: sendMethod,
      status: 'draft',
      total_targets: matched.length,
    })
    if (!error) { setSaveMsg('임시저장 완료!'); setTimeout(() => setSaveMsg(''), 2000) }
  }

  // ── 발송 ─────────────────────────────────────
  async function handleSend() {
    if (!agentId) return
    if (!campaignName.trim()) { alert('캠페인 이름을 입력해주세요'); return }
    if (!message.trim()) { alert('메시지를 작성해주세요'); return }
    if (matched.length === 0) { alert('발송 대상 고객이 없어요'); return }
    const noPhone = matched.filter(c => !c.phone)
    if (noPhone.length > 0) {
      alert(`전화번호 없는 고객 ${noPhone.length}명은 제외됩니다`)
    }
    const targets = matched.filter(c => c.phone)
    if (!confirm(`${targets.length}명에게 메시지를 발송할까요?`)) return
    setSending(true)
    // 캠페인 레코드 생성
    const { data: camp, error: campErr } = await supabase
      .from('dpa_campaigns').insert({
        agent_id: agentId,
        name: campaignName,
        target_filters: filter,
        message,
        send_method: sendMethod,
        status: 'sent',
        total_targets: targets.length,
        sent_at: new Date().toISOString(),
      }).select().single()
    if (campErr || !camp) { alert('캠페인 생성 실패'); setSending(false); return }

    // 발송 이력 저장 + 실제 발송 (SMS API 연동 필요)
    const sends = targets.map(c => ({
      campaign_id: camp.id,
      customer_id: c.id,
      customer_name: c.name,
      phone: c.phone!,
      message: message.replace(/\[고객명\]/g, c.name),
      send_status: 'pending',
    }))
    await supabase.from('dpa_campaign_sends').insert(sends)

    // TODO: 실제 SMS/카톡 발송 API 호출
    // await fetch('/api/send-campaign', { method: 'POST', body: JSON.stringify({ campaignId: camp.id }) })

    setSending(false)
    alert(`${targets.length}명에게 발송 요청이 완료됐어요!\n(SMS API 연동 후 실제 발송됩니다)`)
    setTab('history')
    loadHistory()
  }

  // ── 긴급 특약 — 이력 로드 ────────────────────
  async function loadPromos() {
    if (!agentId) return
    setPromosLoading(true)
    const { data } = await supabase
      .from('dpa_promotions')
      .select('*')
      .eq('created_by', agentId)
      .order('created_at', { ascending: false })
    setPromos(data || [])
    setPromosLoading(false)
  }

  // ── 긴급 특약 — 이미지에서 텍스트 추출 ─────────
  async function extractFromImage(file: File) {
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 지원해요 (JPG, PNG, GIF, WEBP)'); return }
    setPromoImageExtracting(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '이 이미지에서 보험 특약/상품 관련 내용을 모두 추출해주세요. 보험사명, 상품명, 특약 내용, 유효기간, 대상, 혜택 등을 포함해서 텍스트로만 정리해주세요. 없는 내용은 생략하세요.',
          image: { base64, mediaType },
        }),
      })
      const data = await res.json()
      if (data.content) {
        setPromoForm(prev => ({
          ...prev,
          details: prev.details ? prev.details + '\n\n' + data.content : data.content,
        }))
      }
    } catch (e) {
      alert('이미지 분석 중 오류가 발생했어요')
    }
    setPromoImageExtracting(false)
  }

  function handlePromoDrop(e: React.DragEvent) {
    e.preventDefault()
    setPromoDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) extractFromImage(file)
  }

  // ── 긴급 특약 — AI 분석 ───────────────────────
  async function analyzePromo() {
    if (!promoForm.details.trim() && !promoForm.product_name.trim()) return
    setPromoAnalyzing(true)
    try {
      const prompt = `보험 설계사가 다음 긴급 특약/상품 정보를 고객에게 알리려 합니다.

보험사: ${promoForm.company || '미입력'}
상품명: ${promoForm.product_name}
유효기간: ${promoForm.valid_from || '미정'} ~ ${promoFilter.age_max ? promoForm.valid_to : '미정'}
특약 내용: ${promoForm.details}

다음 두 가지를 JSON 형식으로 출력해주세요:
{
  "target": {
    "age_min": "숫자 또는 빈문자열",
    "age_max": "숫자 또는 빈문자열",
    "gender": "남 또는 여 또는 빈문자열",
    "customer_type": "existing 또는 prospect 또는 빈문자열"
  },
  "message": "고객에게 보낼 카카오 알림 메시지 (150자 이내, [고객명] 사용, 친근하고 긴급하게, 특약 혜택 구체적으로)",
  "analysis": "이 특약의 핵심 가치와 타겟 이유 2~3문장"
}
JSON만 출력하세요.`
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (data.content) {
        try {
          const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleaned)
          if (parsed.target) {
            setPromoFilter(prev => ({
              ...prev,
              age_min: parsed.target.age_min || '',
              age_max: parsed.target.age_max || '',
              gender: parsed.target.gender || '',
              customer_type: parsed.target.customer_type || '',
            }))
          }
          if (parsed.message) setPromoMessage(parsed.message)
          if (parsed.analysis) setPromoAnalysis(parsed.analysis)
        } catch {
          setPromoMessage(data.content)
        }
      }
    } catch (e) {
      console.error(e)
    }
    setPromoAnalyzing(false)
  }

  // ── 긴급 특약 — 발송 ─────────────────────────
  async function handlePromoSend() {
    if (!agentId) return
    if (!promoForm.product_name.trim()) { alert('상품명을 입력해주세요'); return }
    if (!promoMessage.trim()) { alert('메시지를 작성해주세요'); return }
    if (promoMatched.length === 0) { alert('발송 대상 고객이 없어요'); return }
    const targets = promoMatched.filter(c => c.phone)
    if (targets.length === 0) { alert('전화번호 있는 고객이 없어요'); return }
    if (!confirm(`${targets.length}명에게 긴급 특약 알림을 발송할까요?`)) return
    setPromoSending(true)
    try {
      // 특약 레코드 저장
      const { data: promo, error: promoErr } = await supabase
        .from('dpa_promotions').insert({
          created_by: agentId,
          company: promoForm.company,
          product_name: promoForm.product_name,
          valid_from: promoForm.valid_from || null,
          valid_to: promoForm.valid_to || null,
          details: promoForm.details,
          ai_analysis: promoAnalysis,
          target_filters: promoFilter,
          message_template: promoMessage,
          is_active: true,
        }).select().single()
      if (promoErr || !promo) { alert('특약 저장 실패'); setPromoSending(false); return }

      // 캠페인으로 연결 발송
      const { data: camp, error: campErr } = await supabase
        .from('dpa_campaigns').insert({
          agent_id: agentId,
          name: `[긴급특약] ${promoForm.product_name}`,
          target_filters: promoFilter,
          message: promoMessage,
          send_method: promoSendMethod,
          status: 'sent',
          total_targets: targets.length,
          sent_at: new Date().toISOString(),
        }).select().single()
      if (!campErr && camp) {
        const sends = targets.map(c => ({
          campaign_id: camp.id,
          customer_id: c.id,
          customer_name: c.name,
          phone: c.phone!,
          message: promoMessage.replace(/\[고객명\]/g, c.name),
          send_status: 'pending',
        }))
        await supabase.from('dpa_campaign_sends').insert(sends)
      }
      setPromoSaveMsg('발송 완료!')
      setTimeout(() => setPromoSaveMsg(''), 3000)
      setPromoForm(DEFAULT_PROMO_FORM)
      setPromoMessage('')
      setPromoAnalysis('')
      setPromoFilter(DEFAULT_FILTER)
      loadPromos()
    } catch (e) {
      alert('발송 중 오류 발생')
    }
    setPromoSending(false)
  }

  // ── PRO 체크 ─────────────────────────────────
  if (!loading && planType !== 'pro' && planType !== 'admin') {
    return (
      <>
        <Head><title>캠페인 발송 — 아이플래너</title></Head>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:40 }}>
          <div style={{ fontSize:40 }}>🔒</div>
          <div style={{ fontSize:20, fontWeight:700, color:'#1A1A2E' }}>PRO 전용 기능이에요</div>
          <div style={{ fontSize:14, color:'#8892A0', textAlign:'center', lineHeight:1.7 }}>
            캠페인 발송은 PRO 요금제에서만 사용 가능해요.<br/>
            업그레이드하면 타겟 캠페인, 긴급 특약 알림 등을 이용할 수 있어요.
          </div>
          <button
            onClick={() => router.push('/settings')}
            style={{ marginTop:8, padding:'10px 28px', background:'#5E6AD2', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            요금제 업그레이드
          </button>
        </div>
      </>
    )
  }

  if (loading) return <div style={{ padding:40, color:'#8892A0' }}>불러오는 중...</div>

  return (
    <>
      <Head><title>캠페인 발송 — 아이플래너</title></Head>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 24px 80px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#1A1A2E', margin:'0 0 4px' }}>
            캠페인 발송
          </h1>
          <p style={{ fontSize:14, color:'#666666', margin:0 }}>
            타겟 고객을 선별하고 맞춤 메시지를 발송해요
          </p>
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid #E5E7EB', marginBottom:20 }}>
          {([
            ['new', '새 캠페인'],
            ['promo', '⚡ 긴급 특약'],
            ['history', '발송 이력'],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background:'none', border:'none', padding:'10px 16px', fontSize:13, fontWeight:500,
              color: tab===t ? '#5E6AD2' : '#8892A0',
              borderBottom: tab===t ? '2px solid #5E6AD2' : '2px solid transparent',
              marginBottom:-1, cursor:'pointer', fontFamily:'inherit',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 새 캠페인 탭 ── */}
        {tab === 'new' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'stretch' }}>

            {/* 왼쪽: 타겟 필터 */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20, display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                타겟 필터
              </div>

              {/* 나이 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  나이 범위
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" placeholder="20" value={filter.age_min}
                    onChange={e => setFilter(p => ({ ...p, age_min: e.target.value }))}
                    style={{ width:'80px', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA' }} />
                  <span style={{ color:'#8892A0', fontSize:13 }}>~</span>
                  <input type="number" placeholder="39" value={filter.age_max}
                    onChange={e => setFilter(p => ({ ...p, age_max: e.target.value }))}
                    style={{ width:'80px', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA' }} />
                  <span style={{ color:'#8892A0', fontSize:13 }}>세</span>
                </div>
              </div>

              {/* 성별 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  성별
                </label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['', '전체'], ['남', '남성'], ['여', '여성']].map(([val, label]) => (
                    <button key={val} onClick={() => setFilter(p => ({ ...p, gender: val }))}
                      style={{
                        padding:'6px 14px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                        background: filter.gender === val ? '#5E6AD2' : 'transparent',
                        color: filter.gender === val ? '#fff' : '#636B78',
                        border: filter.gender === val ? '1px solid #5E6AD2' : '1px solid #E5E7EB',
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* 고객 유형 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  고객 유형
                </label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['', '전체'], ['existing', '마이고객'], ['prospect', '관심고객']].map(([val, label]) => (
                    <button key={val} onClick={() => setFilter(p => ({ ...p, customer_type: val }))}
                      style={{
                        padding:'6px 14px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                        background: filter.customer_type === val ? '#5E6AD2' : 'transparent',
                        color: filter.customer_type === val ? '#fff' : '#636B78',
                        border: filter.customer_type === val ? '1px solid #5E6AD2' : '1px solid #E5E7EB',
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* 조건 필터 */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:8 }}>
                  추가 조건
                </label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    ['has_gap', '보장공백 있는 고객'],
                    ['near_deadline', '완납임박 고객'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#636B78' }}>
                      <input type="checkbox"
                        checked={(filter as any)[key]}
                        onChange={e => setFilter(p => ({ ...p, [key]: e.target.checked }))}
                        style={{ width:15, height:15, accentColor:'#5E6AD2', cursor:'pointer' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* 매칭 결과 */}
              <div style={{ background:'#F0F0FD', border:'1px solid rgba(94,106,210,0.2)', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:13, color:'#5E6AD2', fontWeight:600, marginBottom:4 }}>
                  매칭 고객 <span style={{ fontSize:20 }}>{matched.length}</span>명
                </div>
                <div style={{ fontSize:11, color:'#8892A0' }}>
                  전화번호 있는 고객: {matched.filter(c=>c.phone).length}명 (실제 발송 대상)
                </div>
              </div>

              {/* 매칭 고객 미리보기 */}
              {matched.length > 0 && (
                <div style={{ marginTop:12, maxHeight:200, overflowY:'auto' }}>
                  {matched.slice(0,20).map(c => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F3F4F6', fontSize:12 }}>
                      <span style={{ color:'#1A1A2E', fontWeight:500 }}>{c.name}</span>
                      <span style={{ color:'#8892A0' }}>
                        {c.age != null ? `${c.age}세` : '나이미상'} · {c.gender || '성별미상'}
                      </span>
                    </div>
                  ))}
                  {matched.length > 20 && (
                    <div style={{ padding:'6px 0', fontSize:11, color:'#8892A0', textAlign:'center' }}>
                      외 {matched.length - 20}명 더 있음
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 오른쪽: 메시지 작성 */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20, display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                메시지 작성
              </div>

              {/* 캠페인 이름 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  캠페인 이름
                </label>
                <input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="예: 30대 여성 신생아보험 캠페인"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA', color:'#1A1A2E', boxSizing:'border-box', fontFamily:'inherit', outline:'none' }} />
              </div>

              {/* 발송 수단 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  발송 수단
                </label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['sms','📱 문자'], ['kakao','💬 카카오톡']].map(([val, label]) => {
                    const isKakao = val === 'kakao'
                    const isActive = sendMethod === val
                    return (
                      <button key={val} onClick={() => setSendMethod(val as 'sms'|'kakao')}
                        style={{
                          padding:'6px 14px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                          background: isActive ? (isKakao ? '#FEE500' : '#5E6AD2') : 'transparent',
                          color: isActive ? (isKakao ? '#3C1E1E' : '#fff') : '#636B78',
                          border: isActive ? (isKakao ? '1px solid #FEE500' : '1px solid #5E6AD2') : '1px solid #E5E7EB',
                          fontWeight: isActive ? 600 : 400,
                        }}>{label}</button>
                    )
                  })}
                </div>
              </div>

              {/* AI 생성 버튼 */}
              <button
                onClick={generateAiMessage}
                disabled={aiLoading || matched.length === 0}
                style={{
                  width:'100%', padding:'9px', marginBottom:10,
                  background: aiLoading || matched.length === 0 ? '#F3F4F6' : 'linear-gradient(135deg, #5E6AD2, #5855C8)',
                  color: aiLoading || matched.length === 0 ? '#8892A0' : '#fff',
                  border:'none', borderRadius:8, fontSize:13, fontWeight:600,
                  cursor: aiLoading || matched.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily:'inherit',
                }}>
                {aiLoading ? '✨ AI 생성 중...' : '✨ AI 멘트 자동 생성'}
              </button>

              {/* 메시지 입력 */}
              <div style={{ marginBottom:6, flex:1, display:'flex', flexDirection:'column' }}>
                <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>
                  메시지 <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>([고객명] 은 자동 치환)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="메시지를 입력하거나 AI 생성 버튼을 눌러보세요"
                  style={{ flex:1, minHeight:120, width:'100%', padding:'10px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, lineHeight:1.7, resize:'none', fontFamily:'inherit', boxSizing:'border-box', background:'#F7F8FA' }} />
                <div style={{ textAlign:'right', fontSize:11, color: message.length > 90 ? '#E24B4A' : '#8892A0', marginTop:3 }}>
                  {message.length}자 {sendMethod === 'sms' && message.length > 90 ? '(장문 SMS)' : ''}
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={saveDraft}
                  style={{ flex:1, padding:'10px', background:'transparent', color:'#636B78', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                  임시저장
                </button>
                <button onClick={handleSend} disabled={sending}
                  style={{ flex:2, padding:'10px', background: sending ? '#A5B0FF' : '#5E6AD2', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: sending ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  {sending ? '발송 중...' : `${matched.filter(c=>c.phone).length}명에게 발송`}
                </button>
              </div>
              {saveMsg && <div style={{ textAlign:'center', fontSize:12, color:'#1D9E75', marginTop:8 }}>{saveMsg}</div>}
            </div>
          </div>
        )}

        {/* ── 긴급 특약 탭 ── */}
        {tab === 'promo' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>

            {/* 왼쪽: 특약 입력 */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* 특약 정보 입력 */}
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ display:'inline-block', width:3, height:14, background:'#E24B4A', borderRadius:2 }} />
                  특약 정보 입력
                </div>

                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:5 }}>보험사</label>
                  <InsuranceCompanySelect
                    value={promoForm.company}
                    onChange={v => setPromoForm(p => ({ ...p, company: v }))}
                  />
                </div>

                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:5 }}>상품/특약명</label>
                  <input value={promoForm.product_name} onChange={e => setPromoForm(p => ({ ...p, product_name: e.target.value }))}
                    placeholder="예: 무배당 건강보험 특별부가특약"
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA', color:'#1A1A2E', boxSizing:'border-box', fontFamily:'inherit', outline:'none' }} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:5 }}>시작일</label>
                    <DatePicker value={promoForm.valid_from} onChange={v => setPromoForm(p => ({ ...p, valid_from: v }))} placeholder="시작일 선택" />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:5 }}>마감일</label>
                    <DatePicker value={promoForm.valid_to} onChange={v => setPromoForm(p => ({ ...p, valid_to: v }))} placeholder="마감일 선택" />
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:5 }}>
                    특약 내용
                  </label>

                  {/* 텍스트 입력된 상태 — textarea 표시 */}
                  {promoForm.details ? (
                    <div style={{ position:'relative' }}>
                      <textarea
                        value={promoForm.details}
                        onChange={e => setPromoForm(p => ({ ...p, details: e.target.value }))}
                        rows={5}
                        style={{
                          width:'100%', padding:'10px 12px',
                          border:'1px solid #E5E7EB', borderRadius:8,
                          fontSize:13, lineHeight:1.7, resize:'vertical',
                          fontFamily:'inherit', boxSizing:'border-box',
                          background:'#F7F8FA', outline:'none', color:'#1A1A2E',
                        }}
                      />
                      <button onClick={() => setPromoForm(p => ({ ...p, details: '' }))}
                        style={{
                          position:'absolute', top:8, right:8,
                          fontSize:11, color:'#8892A0', background:'#F3F4F6',
                          border:'none', borderRadius:4, cursor:'pointer',
                          padding:'2px 8px', fontFamily:'inherit',
                        }}>
                        지우기
                      </button>
                    </div>
                  ) : (
                    /* 비어있는 상태 — 드롭존 */
                    <label
                      onDragOver={e => { e.preventDefault(); setPromoDragOver(true) }}
                      onDragLeave={() => setPromoDragOver(false)}
                      onDrop={handlePromoDrop}
                      style={{
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        border: promoDragOver ? '2px dashed #5E6AD2' : '2px dashed #E5E7EB',
                        borderRadius:8, padding:28, textAlign:'center', cursor:'pointer',
                        background: promoDragOver ? 'rgba(94,106,210,0.05)' : 'transparent',
                        transition:'all 0.12s',
                      }}
                    >
                      {promoImageExtracting ? (
                        <>
                          <div style={{ fontSize:26, marginBottom:8 }}>⏳</div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#5E6AD2' }}>AI가 이미지 내용 추출 중...</div>
                        </>
                      ) : (
                        <>
                          <div style={{ width:44, height:44, borderRadius:10, background:'rgba(94,106,210,0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1A1A2E', marginBottom:4 }}>
                            {promoDragOver ? '여기에 놓아주세요' : '이미지를 드래그하거나 클릭해서 선택'}
                          </div>
                          <div style={{ fontSize:11, color:'#8892A0' }}>
                            보험사 공문, 카카오톡 캡처 등 · AI가 자동으로 내용을 추출해요
                          </div>
                        </>
                      )}
                      <input type="file" accept="image/*" style={{ display:'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) extractFromImage(f); e.target.value = '' }} />
                    </label>
                  )}

                  {/* 텍스트 직접 입력 링크 */}
                  {!promoForm.details && (
                    <button
                      onClick={() => setPromoForm(p => ({ ...p, details: ' ' }))}
                      style={{ marginTop:6, fontSize:11, color:'#8892A0', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:0 }}>
                      텍스트로 직접 입력하기
                    </button>
                  )}
                </div>

                <button
                  onClick={analyzePromo}
                  disabled={promoAnalyzing || (!promoForm.details.trim() && !promoForm.product_name.trim())}
                  style={{
                    width:'100%', padding:'10px',
                    background: promoAnalyzing || (!promoForm.details.trim() && !promoForm.product_name.trim()) ? '#F3F4F6' : 'linear-gradient(135deg, #E24B4A, #C83737)',
                    color: promoAnalyzing || (!promoForm.details.trim() && !promoForm.product_name.trim()) ? '#8892A0' : '#fff',
                    border:'none', borderRadius:8, fontSize:13, fontWeight:600,
                    cursor: promoAnalyzing ? 'wait' : 'pointer',
                    fontFamily:'inherit',
                  }}>
                  {promoAnalyzing ? '⚡ AI 분석 중...' : '⚡ AI 타겟 분석 + 멘트 생성'}
                </button>
              </div>

              {/* AI 분석 결과 */}
              {promoAnalysis && (
                <div style={{ background:'#FFF7F7', border:'1px solid rgba(226,75,74,0.2)', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#E24B4A', marginBottom:6 }}>AI 분석</div>
                  <div style={{ fontSize:13, color:'#636B78', lineHeight:1.7 }}>{promoAnalysis}</div>
                </div>
              )}

              {/* 타겟 필터 (AI 자동 설정, 수동 수정 가능) */}
              {(promoAnalysis || promoMessage) && (
                <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                    타겟 필터 <span style={{ fontSize:11, fontWeight:400, color:'#8892A0', marginLeft:4 }}>(AI 제안, 수정 가능)</span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:500, color:'#666666', display:'block', marginBottom:4 }}>최소 나이</label>
                      <input type="number" value={promoFilter.age_min} onChange={e => setPromoFilter(p => ({ ...p, age_min: e.target.value }))}
                        placeholder="전체"
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:500, color:'#666666', display:'block', marginBottom:4 }}>최대 나이</label>
                      <input type="number" value={promoFilter.age_max} onChange={e => setPromoFilter(p => ({ ...p, age_max: e.target.value }))}
                        placeholder="전체"
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA', boxSizing:'border-box' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:12, fontWeight:500, color:'#666666', display:'block', marginBottom:6 }}>성별</label>
                    <div style={{ display:'flex', gap:6 }}>
                      {[['', '전체'], ['남', '남성'], ['여', '여성']].map(([val, label]) => (
                        <button key={val} onClick={() => setPromoFilter(p => ({ ...p, gender: val }))}
                          style={{
                            padding:'5px 12px', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                            background: promoFilter.gender === val ? '#5E6AD2' : 'transparent',
                            color: promoFilter.gender === val ? '#fff' : '#636B78',
                            border: promoFilter.gender === val ? '1px solid #5E6AD2' : '1px solid #E5E7EB',
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:12, fontWeight:500, color:'#666666', display:'block', marginBottom:6 }}>고객 유형</label>
                    <div style={{ display:'flex', gap:6 }}>
                      {[['', '전체'], ['existing', '마이고객'], ['prospect', '관심고객']].map(([val, label]) => (
                        <button key={val} onClick={() => setPromoFilter(p => ({ ...p, customer_type: val }))}
                          style={{
                            padding:'5px 12px', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                            background: promoFilter.customer_type === val ? '#5E6AD2' : 'transparent',
                            color: promoFilter.customer_type === val ? '#fff' : '#636B78',
                            border: promoFilter.customer_type === val ? '1px solid #5E6AD2' : '1px solid #E5E7EB',
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background:'#F0F0FD', border:'1px solid rgba(94,106,210,0.2)', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontSize:13, color:'#5E6AD2', fontWeight:600 }}>
                      매칭 고객 <span style={{ fontSize:18 }}>{promoMatched.length}</span>명
                      <span style={{ fontSize:11, color:'#8892A0', fontWeight:400, marginLeft:8 }}>
                        (전화번호 있는 고객: {promoMatched.filter(c=>c.phone).length}명)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽: 메시지 + 발송 */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {promoMessage ? (
                <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                    발송 메시지
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, fontWeight:500, color:'#666666', textTransform:'uppercase', letterSpacing:'0.03em', display:'block', marginBottom:6 }}>발송 수단</label>
                    <div style={{ display:'flex', gap:6 }}>
                      {[['kakao','💬 카카오톡'], ['sms','📱 문자']].map(([val, label]) => {
                        const isKakao = val === 'kakao'
                        const isActive = promoSendMethod === val
                        return (
                        <button key={val} onClick={() => setPromoSendMethod(val as 'sms'|'kakao')}
                          style={{
                            padding:'6px 14px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                            background: isActive ? (isKakao ? '#FEE500' : '#5E6AD2') : 'transparent',
                            color: isActive ? (isKakao ? '#3C1E1E' : '#fff') : '#636B78',
                            border: isActive ? (isKakao ? '1px solid #FEE500' : '1px solid #5E6AD2') : '1px solid #E5E7EB',
                            fontWeight: isActive ? 600 : 400,
                          }}>{label}</button>
                        )
                      })}
                    </div>
                  </div>

                  <textarea
                    value={promoMessage} onChange={e => setPromoMessage(e.target.value)}
                    rows={8}
                    style={{ width:'100%', padding:'10px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, lineHeight:1.7, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', background:'#F7F8FA', marginBottom:4 }} />
                  <div style={{ textAlign:'right', fontSize:11, color: promoMessage.length > 150 ? '#E24B4A' : '#8892A0', marginBottom:14 }}>
                    {promoMessage.length}자
                  </div>

                  {/* 매칭 고객 미리보기 */}
                  {promoMatched.length > 0 && (
                    <div style={{ marginBottom:14, maxHeight:180, overflowY:'auto', border:'1px solid #F3F4F6', borderRadius:8 }}>
                      {promoMatched.slice(0,15).map(c => (
                        <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', borderBottom:'1px solid #F3F4F6', fontSize:12 }}>
                          <span style={{ color:'#1A1A2E', fontWeight:500 }}>{c.name}</span>
                          <span style={{ color:'#8892A0' }}>
                            {c.age != null ? `${c.age}세` : '나이미상'} · {c.gender || '성별미상'}
                          </span>
                        </div>
                      ))}
                      {promoMatched.length > 15 && (
                        <div style={{ padding:'6px', fontSize:11, color:'#8892A0', textAlign:'center' }}>
                          외 {promoMatched.length - 15}명 더
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={handlePromoSend} disabled={promoSending || promoMatched.filter(c=>c.phone).length === 0}
                    style={{
                      width:'100%', padding:'12px',
                      background: promoSending || promoMatched.filter(c=>c.phone).length === 0 ? '#F3F4F6' : 'linear-gradient(135deg, #E24B4A, #C83737)',
                      color: promoSending || promoMatched.filter(c=>c.phone).length === 0 ? '#8892A0' : '#fff',
                      border:'none', borderRadius:8, fontSize:14, fontWeight:700,
                      cursor: promoSending ? 'wait' : 'pointer',
                      fontFamily:'inherit',
                    }}>
                    {promoSending ? '발송 중...' : `⚡ ${promoMatched.filter(c=>c.phone).length}명에게 긴급 특약 발송`}
                  </button>
                  {promoSaveMsg && <div style={{ textAlign:'center', fontSize:12, color:'#1D9E75', marginTop:8 }}>{promoSaveMsg}</div>}
                </div>
              ) : (
                <div style={{ background:'#fff', border:'1px dashed #E5E7EB', borderRadius:10, padding:60, textAlign:'center' }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>⚡</div>
                  <div style={{ fontSize:14, color:'#1A1A2E', fontWeight:600, marginBottom:6 }}>특약 내용을 입력하고 AI 분석을 실행해보세요</div>
                  <div style={{ fontSize:13, color:'#8892A0', lineHeight:1.7 }}>
                    보험사에서 받은 특약 공문이나 설명을<br/>
                    그대로 붙여넣으면 AI가 타겟과 멘트를 자동 설정해줘요
                  </div>
                </div>
              )}

              {/* 발송 이력 (이 설계사 특약 목록) */}
              {promos.length > 0 && (
                <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #E5E7EB', fontSize:13, fontWeight:600, color:'#1A1A2E' }}>
                    발송한 특약 이력
                  </div>
                  {promosLoading ? (
                    <div style={{ padding:20, textAlign:'center', color:'#8892A0', fontSize:13 }}>불러오는 중...</div>
                  ) : (
                    promos.slice(0,5).map(p => (
                      <div key={p.id} style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#1A1A2E' }}>{p.product_name}</span>
                          <span style={{ fontSize:11, color:'#8892A0' }}>{fmtDate(p.created_at)}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#8892A0' }}>
                          {p.company} {p.valid_to ? `· ~${fmtDate(p.valid_to)}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 발송 이력 탭 ── */}
        {tab === 'history' && (
          <div>
            {histLoading ? (
              <div style={{ padding:40, textAlign:'center', color:'#8892A0' }}>불러오는 중...</div>
            ) : campaigns.length === 0 ? (
              <div style={{ padding:60, textAlign:'center', color:'#8892A0', fontSize:13 }}>
                아직 발송한 캠페인이 없어요
              </div>
            ) : (() => {
              // 날짜별 그룹핑
              const groups: Record<string, Campaign[]> = {}
              campaigns.forEach(c => {
                const d = fmtDate(c.created_at)
                if (!groups[d]) groups[d] = []
                groups[d].push(c)
              })
              const dateKeys = Object.keys(groups)

              return (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {dateKeys.map(date => {
                    const isDateOpen = expandedDates.has(date)
                    const items = groups[date]
                    return (
                      <div key={date} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>

                        {/* 날짜 헤더 (토글) */}
                        <button
                          onClick={() => toggleDate(date)}
                          style={{
                            width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'12px 16px', background:'none', border:'none', cursor:'pointer',
                            fontFamily:'inherit',
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{
                              fontSize:11, transition:'transform 0.15s',
                              transform: isDateOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                              display:'inline-block', color:'#8892A0',
                            }}>▶</span>
                            <span style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{date}</span>
                            <span style={{ fontSize:11, color:'#8892A0', fontWeight:400 }}>{items.length}건</span>
                          </div>
                          <div style={{ display:'flex', gap:4 }}>
                            {items.some(c => c.name.startsWith('[긴급특약]')) && (
                              <span style={{ fontSize:11, fontWeight:600, color:'#E24B4A', background:'#FFF0F0', padding:'2px 8px', borderRadius:999 }}>⚡ 긴급특약</span>
                            )}
                            {items.some(c => !c.name.startsWith('[긴급특약]')) && (
                              <span style={{ fontSize:11, fontWeight:600, color:'#5E6AD2', background:'#F0F0FD', padding:'2px 8px', borderRadius:999 }}>📢 캠페인</span>
                            )}
                          </div>
                        </button>

                        {/* 날짜 내 항목 목록 */}
                        {isDateOpen && (
                          <div style={{ borderTop:'1px solid #F3F4F6' }}>
                            {items.map((c, idx) => {
                              const isPromo = c.name.startsWith('[긴급특약]')
                              const isItemOpen = expandedItems.has(c.id)
                              const displayName = isPromo ? c.name.replace('[긴급특약] ', '') : c.name
                              return (
                                <div key={c.id} style={{ borderBottom: idx < items.length-1 ? '1px solid #F3F4F6' : 'none' }}>

                                  {/* 항목 헤더 (서브 토글) */}
                                  <button
                                    onClick={() => toggleItem(c.id)}
                                    style={{
                                      width:'100%', display:'flex', alignItems:'center', gap:10,
                                      padding:'10px 16px 10px 32px', background:'none', border:'none',
                                      cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                                    }}
                                  >
                                    <span style={{
                                      fontSize:10, transition:'transform 0.15s',
                                      transform: isItemOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                      display:'inline-block', color:'#C0C0C0', flexShrink:0,
                                    }}>▶</span>

                                    {/* 타입 뱃지 */}
                                    <span style={{
                                      fontSize:10, fontWeight:700, flexShrink:0,
                                      color: isPromo ? '#E24B4A' : '#5E6AD2',
                                      background: isPromo ? '#FFF0F0' : '#F0F0FD',
                                      padding:'2px 7px', borderRadius:999,
                                    }}>
                                      {isPromo ? '⚡ 특약' : '📢 캠페인'}
                                    </span>

                                    <span style={{ fontSize:13, fontWeight:500, color:'#1A1A2E', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                      {displayName}
                                    </span>

                                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, fontSize:12, color:'#8892A0' }}>
                                      <span>{c.total_targets}명</span>
                                      <span>{c.send_method === 'sms' ? '📱' : '💬'}</span>
                                      <span style={{
                                        fontSize:11, fontWeight:600,
                                        color: STATUS_COLOR[c.status],
                                        background: `${STATUS_COLOR[c.status]}18`,
                                        padding:'1px 8px', borderRadius:999,
                                      }}>
                                        {STATUS_LABEL[c.status]}
                                      </span>
                                    </div>
                                  </button>

                                  {/* 펼침 내용 */}
                                  {isItemOpen && (
                                    <div style={{ padding:'0 16px 14px 56px' }}>

                                      {/* 요약 메타 */}
                                      <div style={{ display:'flex', gap:16, fontSize:12, color:'#636B78', marginBottom:10, flexWrap:'wrap' }}>
                                        <span>대상 <strong style={{ color:'#1A1A2E' }}>{c.total_targets}명</strong></span>
                                        {c.sent_count > 0 && <span>발송 <strong style={{ color:'#1D9E75' }}>{c.sent_count}건</strong></span>}
                                        {c.failed_count > 0 && <span>실패 <strong style={{ color:'#E24B4A' }}>{c.failed_count}건</strong></span>}
                                        <span>{c.send_method === 'sms' ? '📱 문자' : '💬 카카오톡'}</span>
                                        {c.target_filters && (
                                          <>
                                            {(c.target_filters.age_min || c.target_filters.age_max) && (
                                              <span style={{ background:'#F3F4F6', padding:'1px 7px', borderRadius:999 }}>
                                                {c.target_filters.age_min || '?'}~{c.target_filters.age_max || '?'}세
                                              </span>
                                            )}
                                            {c.target_filters.gender && (
                                              <span style={{ background:'#F3F4F6', padding:'1px 7px', borderRadius:999 }}>{c.target_filters.gender}성</span>
                                            )}
                                            {c.target_filters.customer_type && (
                                              <span style={{ background:'#F3F4F6', padding:'1px 7px', borderRadius:999 }}>
                                                {c.target_filters.customer_type === 'existing' ? '마이고객' : '관심고객'}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>

                                      {/* 발송 메시지 */}
                                      {c.message && (
                                        <div style={{ padding:'10px 12px', background:'#F7F8FA', borderRadius:8, fontSize:12, color:'#636B78', lineHeight:1.8, whiteSpace:'pre-wrap', borderLeft:'3px solid #E5E7EB', marginBottom:12 }}>
                                          {c.message}
                                        </div>
                                      )}

                                      {/* 고객 검색 + 목록 */}
                                      <div style={{ border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
                                        {/* 검색 */}
                                        <div style={{ padding:'8px 12px', borderBottom:'1px solid #F3F4F6', background:'#FAFAFA', display:'flex', alignItems:'center', gap:8 }}>
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8892A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                          </svg>
                                          <input
                                            value={itemSearch[c.id] || ''}
                                            onChange={e => setItemSearch(prev => ({ ...prev, [c.id]: e.target.value }))}
                                            placeholder="고객명 검색..."
                                            style={{ flex:1, border:'none', background:'transparent', fontSize:12, color:'#1A1A2E', outline:'none', fontFamily:'inherit' }}
                                          />
                                          {itemSearch[c.id] && (
                                            <button onClick={() => setItemSearch(prev => ({ ...prev, [c.id]: '' }))}
                                              style={{ border:'none', background:'none', cursor:'pointer', color:'#8892A0', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
                                          )}
                                        </div>

                                        {/* 고객 목록 */}
                                        {sendsLoading.has(c.id) ? (
                                          <div style={{ padding:'16px', textAlign:'center', fontSize:12, color:'#8892A0' }}>불러오는 중...</div>
                                        ) : (() => {
                                          const sends = campaignSends[c.id] || []
                                          const q = (itemSearch[c.id] || '').trim()
                                          const filtered = q ? sends.filter(s => s.customer_name?.includes(q)) : sends
                                          if (sends.length === 0) return (
                                            <div style={{ padding:'16px', textAlign:'center', fontSize:12, color:'#8892A0' }}>발송 고객 정보가 없어요</div>
                                          )
                                          return (
                                            <div style={{ maxHeight:200, overflowY:'auto' }}>
                                              {filtered.length === 0 ? (
                                                <div style={{ padding:'12px', textAlign:'center', fontSize:12, color:'#8892A0' }}>"{q}" 검색 결과 없음</div>
                                              ) : (
                                                filtered.map((s: any) => (
                                                  <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', borderBottom:'1px solid #F9FAFB', fontSize:12 }}>
                                                    <span style={{ color:'#1A1A2E', fontWeight:500 }}>{s.customer_name}</span>
                                                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                      <span style={{ color:'#8892A0' }}>{s.phone}</span>
                                                      <span style={{
                                                        fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:999,
                                                        background: s.send_status === 'sent' ? '#DCFCE7' : s.send_status === 'failed' ? '#FEE2E2' : '#F3F4F6',
                                                        color: s.send_status === 'sent' ? '#166534' : s.send_status === 'failed' ? '#991B1B' : '#636B78',
                                                      }}>
                                                        {s.send_status === 'sent' ? '발송' : s.send_status === 'failed' ? '실패' : '대기'}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ))
                                              )}
                                              {filtered.length > 0 && q && (
                                                <div style={{ padding:'6px 12px', fontSize:11, color:'#8892A0', background:'#FAFAFA' }}>
                                                  {filtered.length}명 검색됨 (전체 {sends.length}명)
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </>
  )
}
