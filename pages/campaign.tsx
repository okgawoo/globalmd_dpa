import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

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
const STATUS_COLOR: Record<string, string> = {
  draft: '#8892A0', sent: '#1D9E75', scheduled: '#5E6AD2',
}

// ── 메인 컴포넌트 ────────────────────────────────
export default function CampaignPage() {
  const router = useRouter()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [planType, setPlanType] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // 탭: 'new' | 'history'
  const [tab, setTab] = useState<'new' | 'history'>('new')

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
    setCampaigns(data || [])
    setHistLoading(false)
  }

  useEffect(() => {
    if (tab === 'history' && agentId) loadHistory()
  }, [tab, agentId])

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
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 24px 80px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#1A1A2E', margin:'0 0 4px' }}>
            캠페인 발송
          </h1>
          <p style={{ fontSize:13, color:'#8892A0', margin:0 }}>
            타겟 고객을 선별하고 맞춤 메시지를 발송해요
          </p>
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid #E5E7EB', marginBottom:20 }}>
          {(['new','history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background:'none', border:'none', padding:'10px 16px', fontSize:13, fontWeight:500,
              color: tab===t ? '#5E6AD2' : '#8892A0',
              borderBottom: tab===t ? '2px solid #5E6AD2' : '2px solid transparent',
              marginBottom:-1, cursor:'pointer', fontFamily:'inherit',
            }}>
              {t === 'new' ? '새 캠페인' : '발송 이력'}
            </button>
          ))}
        </div>

        {/* ── 새 캠페인 탭 ── */}
        {tab === 'new' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>

            {/* 왼쪽: 타겟 필터 */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                타겟 필터
              </div>

              {/* 나이 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
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
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
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
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
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
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:20 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1A1A2E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ display:'inline-block', width:3, height:14, background:'#5E6AD2', borderRadius:2 }} />
                메시지 작성
              </div>

              {/* 캠페인 이름 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
                  캠페인 이름
                </label>
                <input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="예: 30대 여성 신생아보험 캠페인"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, background:'#F7F8FA', boxSizing:'border-box', fontFamily:'inherit' }} />
              </div>

              {/* 발송 수단 */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
                  발송 수단
                </label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['sms','📱 문자'], ['kakao','💬 카카오톡']].map(([val, label]) => (
                    <button key={val} onClick={() => setSendMethod(val as 'sms'|'kakao')}
                      style={{
                        padding:'6px 14px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                        background: sendMethod === val ? '#5E6AD2' : 'transparent',
                        color: sendMethod === val ? '#fff' : '#636B78',
                        border: sendMethod === val ? '1px solid #5E6AD2' : '1px solid #E5E7EB',
                      }}>{label}</button>
                  ))}
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
              <div style={{ marginBottom:6 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892A0', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 }}>
                  메시지 <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>([고객명] 은 자동 치환)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="메시지를 입력하거나 AI 생성 버튼을 눌러보세요"
                  rows={8}
                  style={{ width:'100%', padding:'10px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, lineHeight:1.7, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', background:'#F7F8FA' }} />
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

        {/* ── 발송 이력 탭 ── */}
        {tab === 'history' && (
          <div>
            {histLoading ? (
              <div style={{ padding:40, textAlign:'center', color:'#8892A0' }}>불러오는 중...</div>
            ) : campaigns.length === 0 ? (
              <div style={{ padding:60, textAlign:'center', color:'#8892A0', fontSize:13 }}>
                아직 발송한 캠페인이 없어요
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {campaigns.map(c => (
                  <div key={c.id} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'#1A1A2E' }}>{c.name}</span>
                      <span style={{ fontSize:11, fontWeight:600, color: STATUS_COLOR[c.status], background: `${STATUS_COLOR[c.status]}18`, padding:'2px 10px', borderRadius:999 }}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:16, fontSize:12, color:'#636B78' }}>
                      <span>대상 {c.total_targets}명</span>
                      {c.sent_count > 0 && <span style={{ color:'#1D9E75' }}>발송 {c.sent_count}건</span>}
                      {c.failed_count > 0 && <span style={{ color:'#E24B4A' }}>실패 {c.failed_count}건</span>}
                      <span>{c.send_method === 'sms' ? '📱 문자' : '💬 카카오'}</span>
                      <span style={{ marginLeft:'auto' }}>{fmtDate(c.created_at)}</span>
                    </div>
                    {c.message && (
                      <div style={{ marginTop:10, padding:'10px 12px', background:'#F7F8FA', borderRadius:6, fontSize:12, color:'#636B78', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                        {c.message.length > 120 ? c.message.slice(0,120)+'...' : c.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
