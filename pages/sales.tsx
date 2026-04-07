import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import styles from '../styles/Sales.module.css'

const PIPELINE_STAGES = ['신규접촉', '미팅잡기', '미팅완료', '계약검토', '계약완료']
const STATUS_OPTIONS = ['대기', '확정', '취소', '완료']

export default function Sales() {
  const router = useRouter()
  const [agentId, setAgentId] = useState('')
  const [meetings, setMeetings] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'pipeline' | 'contact'>('today')
  const [showForm, setShowForm] = useState(false)
  const [isNewProspect, setIsNewProspect] = useState(false)

  // 폼 상태
  const [form, setForm] = useState({
    customer_id: '',
    prospect_name: '',
    prospect_phone: '',
    introducer: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    location: '',
    status: '대기',
    pipeline_stage: '신규접촉',
    memo: '',
  })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  useEffect(() => {
    init()
  }, [])

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

  // 오늘 미팅
  const todayMeetings = meetings.filter(m => m.meeting_date === todayStr)
  // 전체 예정 미팅 (오늘 포함 이후)
  const upcomingMeetings = meetings.filter(m => m.meeting_date >= todayStr && m.status !== '취소' && m.status !== '완료')

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

  // 파이프라인 카운트
  const pipelineCounts = PIPELINE_STAGES.map(stage =>
    meetings.filter(m => m.pipeline_stage === stage && m.status !== '취소').length
  )

  // 미팅 이름 표시
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

  async function handleSubmit() {
    if (!form.meeting_date) return alert('날짜를 입력해주세요')
    if (isNewProspect && !form.prospect_name) return alert('이름을 입력해주세요')
    if (!isNewProspect && !form.customer_id) return alert('고객을 선택해주세요')

    const payload: any = {
      agent_id: agentId,
      meeting_date: form.meeting_date,
      meeting_time: form.meeting_time,
      location: form.location,
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
    setForm({ customer_id: '', prospect_name: '', prospect_phone: '', introducer: '', meeting_date: todayStr, meeting_time: '', location: '', status: '대기', pipeline_stage: '신규접촉', memo: '' })
    await fetchAll(agentId)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('dpa_meetings').update({ status }).eq('id', id)
    if (status === '취소') {
      const m = meetings.find(m => m.id === id)
      await supabase.from('dpa_meetings').update({ cancel_count: (m?.cancel_count || 0) + 1 }).eq('id', id)
    }
    await fetchAll(agentId)
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={[styles.tab, activeTab === 'today' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('today')}>📅 미팅 일정</button>
        <button className={[styles.tab, activeTab === 'pipeline' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('pipeline')}>📊 파이프라인</button>
        <button className={[styles.tab, activeTab === 'contact' ? styles.active : ''].join(' ')} onClick={() => setActiveTab('contact')}>📞 연락할 고객</button>
      </div>

      {/* 미팅 일정 탭 */}
      {activeTab === 'today' && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>오늘 미팅 ({todayMeetings.length}건)</span>
            <button className={styles.addBtn} onClick={() => setShowForm(true)}>+ 미팅 추가</button>
          </div>

          {todayMeetings.length === 0 && (
            <div className={styles.empty}>오늘 미팅이 없어요 😊</div>
          )}

          {todayMeetings.map(m => (
            <div key={m.id} className={styles.meetingCard}>
              <div className={styles.meetingTop}>
                <span className={styles.meetingName}>{getMeetingName(m)}</span>
                <span className={styles.meetingTime}>{m.meeting_time || '시간 미정'}</span>
                <span className={[styles.statusBadge, getStatusClass(m.status)].join(' ')}>{m.status}</span>
              </div>
              <div className={styles.meetingBottom}>
                <span className={styles.meetingLocation}>📍 {m.location || '장소 미정'}</span>
                {m.cancel_count > 0 && <span className={styles.cancelWarn}>⚠ 취소 {m.cancel_count}회</span>}
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{m.pipeline_stage}</span>
              </div>
              {m.memo && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>💬 {m.memo}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {STATUS_OPTIONS.filter(s => s !== m.status).map(s => (
                  <button key={s} onClick={() => updateStatus(m.id, s)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #EDEBE4', background: 'white', color: '#6B7280', cursor: 'pointer' }}>{s}으로 변경</button>
                ))}
              </div>
            </div>
          ))}

          {/* 예정 미팅 */}
          {upcomingMeetings.filter(m => m.meeting_date !== todayStr).length > 0 && (
            <>
              <div className={styles.sectionHeader} style={{ marginTop: 20 }}>
                <span className={styles.sectionTitle}>예정 미팅</span>
              </div>
              {upcomingMeetings.filter(m => m.meeting_date !== todayStr).map(m => (
                <div key={m.id} className={styles.meetingCard}>
                  <div className={styles.meetingTop}>
                    <span className={styles.meetingName}>{getMeetingName(m)}</span>
                    <span className={styles.meetingTime}>{m.meeting_date} {m.meeting_time}</span>
                    <span className={[styles.statusBadge, getStatusClass(m.status)].join(' ')}>{m.status}</span>
                  </div>
                  <div className={styles.meetingBottom}>
                    <span className={styles.meetingLocation}>📍 {m.location || '장소 미정'}</span>
                    {m.cancel_count > 0 && <span className={styles.cancelWarn}>⚠ 취소 {m.cancel_count}회</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* 파이프라인 탭 */}
      {activeTab === 'pipeline' && (
        <>
          <div className={styles.pipeline}>
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className={[styles.pipeStage, pipelineCounts[i] > 0 ? styles.active : ''].join(' ')}>
                <div className={styles.stageName}>{stage}</div>
                <div className={styles.stageCount}>{pipelineCounts[i]}</div>
              </div>
            ))}
          </div>

          {PIPELINE_STAGES.map(stage => {
            const stageMeetings = meetings.filter(m => m.pipeline_stage === stage && m.status !== '취소')
            if (stageMeetings.length === 0) return null
            return (
              <div key={stage}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{stage} ({stageMeetings.length})</span>
                </div>
                {stageMeetings.map(m => (
                  <div key={m.id} className={styles.meetingCard}>
                    <div className={styles.meetingTop}>
                      <span className={styles.meetingName}>{getMeetingName(m)}</span>
                      <span className={styles.meetingTime}>{m.meeting_date}</span>
                      <span className={[styles.statusBadge, getStatusClass(m.status)].join(' ')}>{m.status}</span>
                    </div>
                    {m.memo && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>💬 {m.memo}</div>}
                  </div>
                ))}
              </div>
            )
          })}

          {meetings.filter(m => m.status !== '취소').length === 0 && (
            <div className={styles.empty}>파이프라인에 미팅이 없어요<br />미팅을 추가해봐요! 😊</div>
          )}

          <button className={styles.addBtn} onClick={() => setShowForm(true)} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>+ 미팅 추가</button>
        </>
      )}

      {/* 연락할 고객 탭 */}
      {activeTab === 'contact' && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>오늘 연락할 고객</span>
          </div>

          {nearDone.map(c => (
            <div key={c.id} className={styles.contactCard}>
              <span className={styles.contactIcon}>🔥</span>
              <div>
                <div className={styles.contactName}>{c.name}</div>
                <div className={styles.contactReason}>완납 임박 → 재설계 제안</div>
              </div>
              <button className={styles.contactBtn} onClick={() => router.push('/customers')}>고객 보기</button>
            </div>
          ))}

          {birthdayContacts.map(c => (
            <div key={c.id} className={styles.contactCard}>
              <span className={styles.contactIcon}>🎂</span>
              <div>
                <div className={styles.contactName}>{c.name}</div>
                <div className={styles.contactReason}>생일 → 안부 연락</div>
              </div>
              <button className={styles.contactBtn} onClick={() => router.push('/customers')}>고객 보기</button>
            </div>
          ))}

          {nearDone.length === 0 && birthdayContacts.length === 0 && (
            <div className={styles.empty}>오늘 연락할 고객이 없어요 😊</div>
          )}
        </>
      )}

      {/* 미팅 추가 폼 */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.formPanel} onClick={e => e.stopPropagation()}>
            <button className={styles.formClose} onClick={() => setShowForm(false)}>✕</button>
            <div className={styles.formTitle}>미팅 추가</div>

            {/* 기존 고객 / 신규 토글 */}
            <div className={styles.toggleRow}>
              <button className={[styles.toggleBtn, !isNewProspect ? styles.on : ''].join(' ')} onClick={() => setIsNewProspect(false)}>기존 고객</button>
              <button className={[styles.toggleBtn, isNewProspect ? styles.on : ''].join(' ')} onClick={() => setIsNewProspect(true)}>신규 (미등록)</button>
            </div>

            {/* 기존 고객 선택 */}
            {!isNewProspect && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>고객 선택</label>
                <select className={styles.formSelect} value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">고객 선택</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.age}세)</option>
                  ))}
                </select>
              </div>
            )}

            {/* 신규 입력 */}
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

            {/* 날짜 / 시간 */}
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

            {/* 장소 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>장소</label>
              <input className={styles.formInput} placeholder="스타벅스 강남점" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            {/* 상태 / 파이프라인 */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>상태</label>
                <select className={styles.formSelect} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>단계</label>
                <select className={styles.formSelect} value={form.pipeline_stage} onChange={e => setForm(f => ({ ...f, pipeline_stage: e.target.value }))}>
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 메모 */}
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
