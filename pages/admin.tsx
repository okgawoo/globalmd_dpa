import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import styles from '../styles/Admin.module.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [validations, setValidations] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'urls'>('dashboard')
  const fileRef = useRef<HTMLInputElement>(null)

  const [topMenu, setTopMenu] = useState<'공지사항' | '설계사' | '유튜브' | '보험공시'>('공지사항')

  const [ytChannels, setYtChannels] = useState<any[]>([])
  const [ytFormOpen, setYtFormOpen] = useState(false)
  const [ytSaving, setYtSaving] = useState(false)
  const [ytEditId, setYtEditId] = useState<string | null>(null)
  const [ytForm, setYtForm] = useState({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
  const [ytSelectedChannel, setYtSelectedChannel] = useState<any | null>(null)
  const [ytVideos, setYtVideos] = useState<any[]>([])
  const [ytVideoFormOpen, setYtVideoFormOpen] = useState(false)
  const [ytVideoUrl, setYtVideoUrl] = useState('')
  const [ytVideoTitle, setYtVideoTitle] = useState('')
  const [ytVideoAdding, setYtVideoAdding] = useState(false)
  const [ytSelectedVideo, setYtSelectedVideo] = useState<any | null>(null)
  const [ytAnalysis, setYtAnalysis] = useState<any | null>(null)
  const [ytAnalyzing, setYtAnalyzing] = useState<string | null>(null)
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [pushUrl, setPushUrl] = useState('')
  const [pushSending, setPushSending] = useState(false)
  const [pushResult, setPushResult] = useState<any>(null)
  const [pushHistory, setPushHistory] = useState<any[]>([])
  const [subCount, setSubCount] = useState(0)

  const [smsAuthList, setSmsAuthList] = useState<any[]>([])
  const [resending, setResending] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<Record<string, string>>({})
  const [agentList, setAgentList] = useState<any[]>([])

  useEffect(() => {
    checkUser()
    fetchData()
    fetchPushData()
  }, [])

  useEffect(() => {
    if (topMenu === '설계사') fetchAgentList()
    if (topMenu === '유튜브') fetchYtChannels()
  }, [topMenu])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  async function fetchData() {
    const [{ data: src }, { data: cats }, { data: vals }] = await Promise.all([
      supabase.from('dpa_insurance_sources').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('dpa_insurance_categories').select('*').order('source').order('sort_order'),
      supabase.from('dpa_insurance_validations').select('*, dpa_insurance_sources(source, category)').order('created_at', { ascending: false }).limit(50)
    ])
    setSources(src || [])
    setCategories(cats || [])
    setValidations(vals || [])
  }

  async function fetchPushData() {
    const [{ data: history }, { count }] = await Promise.all([
      supabase.from('push_notifications').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true })
    ])
    setPushHistory(history || [])
    setSubCount(count || 0)
  }

  async function fetchSmsAuthList() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin-agents', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
    if (res.ok) { const data = await res.json(); setSmsAuthList(data.smsAuthList || []) }
  }

  async function fetchYtChannels() {
    const { data } = await supabase.from('youtube_channels').select('*').order('created_at', { ascending: false })
    setYtChannels(data || [])
  }

  async function selectYtChannel(ch: any) {
    setYtSelectedChannel(ch)
    setYtSelectedVideo(null)
    setYtAnalysis(null)
    setYtVideoFormOpen(false)
    const { data } = await supabase
      .from('youtube_videos')
      .select('*')
      .eq('channel_id', ch.id)
      .order('created_at', { ascending: false })
    setYtVideos(data || [])
  }

  async function addYtVideo() {
    if (!ytVideoUrl.trim() || !ytSelectedChannel) return
    const match = ytVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (!match) { alert('올바른 YouTube URL을 입력해주세요'); return }
    const videoId = match[1]
    setYtVideoAdding(true)
    await supabase.from('youtube_videos').insert([{
      channel_id: ytSelectedChannel.id,
      video_id: videoId,
      video_url: ytVideoUrl,
      title: ytVideoTitle || null,
      status: 'pending',
    }])
    setYtVideoUrl('')
    setYtVideoTitle('')
    setYtVideoFormOpen(false)
    setYtVideoAdding(false)
    selectYtChannel(ytSelectedChannel)
  }

  async function deleteYtVideo(id: string) {
    if (!confirm('영상을 삭제하시겠습니까?')) return
    await supabase.from('youtube_videos').delete().eq('id', id)
    selectYtChannel(ytSelectedChannel)
  }

  async function analyzeYtVideo(video: any) {
    setYtAnalyzing(video.id)
    try {
      const res = await fetch('/api/youtube-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoRowId: video.id }),
      })
      const data = await res.json()
      if (data.success) {
        selectYtChannel(ytSelectedChannel)
        fetchYtAnalysis(video.id)
      } else {
        alert(`분석 실패: ${data.error}`)
        selectYtChannel(ytSelectedChannel)
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`)
    }
    setYtAnalyzing(null)
  }

  async function fetchYtAnalysis(videoId: string) {
    const { data } = await supabase
      .from('youtube_analyses')
      .select('*')
      .eq('video_id', videoId)
      .single()
    setYtAnalysis(data || null)
  }

  async function selectYtVideo(v: any) {
    setYtSelectedVideo(v)
    setYtAnalysis(null)
    if (v.status === 'done') await fetchYtAnalysis(v.id)
  }

  async function saveYtChannel() {
    if (!ytForm.name.trim() || !ytForm.channel_url.trim()) { alert('채널명과 URL을 입력해주세요'); return }
    setYtSaving(true)
    if (ytEditId) {
      await supabase.from('youtube_channels').update({ ...ytForm, updated_at: new Date().toISOString() }).eq('id', ytEditId)
    } else {
      await supabase.from('youtube_channels').insert([ytForm])
    }
    setYtSaving(false)
    setYtFormOpen(false)
    setYtEditId(null)
    setYtForm({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
    fetchYtChannels()
  }

  async function deleteYtChannel(id: string) {
    if (!confirm('채널을 삭제하시겠습니까?')) return
    await supabase.from('youtube_channels').delete().eq('id', id)
    fetchYtChannels()
  }

  async function toggleYtActive(id: string, current: boolean) {
    await supabase.from('youtube_channels').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id)
    fetchYtChannels()
  }

  async function fetchAgentList() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin-agents', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
    if (res.ok) { const data = await res.json(); setAgentList(data.agents || []); setSmsAuthList(data.smsAuthList || []) }
  }

  async function resendSmsAuthDocs(auth: any) {
    setResending(auth.id)
    setResendResult(prev => ({ ...prev, [auth.id]: '' }))
    try {
      const res = await fetch('/api/sms-auth-resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authId: auth.id }) })
      const data = await res.json()
      setResendResult(prev => ({ ...prev, [auth.id]: data.success ? '발송 완료' : `실패: ${data.error}` }))
    } catch (err: any) {
      setResendResult(prev => ({ ...prev, [auth.id]: `오류: ${err.message}` }))
    } finally { setResending(null) }
  }

  async function sendPush() {
    if (!pushTitle.trim() || !pushBody.trim()) { alert('제목과 내용을 입력해주세요'); return }
    if (!confirm(`${subCount}명에게 공지를 발송하시겠습니까?`)) return
    setPushSending(true); setPushResult(null)
    try {
      const res = await fetch('/api/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: pushTitle, body: pushBody, url: pushUrl || null }) })
      const data = await res.json()
      setPushResult(data)
      if (data.success) { setPushTitle(''); setPushBody(''); setPushUrl(''); fetchPushData() }
    } catch (err: any) { setPushResult({ error: err.message }) }
    setPushSending(false)
  }

  async function uploadFile(file: File) {
    setUploading(true); setUploadResult(null)
    try {
      if (file.name.endsWith('.pdf')) {
        const fileName = `guides/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('insurance-files').upload(fileName, file, { contentType: 'application/pdf' })
        if (error) throw new Error(error.message)
        setUploadResult({ success: true, isPdf: true, fileName: file.name, filePath: fileName })
      } else {
        const formData = new FormData(); formData.append('file', file)
        const res = await fetch('/api/insurance-upload', { method: 'POST', body: formData })
        const result = await res.json(); setUploadResult(result)
        if (result.success) fetchData()
      }
    } catch (err: any) { setUploadResult({ success: false, error: err.message || '업로드 실패' })
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    for (const file of files) await uploadFile(file)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    for (const file of Array.from(e.dataTransfer.files || [])) await uploadFile(file)
  }

  function getSourceStatus(source: string, category: string) {
    return sources.find(s => s.source === source && s.category === category)
  }

  const lifeCategories = categories.filter(c => c.source === 'life')
  const damageCategories = categories.filter(c => c.source === 'damage')
  const totalUploaded = sources.length
  const totalCategories = categories.length
  const uploadRate = totalCategories > 0 ? Math.round((totalUploaded / totalCategories) * 100) : 0
  const recentValidationErrors = validations.filter(v => v.severity === 'error').length

  const TAB_ITEMS: { key: '공지사항' | '설계사' | '유튜브' | '보험공시'; label: string }[] = [
    { key: '공지사항', label: '공지사항 관리' },
    { key: '설계사', label: '설계사 관리' },
    { key: '유튜브', label: 'YouTube 채널' },
    { key: '보험공시', label: '보험 공시 관리' },
  ]

  const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '11px 16px',
    fontSize: 14,
    borderBottom: '1px solid #E5E7EB',
    color: '#1A1A2E',
    ...extra,
  })

  const badge = (bg: string, color: string, text: string) => (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: bg, color }}>{text}</span>
  )

  const isPushDisabled = pushSending || !pushTitle.trim() || !pushBody.trim()

  return (
    <div className={styles.page}>

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>관리자 페이지</h1>
          <p className={styles.pageSub}>시스템 관리 전용 페이지입니다</p>
        </div>
      </div>

      {/* 상위 탭 */}
      <div className={styles.card} style={{ marginBottom: 20, overflow: 'visible' }}>
        <div className={styles.tabBar}>
          {TAB_ITEMS.map(({ key, label }) => (
            <button key={key} onClick={() => setTopMenu(key)}
              className={[styles.tabBtn, topMenu === key ? styles.tabActive : ''].join(' ')}>
              {label}
            </button>
          ))}
        </div>

        {/* 보험공시 서브탭 */}
        {topMenu === '보험공시' && (
          <div className={styles.subTabBar}>
            {[
              { key: 'dashboard', label: '현황 대시보드' },
              { key: 'upload', label: '파일 업로드' },
              { key: 'urls', label: 'URL 목록' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={[styles.subTabBtn, activeTab === tab.key ? styles.subTabActive : ''].join(' ')}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== 공지사항 관리 ===== */}
      {topMenu === '공지사항' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 푸시 발송 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitle}>푸시 알림 발송</p>
                <p className={styles.cardSub}>
                  현재 구독자 <span className={styles.cardAccent}>{subCount}명</span>
                </p>
              </div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className={styles.fieldLabel}>제목</label>
                <input className={styles.fieldInput} value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="공지사항 제목을 입력하세요" />
              </div>
              <div>
                <label className={styles.fieldLabel}>내용</label>
                <textarea className={styles.fieldTextarea} value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="공지사항 내용을 입력하세요" rows={4} />
              </div>
              <div>
                <label className={styles.fieldLabel}>클릭 시 이동 URL</label>
                <input className={styles.fieldInput} value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="예: /notifications (선택사항)" />
              </div>
              <button onClick={sendPush} disabled={isPushDisabled}
                className={[styles.sendBtn, isPushDisabled ? styles.sendBtnDisabled : styles.sendBtnActive].join(' ')}>
                {pushSending ? '발송 중...' : `${subCount}명에게 푸시 발송`}
              </button>
              {pushResult && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: pushResult.success ? '#D1FAE5' : '#FEE2E2', color: pushResult.success ? '#065F46' : '#991B1B', fontSize: 13 }}>
                  {pushResult.success ? `발송 완료 · ${pushResult.sent}/${pushResult.total}명 성공` : `발송 실패: ${pushResult.error}`}
                </div>
              )}
            </div>
          </div>

          {/* 발송 이력 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>발송 이력</p>
            </div>
            {pushHistory.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>아직 발송 이력이 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['발송일', '제목', '내용', '발송 수'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {pushHistory.map(n => (
                    <tr key={n.id}>
                      <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                        {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle({ fontWeight: 500 })}>{n.title}</td>
                      <td style={tdStyle({ color: '#636B78', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{n.body}</td>
                      <td style={tdStyle()}>{badge('#D1FAE5', '#065F46', `${n.sent_count}명`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== 설계사 관리 ===== */}
      {topMenu === '설계사' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 설계사 목록 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p className={styles.cardTitle}>설계사 목록</p>
                <span style={{ fontSize: 13, color: '#8892A0' }}>총 {agentList.length}명</span>
              </div>
              <button className={styles.refreshBtn} onClick={fetchAgentList}>새로고침</button>
            </div>
            {agentList.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>설계사가 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['이름', '이메일', '연락처', '요금제', '상태', '가입일'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {agentList.map(agent => (
                    <tr key={agent.id}>
                      <td style={tdStyle({ fontWeight: 600 })}>{agent.name}</td>
                      <td style={tdStyle({ color: '#636B78' })}>{agent.email}</td>
                      <td style={tdStyle()}>{agent.phone}</td>
                      <td style={tdStyle()}>
                        {badge(
                          agent.plan_type === 'pro' ? '#5E6AD2' : agent.plan_type === 'standard' ? '#3B82F6' : agent.plan_type === 'demo' ? '#F59E0B' : '#9CA3AF',
                          '#fff',
                          agent.plan_type?.toUpperCase() || 'BASIC'
                        )}
                      </td>
                      <td style={tdStyle()}>
                        {badge(
                          agent.status === 'approved' ? '#D1FAE5' : agent.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                          agent.status === 'approved' ? '#065F46' : agent.status === 'pending' ? '#92400E' : '#991B1B',
                          agent.status === 'approved' ? '승인' : agent.status === 'pending' ? '대기' : '반려'
                        )}
                      </td>
                      <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                        {new Date(agent.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 발신번호 신청 목록 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>발신번호 등록 신청 목록</p>
              <button className={styles.refreshBtn} onClick={fetchSmsAuthList}>새로고침</button>
            </div>
            {smsAuthList.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>신청 내역이 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['신청일', '이름', '발신번호', '생년월일', '상태', '서류 재발송'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {smsAuthList.map(auth => (
                    <tr key={auth.id}>
                      <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                        {new Date(auth.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle({ fontWeight: 600 })}>{auth.agent_name}</td>
                      <td style={tdStyle()}>{auth.sender_phone}</td>
                      <td style={tdStyle({ color: '#636B78' })}>{auth.birth_date}</td>
                      <td style={tdStyle()}>
                        {badge(
                          auth.status === 'approved' ? '#D1FAE5' : auth.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                          auth.status === 'approved' ? '#065F46' : auth.status === 'pending' ? '#92400E' : '#991B1B',
                          auth.status === 'approved' ? '승인완료' : auth.status === 'pending' ? '검토중' : '반려'
                        )}
                      </td>
                      <td style={tdStyle()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className={styles.primaryBtn} onClick={() => resendSmsAuthDocs(auth)}
                            disabled={resending === auth.id}
                            style={{ opacity: resending === auth.id ? 0.6 : 1 }}>
                            {resending === auth.id ? '발송 중...' : '서류 재발송'}
                          </button>
                          {resendResult[auth.id] && (
                            <span style={{ fontSize: 12, color: resendResult[auth.id].startsWith('발송') ? '#065F46' : '#991B1B' }}>{resendResult[auth.id]}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== YouTube 채널 관리 ===== */}
      {topMenu === '유튜브' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 210px)', minHeight: 500 }}>

          {/* ── 왼쪽: 채널 목록 ── */}
          <div className={styles.card} style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>채널 목록</p>
              <button className={styles.primaryBtn} onClick={() => {
                setYtEditId(null)
                setYtForm({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
                setYtFormOpen(true)
              }}>+ 추가</button>
            </div>

            {/* 채널 추가/편집 폼 */}
            {ytFormOpen && (
              <div style={{ padding: 14, borderBottom: '1px solid #E5E7EB', background: '#F7F8FA', flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: '0 0 10px' }}>
                  {ytEditId ? '채널 편집' : '채널 추가'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label className={styles.fieldLabel}>채널명 *</label>
                    <input className={styles.fieldInput} placeholder="보험명의 정닥터" value={ytForm.name}
                      onChange={e => setYtForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>핸들</label>
                    <input className={styles.fieldInput} placeholder="@보험명의정닥터" value={ytForm.handle}
                      onChange={e => setYtForm(p => ({ ...p, handle: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>채널 URL *</label>
                    <input className={styles.fieldInput} placeholder="https://www.youtube.com/@..." value={ytForm.channel_url}
                      onChange={e => setYtForm(p => ({ ...p, channel_url: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>구독자 수</label>
                    <input className={styles.fieldInput} placeholder="11만명" value={ytForm.subscriber_count}
                      onChange={e => setYtForm(p => ({ ...p, subscriber_count: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>요약</label>
                    <textarea className={styles.fieldTextarea} rows={2}
                      placeholder="채널 특징, 전환율이 높은 이유 등 메모"
                      value={ytForm.summary}
                      onChange={e => setYtForm(p => ({ ...p, summary: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.refreshBtn} onClick={() => { setYtFormOpen(false); setYtEditId(null) }}>취소</button>
                    <button className={styles.primaryBtn} style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={saveYtChannel} disabled={ytSaving}>
                      {ytSaving ? '저장 중...' : ytEditId ? '수정' : '추가'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 채널 리스트 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {ytChannels.length === 0 ? (
                <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>채널을 추가해보세요</p>
              ) : ytChannels.map(ch => (
                <div key={ch.id}
                  onClick={() => selectYtChannel(ch)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #E5E7EB',
                    borderLeft: `3px solid ${ytSelectedChannel?.id === ch.id ? '#5E6AD2' : 'transparent'}`,
                    background: ytSelectedChannel?.id === ch.id ? '#F0F0FD' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (ytSelectedChannel?.id !== ch.id) e.currentTarget.style.background = '#F7F8FA' }}
                  onMouseLeave={e => { if (ytSelectedChannel?.id !== ch.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ytSelectedChannel?.id === ch.id ? '#5E6AD2' : '#1A1A2E' }}>
                      {ch.name}
                    </span>
                    {badge(ch.is_active ? '#D1FAE5' : '#F3F4F6', ch.is_active ? '#065F46' : '#6B7280', ch.is_active ? '활성' : '비활성')}
                  </div>
                  <div style={{ fontSize: 11, color: '#8892A0' }}>
                    {ch.handle && <span>{ch.handle}</span>}
                    {ch.subscriber_count && <span> · {ch.subscriber_count}</span>}
                  </div>
                  {ch.summary && (
                    <div style={{ fontSize: 11, color: '#8892A0', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.summary}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                    <button className={styles.refreshBtn} style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        setYtEditId(ch.id)
                        setYtForm({ name: ch.name, handle: ch.handle || '', channel_url: ch.channel_url, summary: ch.summary || '', subscriber_count: ch.subscriber_count || '' })
                        setYtFormOpen(true)
                      }}>편집</button>
                    <button className={styles.refreshBtn} style={{ fontSize: 11, padding: '2px 8px', color: '#991B1B' }}
                      onClick={() => deleteYtChannel(ch.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 영상 목록 + 분석 결과 ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', minWidth: 0 }}>
            {!ytSelectedChannel ? (
              <div className={styles.card} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 14, color: '#8892A0', textAlign: 'center', lineHeight: 1.8 }}>
                  왼쪽에서 채널을 선택하세요
                </p>
              </div>
            ) : (
              <>
                {/* 영상 목록 카드 */}
                <div className={styles.card} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p className={styles.cardTitle}>{ytSelectedChannel.name}</p>
                      <span style={{ fontSize: 13, color: '#8892A0' }}>영상 {ytVideos.length}개</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={ytSelectedChannel.channel_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#5E6AD2', textDecoration: 'none', padding: '5px 10px', border: '1px solid #5E6AD2', borderRadius: 6 }}>
                        채널 열기
                      </a>
                      <button className={styles.primaryBtn} onClick={() => setYtVideoFormOpen(v => !v)}>
                        + 영상 추가
                      </button>
                    </div>
                  </div>

                  {/* 영상 추가 폼 */}
                  {ytVideoFormOpen && (
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F7F8FA', flexShrink: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label className={styles.fieldLabel}>YouTube URL *</label>
                          <input className={styles.fieldInput} placeholder="https://www.youtube.com/watch?v=..."
                            value={ytVideoUrl} onChange={e => setYtVideoUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>영상 제목 (선택)</label>
                          <input className={styles.fieldInput} placeholder="제목 직접 입력"
                            value={ytVideoTitle} onChange={e => setYtVideoTitle(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className={styles.refreshBtn} onClick={() => setYtVideoFormOpen(false)}>취소</button>
                        <button className={styles.primaryBtn} style={{ padding: '7px 20px', fontSize: 13 }}
                          onClick={addYtVideo} disabled={ytVideoAdding}>
                          {ytVideoAdding ? '추가 중...' : '영상 추가'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 영상 테이블 */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {ytVideos.length === 0 ? (
                      <p style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>
                        영상을 추가해보세요
                      </p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          {['영상', '상태', '등록일', '분석'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {ytVideos.map(v => (
                            <tr key={v.id}
                              onClick={() => selectYtVideo(v)}
                              style={{ cursor: 'pointer', background: ytSelectedVideo?.id === v.id ? '#F0F0FD' : 'transparent' }}
                              onMouseEnter={e => { if (ytSelectedVideo?.id !== v.id) e.currentTarget.style.background = '#F7F8FA' }}
                              onMouseLeave={e => { if (ytSelectedVideo?.id !== v.id) e.currentTarget.style.background = 'transparent' }}
                            >
                              <td style={tdStyle({ maxWidth: 300 })}>
                                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v.title || `영상 (${v.video_id})`}
                                </div>
                                <a href={v.video_url} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: 11, color: '#5E6AD2', textDecoration: 'none' }}>
                                  youtu.be/{v.video_id}
                                </a>
                              </td>
                              <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                                {v.status === 'done' && badge('#D1FAE5', '#065F46', '분석완료')}
                                {v.status === 'pending' && badge('#F3F4F6', '#6B7280', '미분석')}
                                {v.status === 'analyzing' && badge('#EFF6FF', '#1D4ED8', '분석중...')}
                                {v.status === 'error' && badge('#FEE2E2', '#991B1B', '오류')}
                              </td>
                              <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap', fontSize: 12 })}>
                                {new Date(v.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </td>
                              <td style={tdStyle()} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button className={styles.primaryBtn}
                                    style={{ fontSize: 12, padding: '4px 12px', opacity: ytAnalyzing === v.id ? 0.6 : 1 }}
                                    disabled={ytAnalyzing === v.id || v.status === 'analyzing'}
                                    onClick={() => analyzeYtVideo(v)}>
                                    {ytAnalyzing === v.id ? '분석중...' : v.status === 'done' ? '재분석' : '분석하기'}
                                  </button>
                                  <button className={styles.refreshBtn} style={{ fontSize: 12, color: '#991B1B' }}
                                    onClick={() => deleteYtVideo(v.id)}>삭제</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* 분석 결과 카드 */}
                {ytSelectedVideo && (
                  <div className={styles.card} style={{ flexShrink: 0, maxHeight: 320, overflowY: 'auto' }}>
                    <div className={styles.cardHeader} style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <p className={styles.cardTitle}>
                        분석 결과 — {ytSelectedVideo.title || ytSelectedVideo.video_id}
                      </p>
                      {ytSelectedVideo.status === 'error' && (
                        <span style={{ fontSize: 12, color: '#991B1B' }}>{ytSelectedVideo.error_message}</span>
                      )}
                    </div>
                    {!ytAnalysis ? (
                      <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>
                        {ytSelectedVideo.status === 'pending' ? '분석하기 버튼을 눌러주세요' :
                          ytSelectedVideo.status === 'error' ? '분석 중 오류가 발생했습니다. 재분석해보세요.' :
                            '분석 결과를 불러오는 중...'}
                      </p>
                    ) : (
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* 요약 */}
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>요약</p>
                          <p style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.7, margin: 0 }}>{ytAnalysis.summary}</p>
                        </div>
                        {/* 핵심 포인트 */}
                        {ytAnalysis.key_points?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>핵심 포인트</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.key_points.map((p: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 피칭 포인트 */}
                        {ytAnalysis.pitch_points?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>피칭 포인트</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.pitch_points.map((p: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 화법 */}
                        {ytAnalysis.scripts?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>화법 예시</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ytAnalysis.scripts.map((s: string, i: number) => (
                                <div key={i} style={{ background: '#F0F0FD', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #5E6AD2', fontSize: 13, color: '#3D47B5', lineHeight: 1.6 }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 비교 기준 */}
                        {ytAnalysis.comparison_criteria?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>비교 기준</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.comparison_criteria.map((c: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: '#8892A0', margin: 0 }}>
                          분석일: {new Date(ytAnalysis.analyzed_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 보험 공시 관리 ===== */}
      {topMenu === '보험공시' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 현황 대시보드 */}
          {activeTab === 'dashboard' && (<>
            <div className={styles.statGrid}>
              {[
                { label: '전체 카테고리', value: totalCategories },
                { label: '업로드 완료', value: totalUploaded },
                { label: '업로드율', value: `${uploadRate}%` },
                { label: '검증 오류', value: recentValidationErrors },
              ].map((card, i) => (
                <div key={i} className={styles.statCard}>
                  <p className={styles.statLabel}>{card.label}</p>
                  <p className={styles.statValue}>{card.value}</p>
                </div>
              ))}
            </div>

            {[
              { src: 'life', title: '생명보험협회 공시', url: 'pub.insure.or.kr', cats: lifeCategories },
              { src: 'damage', title: '손해보험협회 공시', url: 'pub.knia.or.kr', cats: damageCategories },
            ].map(({ src, title, url, cats }) => (
              <div key={src} className={styles.card}>
                <div className={styles.cardHeader}>
                  <p className={styles.cardTitle}>{title}</p>
                  <span style={{ fontSize: 12, color: '#8892A0' }}>{url}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['카테고리', '우선순위', '업로드일', '보험사 수', '행 수', '상태'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {cats.map(cat => {
                      const uploaded = getSourceStatus(src, cat.category)
                      return (
                        <tr key={cat.id}>
                          <td style={tdStyle({ fontWeight: 500 })}>{cat.category}</td>
                          <td style={tdStyle()}>
                            {cat.is_priority ? badge('#FEF3C7', '#D97706', '핵심') : <span style={{ color: '#8892A0', fontSize: 14 }}>-</span>}
                          </td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? new Date(uploaded.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? `${uploaded.company_count}개` : '-'}</td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? `${uploaded.row_count.toLocaleString()}행` : '-'}</td>
                          <td style={tdStyle()}>
                            {uploaded ? badge('#D1FAE5', '#065F46', '완료') : badge('#FEE2E2', '#991B1B', '미업로드')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {validations.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <p className={styles.cardTitle}>최근 검증 로그</p>
                </div>
                <div style={{ padding: 16 }}>
                  {validations.slice(0, 10).map(v => (
                    <div key={v.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #E5E7EB', alignItems: 'flex-start' }}>
                      {badge(v.severity === 'error' ? '#FEE2E2' : '#FEF3C7', v.severity === 'error' ? '#991B1B' : '#D97706', v.severity === 'error' ? '오류' : '경고')}
                      <div>
                        <p style={{ fontSize: 14, color: '#1A1A2E' }}>{v.detail}</p>
                        <p style={{ fontSize: 13, color: '#8892A0', marginTop: 2 }}>
                          {v.dpa_insurance_sources?.source === 'life' ? '생명보험' : '손해보험'} {v.dpa_insurance_sources?.category} · {v.check_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* 파일 업로드 */}
          {activeTab === 'upload' && (
            <div className={styles.card} style={{ padding: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>보험 공시 파일 업로드</h2>
              <p style={{ fontSize: 13, color: '#636B78', margin: '0 0 24px' }}>파일을 업로드하면 자동으로 생명/손해보험, 카테고리를 판별해서 저장합니다.</p>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={[styles.uploadArea, dragOver ? styles.uploadAreaActive : ''].join(' ')}
              >
                <p className={styles.uploadTitle}>{dragOver ? '파일을 놓으세요!' : '클릭 또는 드래그로 파일 선택'}</p>
                <p className={styles.uploadSub}>공시 엑셀(.xls) 또는 보험사 요약서(.pdf)</p>
                <input ref={fileRef} type="file" accept=".xls,.xlsx,.pdf" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>

              {uploading && (
                <div style={{ marginTop: 20, padding: 20, background: 'rgba(94,106,210,0.06)', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>파일 분석 중...</p>
                  <p style={{ fontSize: 13, color: '#636B78', marginTop: 4 }}>자동으로 보험 종류와 카테고리를 판별하고 있어요</p>
                </div>
              )}

              {uploadResult && (
                <div style={{ marginTop: 20, padding: 20, background: uploadResult.success ? '#F0FDF9' : '#FEF2F2', borderRadius: 10 }}>
                  {uploadResult.success ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#065F46', marginBottom: 12 }}>{uploadResult.isPdf ? 'PDF 업로드 완료' : '업로드 완료'}</p>
                      {!uploadResult.isPdf && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                          <div><span style={{ color: '#636B78' }}>판별 결과:</span> <strong>{uploadResult.source === 'life' ? '생명보험협회' : '손해보험협회'} {uploadResult.category}</strong></div>
                          <div><span style={{ color: '#636B78' }}>보험사 수:</span> <strong>{uploadResult.companyCount}개</strong></div>
                          <div><span style={{ color: '#636B78' }}>총 행 수:</span> <strong>{uploadResult.rowCount?.toLocaleString()}행</strong></div>
                          <div><span style={{ color: '#636B78' }}>검증 경고:</span> <strong>{uploadResult.warnings}건</strong></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>업로드 실패</p>
                      <p style={{ fontSize: 13, color: '#636B78' }}>{uploadResult.error}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* URL 목록 */}
          {activeTab === 'urls' && (
            <>
              {['life', 'damage'].map(src => (
                <div key={src} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>
                      {src === 'life' ? '생명보험협회 공시 URL' : '손해보험협회 공시 URL'}
                    </p>
                  </div>
                  <div style={{ padding: 16 }}>
                    {categories.filter(c => c.source === src).map(cat => (
                      <div key={cat.id} className={styles.urlRow}>
                        <div className={styles.urlName}>
                          {cat.category}
                          {cat.is_priority && <span className={styles.priorityChip}>핵심</span>}
                        </div>
                        <div className={styles.urlValue}>{cat.site_url}</div>
                        <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(cat.site_url); alert('URL 복사됨!') }}>
                          복사
                        </button>
                        <a href={cat.site_url} target="_blank" rel="noreferrer" className={styles.openLink}>
                          열기
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
  )
}
