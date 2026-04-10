import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import styles from '../styles/Sales.module.css'

const FLOW_STAGES = [
  { key: '첫접촉', icon: '📞', label: '첫 접촉' },
  { key: '통화', icon: '💬', label: '통화 / 문자' },
  { key: '미팅확정', icon: '🤝', label: '미팅 확정' },
  { key: '미팅완료', icon: '✅', label: '미팅 완료' },
  { key: '계약검토', icon: '📋', label: '계약 검토' },
  { key: '계약완료', icon: '🎉', label: '계약 완료' },
]

const TYPE_OPTIONS = ['첫접촉', '통화', '문자', '미팅', '방문']
const STATUS_OPTIONS = ['대기', '확정', '취소', '완료']

export default function Sales() {
  const router = useRouter()
  const [agentId, setAgentId] = useState('')
  const [meetings, setMeetings] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'contact' | 'week' | 'past' | 'flow'>('contact')
  const [showForm, setShowForm] = useState(false)
  const [showFlow, setShowFlow] = useState(false)
  const [highlightId, setHighlightId] = useState<string|null>(null)
  const [editId, setEditId] = useState<string|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [isNewProspect, setIsNewProspect] = useState(false)

  const [form, setForm] = useState({
    customer_id: '',
    prospect_name: '',
    prospect_phone: '',
    introducer: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    location: '',
    type: '미팅',
    status: '대기',
    pipeline_stage: '첫접촉',
    memo: '',
  })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  useEffect(() => { init() }, [])

  useEffect(() => {
    const { meetingId, tab } = router.query
    if (tab === 'today') setActiveTab('today')
    if (meetingId) {
      setActiveTab('today')
      setHighlightId(meetingId as string)
    }
  }, [router.query])

  useEffect(() => {
    const { meetingId, tab } = router.query
    if (tab === 'today') setActiveTab('today')
    if (meetingId) {
      setActiveTab('today')
      setHighlightId(meetingId as string)
    }
  }, [router.query])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setAgentId(user.id)
    await fetchAll(user.id)
    setLoading(false)
  }

  async function fetchAll(aid: string) {
    const [{ data: m }, { data: c }, { data: ct }] = await Promise.all([
      supabase.from('dpa_meetings').select('*').eq('agent_id', aid).order('meeting_date', { ascending: true }),
      supabase.from('dpa_customers').select('*').eq('agent_id', aid),
      supabase.from('dpa_contracts').select('*').eq('agent_id', aid),
    ])
    setMeetings(m || [])
    setCustomers(c || [])
    setContracts(ct || [])
  }

  const todayMeetings = meetings.filter(m => m.meeting_date === todayStr)
  const upcomingMeetings = meetings.filter(m => m.meeting_date > todayStr && m.status !== '취소' && m.status !== '완료')
  const contactMeetings = meetings.filter(m => (m.type === '전화' || m.type === '문자') && m.status !== '취소' && m.status !== '완료')
  const pastMeetings = meetings.filter(m => m.meeting_date < todayStr).sort((a,b) => b.meeting_date.localeCompare(a.meeting_date))
  // 이번 주 (오늘 포함 앞뒤 7일)
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
  const weekStartStr = weekStart.toISOString().slice(0,10)
  const weekEndStr = weekEnd.toISOString().slice(0,10)
  const weekMeetings = meetings.filter(m => m.meeting_date >= weekStartStr && m.meeting_date <= weekEndStr).sort((a,b) => a.meeting_date.localeCompare(b.meeting_date))
  const weekDays = Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10) })

  // 오늘 연락할 고객
  const nearDone = customers.filter(c => {
    const cContracts = contracts.filter(ct => ct.customer_id === c.id)
    return cContracts.some(ct => {
      if (ct.payment_status === '완납') return false
      if (ct.contract_start && ct.payment_years) {
        const match = ct.payment_years.match(/(\d+)년/)
        if (match) {
          const total = parseInt(match[1]) * 12
          const [y, mo] = ct.contract_start.split('.').map(Number)
          if (y && mo) {
            const paid = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo) + 1
            return Math.min(Math.round(Math.max(0, paid) / total * 100), 100) >= 90
          }
        }
      }
      return false
    })
  })

  const birthdayContacts = customers.filter(c => {
    if (!c.birth_date) return false
    const b = new Date(c.birth_date)
    return b.getMonth() === now.getMonth() && Math.abs(b.getDate() - now.getDate()) <= 7
  })

  const getMeetingBadge = (m: any) => {
    if (m.prospect_name) return { text: '신규', color: '#6B7280', bg: '#F3F4F6' }
    const c = customers.find((c: any) => c.id === m.customer_id)
    if (!c) return { text: '신규', color: '#6B7280', bg: '#F3F4F6' }
    if (c.customer_type === 'prospect') return { text: '관심고객', color: '#B45309', bg: '#FEF3E2' }
    return { text: '마이고객', color: '#1D4ED8', bg: '#EFF6FF' }
  }

  const getMeetingName = (m: any) => {
    if (m.prospect_name) return m.prospect_name
    const c = customers.find(c => c.id === m.customer_id)
    return c ? c.name : '이름 없음'
  }

  const getStatusClass = (s: string) => {
    if (s === '확정') return styles.statusConfirmed
    if (s === '대기') return styles.statusPending
    if (s === '취소') return styles.statusCancelled
    return styles.statusDone
  }

  // 영업 플로우 단계 계산
  const getCustomerFlow = (customerId: string) => {
    const customerMeetings = meetings.filter(m => m.customer_id === customerId)
    const stages = FLOW_STAGES.map(s => s.key)
    let currentStageIdx = -1

    // 가장 높은 단계 찾기
    customerMeetings.forEach(m => {
      if (m.pipeline_stage) {
        const idx = stages.indexOf(m.pipeline_stage)
        if (idx > currentStageIdx) currentStageIdx = idx
      }
    })

    return { currentStageIdx, customerMeetings }
  }

  async function handleEdit(id: string) {
    const { error } = await supabase.from('dpa_meetings').update({
      meeting_date: editForm.meeting_date,
      meeting_time: editForm.meeting_time,
      location: editForm.location,
      status: editForm.status,
      memo: editForm.memo,
    }).eq('id', id)
    if (error) { alert('수정 실패: ' + error.message); return }
    setEditId(null)
    await fetchAll(agentId)
  }

  async function handleSubmit() {
    if (!form.meeting_date) return alert('날짜를 입력해주세요')
    if (isNewProspect && !form.prospect_name) return alert('이름을 입력해주세요')
    if (!isNewProspect && !form.customer_id) return alert('고객을 선택해주세요')

    const payload: any = {
      agent_id: agentId,
      meeting_date: form.meeting_date,
      meeting_time: form.meeting_time,
      location: form.location,
      type: form.type,
      status: form.status,
      pipeline_stage: form.pipeline_stage,
      memo: form.memo,
    }

    if (isNewProspect) {
      payload.prospect_name = form.prospect_name
      payload.prospect_phone = form.prospect_phone
      payload.introducer = form.introducer
    } else {
      payload.customer_id = form.customer_id
    }

    const { error } = await supabase.from('dpa_meetings').insert(payload)
    if (error) { alert('저장 실패: ' + error.message); return }

    setShowForm(false)
    setForm({ customer_id: '', prospect_name: '', prospect_phone: '', introducer: '', meeting_date: todayStr, meeting_time: '', location: '', type: '미팅', status: '대기', pipeline_stage: '첫접촉', memo: '' })
    await fetchAll(agentId)
  }

  async function updateStatus(id: string, status: string) {
    const m = meetings.find(m => m.id === id)
    const updates: any = { status }
    if (status === '취소') updates.cancel_count = (m?.cancel_count || 0) + 1
    await supabase.from('dpa_meetings').update(updates).eq('id', id)
    await fetchAll(agentId)
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={[styles.tab, activeTab === 'contact' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('contact')}>📞 연락할 고객</button>
        <button className={[styles.tab, activeTab === 'week' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('week')}>📅 이번 주</button>
        <button className={[styles.tab, activeTab === 'past' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('past')}>📋 지난 미팅</button>
        <button className={[styles.tab, activeTab === 'flow' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('flow')}>📊 영업 이력</button>
      </div>

      {/* ── 이번 주 탭 ── */}
      {activeTab === 'week' && (
        <div style={{paddingTop:16}}>
          {weekDays.map(day => {
            const dayMeetings = weekMeetings.filter(m => m.meeting_date === day)
            const dateObj = new Date(day + 'T00:00:00')
            const isToday = day === todayStr
            const dayLabel = ['일','월','화','수','목','금','토'][dateObj.getDay()]
            const monthDay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`
            return (
              <div key={day} style={{marginBottom:16}}>
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'6px 12px', borderRadius:8, marginBottom:6,
                  background: isToday ? '#ECFDF5' : '#F9FAFB',
                  border: isToday ? '1px solid #1D9E75' : '1px solid #F3F4F6'
                }}>
                  <span style={{fontWeight:700, fontSize:14, color: isToday ? '#1D9E75' : '#374151'}}>
                    {monthDay}({dayLabel})
                  </span>
                  {isToday && <span style={{fontSize:11,background:'#1D9E75',color:'white',borderRadius:10,padding:'1px 8px'}}>오늘</span>}
                  <span style={{fontSize:12,color:'#9CA3AF',marginLeft:'auto'}}>{dayMeetings.length}건</span>
                </div>
                {dayMeetings.length === 0 ? (
                  <div style={{fontSize:12,color:'#D1D5DB',textAlign:'center',padding:'8px 0'}}>미팅 없음</div>
                ) : dayMeetings.map(m => {
                  const badge = getMeetingBadge(m)
                  return (
                    <div key={m.id} className={styles.meetingCard}>
                      <div className={styles.meetingTop}>
                        <span className={styles.meetingName}>{getMeetingName(m)}</span>
                        <span className={styles.statusBadge} style={{background:badge.bg, color:badge.color}}>{badge.text}</span>
                      </div>
                      {m.meeting_time && <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>🕐 {m.meeting_time}</div>}
                      <div className={styles.meetingBottom}>
                        <span className={styles.meetingLocation}>📍 {m.location || '장소 미정'}</span>
                        <span className={styles.typeBadge}>{m.type || '미팅'}</span>
                      </div>
                      {m.memo && <div style={{fontSize:12,color:'#9CA3AF',marginTop:6}}>💬 {m.memo}</div>}
                      {editId === m.id ? (
                        <div style={{marginTop:10,background:'#F9FAFB',borderRadius:8,padding:10}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                            <div><label style={{fontSize:11,color:'#6B7280'}}>날짜</label><input type="date" value={editForm.meeting_date||''} onChange={e=>setEditForm((f:any)=>({...f,meeting_date:e.target.value}))} style={{width:'100%',fontSize:13,padding:'6px 8px',border:'1px solid #E5E7EB',borderRadius:6}} /></div>
                            <div><label style={{fontSize:11,color:'#6B7280'}}>시간</label><input type="time" value={editForm.meeting_time||''} onChange={e=>setEditForm((f:any)=>({...f,meeting_time:e.target.value}))} style={{width:'100%',fontSize:13,padding:'6px 8px',border:'1px solid #E5E7EB',borderRadius:6}} /></div>
                          </div>
                          <div style={{marginBottom:8}}><label style={{fontSize:11,color:'#6B7280'}}>장소</label><input value={editForm.location||''} onChange={e=>setEditForm((f:any)=>({...f,location:e.target.value}))} placeholder="장소" style={{width:'100%',fontSize:13,padding:'6px 8px',border:'1px solid #E5E7EB',borderRadius:6}} /></div>
                          <div style={{marginBottom:8}}><label style={{fontSize:11,color:'#6B7280'}}>메모</label><input value={editForm.memo||''} onChange={e=>setEditForm((f:any)=>({...f,memo:e.target.value}))} placeholder="메모" style={{width:'100%',fontSize:13,padding:'6px 8px',border:'1px solid #E5E7EB',borderRadius:6}} /></div>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>handleEdit(m.id)} style={{flex:1,padding:'7px',background:'#1D9E75',color:'white',border:'none',borderRadius:6,fontSize:13,cursor:'pointer'}}>저장</button>
                            <button onClick={()=>setEditId(null)} style={{flex:1,padding:'7px',background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:6,fontSize:13,cursor:'pointer'}}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.actionRow}>
                            <button className={styles.actionBtn} onClick={()=>{setEditId(m.id);setEditForm(m)}}>✏️ 수정</button>
                            {STATUS_OPTIONS.filter(s=>s!==m.status).map(s=>(
                              <button key={s} className={styles.actionBtn} onClick={()=>updateStatus(m.id,s)}>{s}</button>
                            ))}
                            {m.customer_id && (
                              <button className={styles.actionBtn} onClick={()=>{
                                const c=customers.find((c:any)=>c.id===m.customer_id)
                                setSelectedCustomer(c); setShowFlow(true)
                              }}>영업 이력</button>
                            )}
                          </div>
                          {m.customer_id && (
                            <div className={styles.actionRow} style={{marginTop:4}}>
                              {(['existing','prospect','new'] as const).filter(t=>{
                                const c=customers.find((c:any)=>c.id===m.customer_id)
                                return c?.customer_type!==t
                              }).map(t=>(
                                <button key={t} className={styles.actionBtn} style={{fontSize:11,color:'#6B7280'}}
                                  onClick={()=>supabase.from('dpa_customers').update({customer_type:t}).eq('id',m.customer_id).then(()=>fetchAll(agentId))}>
                                  {t==='existing'?'마이고객으로':t==='prospect'?'관심고객으로':'신규로'}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div style={{textAlign:'center',marginTop:8}}>
            <button className={styles.addBtn} onClick={()=>setShowForm(true)}>+ 미팅 추가</button>
          </div>
        </div>
      )}

      {/* ── 지난 미팅 탭 ── */}
      {activeTab === 'past' && (
        <div style={{paddingTop:16}}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>지난 미팅 ({pastMeetings.length}건)</span>
          </div>
          {pastMeetings.length === 0 ? (
            <div className={styles.empty}>지난 미팅 기록이 없어요</div>
          ) : pastMeetings.map(m => {
            const badge = getMeetingBadge(m)
            const dateObj = new Date(m.meeting_date + 'T00:00:00')
            const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
            return (
              <div key={m.id} className={styles.meetingCard} style={{opacity: m.status==='취소' ? 0.6 : 1}}>
                <div className={styles.meetingTop}>
                  <span className={styles.meetingName}>{getMeetingName(m)}</span>
                  <span className={styles.statusBadge} style={{background:badge.bg,color:badge.color}}>{badge.text}</span>
                </div>
                <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>📅 {dateLabel} {m.meeting_time || ''}</div>
                <div className={styles.meetingBottom}>
                  <span className={styles.meetingLocation}>📍 {m.location || '장소 미정'}</span>
                  <span className={styles.typeBadge}>{m.type || '미팅'}</span>
                </div>
                {m.memo && <div style={{fontSize:12,color:'#9CA3AF',marginTop:6}}>💬 {m.memo}</div>}
                {m.customer_id && (
                  <div className={styles.actionRow} style={{marginTop:8}}>
                    <button className={styles.actionBtn} onClick={()=>{
                      const c=customers.find((c:any)=>c.id===m.customer_id)
                      setSelectedCustomer(c); setShowFlow(true)
                    }}>영업 이력</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

            {/* ── 영업 진행 탭 ── */}
      {activeTab === 'flow' && (
        <div style={{paddingTop:16}}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>고객별 영업 진행 현황</span>
            <button className={styles.addBtn} onClick={() => setShowForm(true)}>+ 추가</button>
          </div>

          {customers.length === 0 && (
            <div className={styles.empty}>등록된 고객이 없어요</div>
          )}

          {customers.map(c => {
            const { currentStageIdx } = getCustomerFlow(c.id)
            if (currentStageIdx < 0) return null
            const currentStage = FLOW_STAGES[currentStageIdx]
            return (
              <div key={c.id} className={styles.meetingCard} onClick={() => { setSelectedCustomer(c); setShowFlow(true) }}>
                <div className={styles.meetingTop}>
                  <span className={styles.meetingName}>{c.name}</span>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{c.age}세</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{currentStage.icon}</span>
                  <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>{currentStage.label}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>탭해서 상세 보기 →</span>
                </div>
                {/* 미니 진행바 */}
                <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
                  {FLOW_STAGES.map((s, i) => (
                    <div key={s.key} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: i < currentStageIdx ? '#1D9E75' : i === currentStageIdx ? '#1D9E75' : '#EDEBE4',
                      opacity: i === currentStageIdx ? 1 : i < currentStageIdx ? 0.6 : 0.3,
                    }} />
                  ))}
                </div>
              </div>
            )
          })}

          {customers.filter(c => getCustomerFlow(c.id).currentStageIdx >= 0).length === 0 && (
            <div className={styles.empty}>
              아직 영업 진행 중인 고객이 없어요<br />
              미팅을 추가하면 여기서 진행 현황을 볼 수 있어요 😊
            </div>
          )}
        </div>
      )}

      {/* ── 연락할 고객 탭 ── */}
      {activeTab === 'contact' && (
        <div style={{paddingTop:16}}>

          {/* AI 추천 섹션 */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>AI 추천 연락 고객 ({nearDone.length + birthdayContacts.length}명)</span>
          </div>

          {nearDone.map(c => (
            <div key={c.id} className={styles.contactCard}>
              <span className={styles.contactIcon}>🔥</span>
              <div style={{flex:1}}>
                <div className={styles.contactName}>
                  {c.name}고객
                  <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:'#EFF6FF',color:'#1D4ED8',marginLeft:6,fontWeight:700}}>AI 추천</span>
                </div>
                <div className={styles.contactReason}>완납 임박 → 재설계 제안</div>
              </div>
              <button className={styles.contactBtn} onClick={() => router.push('/customers?sort=완납임박')}>고객 보기</button>
            </div>
          ))}

          {birthdayContacts.map(c => (
            <div key={c.id} className={styles.contactCard}>
              <span className={styles.contactIcon}>🎂</span>
              <div style={{flex:1}}>
                <div className={styles.contactName}>
                  {c.name}고객
                  <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:'#EFF6FF',color:'#1D4ED8',marginLeft:6,fontWeight:700}}>AI 추천</span>
                </div>
                <div className={styles.contactReason}>생일 → 안부 연락</div>
              </div>
              <button className={styles.contactBtn} onClick={() => router.push('/customers?sort=생일임박')}>고객 보기</button>
            </div>
          ))}

          {nearDone.length === 0 && birthdayContacts.length === 0 && (
            <div className={styles.empty} style={{marginBottom:8}}>AI 추천 연락 고객이 없어요 😊</div>
          )}

          {/* 직접 추가 연락 섹션 */}
          <div className={styles.sectionHeader} style={{marginTop:16}}>
            <span className={styles.sectionTitle}>직접 추가 연락 ({contactMeetings.length}건)</span>
            <button className={styles.addBtn} onClick={() => { setForm(f => ({...f, type:'전화'})); setShowForm(true) }}>+ 연락 추가</button>
          </div>

          {contactMeetings.length === 0 ? (
            <div className={styles.empty}>직접 추가한 연락 일정이 없어요</div>
          ) : contactMeetings.map(m => {
            const badge = getMeetingBadge(m)
            const dateObj = new Date(m.meeting_date)
            const dateLabel = `${dateObj.getMonth()+1}/${dateObj.getDate()}(${['일','월','화','수','목','금','토'][dateObj.getDay()]})`
            return (
              <div key={m.id} className={styles.contactCard}>
                <span className={styles.contactIcon}>{m.type === '문자' ? '💬' : '📞'}</span>
                <div style={{flex:1}}>
                  <div className={styles.contactName}>
                    {getMeetingName(m)}고객
                    <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:badge.bg,color:badge.color,marginLeft:6,fontWeight:600}}>{badge.text}</span>
                  </div>
                  <div className={styles.contactReason}>{dateLabel} {m.meeting_time || ''} · {m.type} {m.memo ? `· ${m.memo}` : ''}</div>
                </div>
                <button className={styles.contactBtn} onClick={() => router.push(`/customers`)}>고객 보기</button>
              </div>
            )
          })}

        </div>
      )}

      {/* ── 영업 흐름 팝업 (퀘스트 스타일) ── */}
      {showFlow && selectedCustomer && (
        <div className={styles.flowOverlay} onClick={() => setShowFlow(false)}>
          <div className={styles.flowPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.flowPanelHeader}>
              <span className={styles.flowPanelTitle}>{selectedCustomer.name} 영업 흐름</span>
              <button className={styles.flowClose} onClick={() => setShowFlow(false)}>✕</button>
            </div>

            {(() => {
              const { currentStageIdx, customerMeetings } = getCustomerFlow(selectedCustomer.id)
              return (
                <div className={styles.flowStages}>
                  {FLOW_STAGES.map((stage, i) => {
                    const isDone = i < currentStageIdx
                    const isCurrent = i === currentStageIdx
                    const isLocked = i > currentStageIdx
                    const stageMeetings = customerMeetings.filter(m => m.pipeline_stage === stage.key)
                    const lastMeeting = stageMeetings[stageMeetings.length - 1]

                    return (
                      <div key={stage.key} className={styles.flowStage}>
                        {i < FLOW_STAGES.length - 1 && (
                          <div className={[styles.flowLine, isDone ? styles.done : ''].join(' ')} />
                        )}
                        <div className={styles.flowStageInner}>
                          <div className={[styles.flowDot, isDone ? styles.done : isCurrent ? styles.current : styles.locked].join(' ')}>
                            {isDone ? '✓' : stage.icon}
                          </div>
                          <div className={styles.flowContent}>
                            <div>
                              <span className={[styles.flowStageName, isDone ? styles.done : isCurrent ? styles.current : styles.locked].join(' ')}>
                                {stage.label}
                              </span>
                              {isCurrent && <span className={styles.flowCurrentBadge}>진행중</span>}
                            </div>
                            {lastMeeting && (
                              <div className={styles.flowStageDate}>
                                {lastMeeting.meeting_date} {lastMeeting.meeting_time && `· ${lastMeeting.meeting_time}`}
                                {lastMeeting.location && ` · ${lastMeeting.location}`}
                              </div>
                            )}
                            {lastMeeting?.memo && (
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>💬 {lastMeeting.memo}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <button className={styles.submitBtn} style={{ marginTop: 20 }} onClick={() => {
              setShowFlow(false)
              setForm(f => ({ ...f, customer_id: selectedCustomer.id }))
              setIsNewProspect(false)
              setShowForm(true)
            }}>+ 다음 단계 추가</button>
          </div>
        </div>
      )}

      {/* ── 미팅 추가 폼 (슬라이드업) ── */}
      {showForm && (
        <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.formPanel} onClick={e => e.stopPropagation()}>
            <button className={styles.formClose} onClick={() => setShowForm(false)}>✕</button>
            <div className={styles.formTitle}>미팅 / 접촉 추가</div>

            <div className={styles.toggleRow}>
              <button className={[styles.toggleBtn, !isNewProspect ? styles.on : ''].join(' ')} onClick={() => setIsNewProspect(false)}>기존 고객</button>
              <button className={[styles.toggleBtn, isNewProspect ? styles.on : ''].join(' ')} onClick={() => setIsNewProspect(true)}>신규 (미등록)</button>
            </div>

            {!isNewProspect && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>고객 선택</label>
                <select className={styles.formSelect} value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">고객 선택</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.age}세)</option>)}
                </select>
              </div>
            )}

            {isNewProspect && (
              <>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>이름 *</label>
                    <input className={styles.formInput} placeholder="홍길동" value={form.prospect_name} onChange={e => setForm(f => ({ ...f, prospect_name: e.target.value }))} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>연락처</label>
                    <input className={styles.formInput} placeholder="010-0000-0000" value={form.prospect_phone} onChange={e => setForm(f => ({ ...f, prospect_phone: e.target.value }))} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>소개자</label>
                  <input className={styles.formInput} placeholder="김OO 소개" value={form.introducer} onChange={e => setForm(f => ({ ...f, introducer: e.target.value }))} />
                </div>
              </>
            )}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>날짜 *</label>
                <input type="date" className={styles.formInput} value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>시간</label>
                <input type="time" className={styles.formInput} value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>장소</label>
              <input className={styles.formInput} placeholder="스타벅스 강남점" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>접촉 유형</label>
                <select className={styles.formSelect} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>상태</label>
                <select className={styles.formSelect} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>영업 단계</label>
              <select className={styles.formSelect} value={form.pipeline_stage} onChange={e => setForm(f => ({ ...f, pipeline_stage: e.target.value }))}>
                {FLOW_STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>메모</label>
              <input className={styles.formInput} placeholder="특이사항 메모" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
            </div>

            <button className={styles.submitBtn} onClick={handleSubmit}>저장하기</button>
          </div>
        </div>
      )}

    </div>
  )
}
