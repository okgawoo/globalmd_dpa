import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

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

  const [topMenu, setTopMenu] = useState<'공지사항' | '설계사' | '보험공시'>('공지사항')
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

  const TAB_ITEMS: { key: '공지사항' | '설계사' | '보험공시'; label: string }[] = [
    { key: '공지사항', label: '공지사항 관리' },
    { key: '설계사', label: '설계사 관리' },
    { key: '보험공시', label: '보험 공시 관리' },
  ]

  const tabStyle = (active: boolean) => ({
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))',
    borderBottom: active ? '2px solid hsl(var(--accent))' : '2px solid transparent',
    transition: 'all 0.1s',
  } as React.CSSProperties)

  const cardStyle = {
    background: 'hsl(var(--bg-panel))',
    borderRadius: 10,
    border: '1px solid hsl(var(--border-default))',
    overflow: 'hidden',
  } as React.CSSProperties

  const cardHeaderStyle = {
    padding: '12px 20px',
    borderBottom: '1px solid hsl(var(--border-default))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: 12,
    color: 'hsl(var(--text-tertiary))',
    fontWeight: 600,
    borderBottom: '1px solid hsl(var(--border-default))',
  }

  const tdStyle = (extra?: React.CSSProperties) => ({
    padding: '11px 16px',
    fontSize: 14,
    borderBottom: '1px solid hsl(var(--border-default))',
    ...extra,
  } as React.CSSProperties)

  const badge = (bg: string, color: string, text: string) => (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: bg, color }}>{text}</span>
  )

  return (
    <div className="px-6 pb-8 pt-5" style={{ background: 'hsl(var(--bg-app))', minHeight: '100%' }}>

        {/* Page title */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>관리자 페이지</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: 'hsl(var(--text-secondary))' }}>시스템 관리 전용 페이지입니다</p>
          </div>
          <span className="text-sm" style={{ color: 'hsl(var(--text-primary))' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
        </div>

        {/* 상위 탭 */}
        <div style={{ ...cardStyle, marginBottom: 20, overflow: 'visible' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-default))', padding: '0 8px' }}>
            {TAB_ITEMS.map(({ key, label }) => (
              <button key={key} onClick={() => setTopMenu(key)} style={tabStyle(topMenu === key)}>
                {label}
              </button>
            ))}
          </div>

          {/* 보험공시 서브탭 */}
          {topMenu === '보험공시' && (
            <div style={{ display: 'flex', padding: '0 8px', background: 'hsl(var(--bg-app))' }}>
              {[
                { key: 'dashboard', label: '현황 대시보드' },
                { key: 'upload', label: '파일 업로드' },
                { key: 'urls', label: 'URL 목록' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                    color: activeTab === tab.key ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))',
                    borderBottom: activeTab === tab.key ? '2px solid hsl(var(--accent))' : '2px solid transparent',
                  }}>
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
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>푸시 알림 발송</span>
                  <p className="text-[13px] mt-0.5" style={{ color: 'hsl(var(--text-secondary))' }}>
                    현재 구독자 <span style={{ color: 'hsl(var(--accent))', fontWeight: 600 }}>{subCount}명</span>
                  </p>
                </div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: '제목', value: pushTitle, setter: setPushTitle, placeholder: '공지사항 제목을 입력하세요', type: 'input' },
                  { label: '내용', value: pushBody, setter: setPushBody, placeholder: '공지사항 내용을 입력하세요', type: 'textarea' },
                  { label: '클릭 시 이동 URL', value: pushUrl, setter: setPushUrl, placeholder: '예: /notifications (선택사항)', type: 'input' },
                ].map(({ label, value, setter, placeholder, type }) => (
                  <div key={label}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 4 }}>{label}</label>
                    {type === 'textarea' ? (
                      <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} rows={4}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid hsl(var(--border-default))', fontSize: 14, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', resize: 'vertical', boxSizing: 'border-box' as const }} />
                    ) : (
                      <input type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid hsl(var(--border-default))', fontSize: 14, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', boxSizing: 'border-box' as const }} />
                    )}
                  </div>
                ))}
                <button onClick={sendPush} disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
                  style={{ padding: '11px 0', background: pushSending || !pushTitle.trim() || !pushBody.trim() ? 'hsl(var(--bg-elevated))' : 'hsl(var(--accent))', color: pushSending || !pushTitle.trim() || !pushBody.trim() ? 'hsl(var(--text-tertiary))' : '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
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
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>발송 이력</span>
              </div>
              {pushHistory.length === 0 ? (
                <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'hsl(var(--text-tertiary))' }}>아직 발송 이력이 없습니다</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'hsl(var(--bg-app))' }}>
                    {['발송일', '제목', '내용', '발송 수'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {pushHistory.map(n => (
                      <tr key={n.id}>
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' })}>
                          {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={tdStyle({ fontWeight: 500 })}>{n.title}</td>
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{n.body}</td>
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
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>설계사 목록</span>
                  <span className="ml-2 text-[13px]" style={{ color: 'hsl(var(--text-tertiary))' }}>총 {agentList.length}명</span>
                </div>
                <button onClick={fetchAgentList}
                  style={{ padding: '5px 12px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}>
                  새로고침
                </button>
              </div>
              {agentList.length === 0 ? (
                <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'hsl(var(--text-tertiary))' }}>설계사가 없습니다</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'hsl(var(--bg-app))' }}>
                    {['이름', '이메일', '연락처', '요금제', '상태', '가입일'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {agentList.map(agent => (
                      <tr key={agent.id}>
                        <td style={tdStyle({ fontWeight: 600 })}>{agent.name}</td>
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))' })}>{agent.email}</td>
                        <td style={tdStyle()}>{agent.phone}</td>
                        <td style={tdStyle()}>
                          {badge(
                            agent.plan_type === 'pro' ? 'hsl(var(--accent))' : agent.plan_type === 'standard' ? '#3B82F6' : agent.plan_type === 'demo' ? '#F59E0B' : '#9CA3AF',
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
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' })}>
                          {new Date(agent.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 발신번호 신청 목록 */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>발신번호 등록 신청 목록</span>
                <button onClick={fetchSmsAuthList}
                  style={{ padding: '5px 12px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}>
                  새로고침
                </button>
              </div>
              {smsAuthList.length === 0 ? (
                <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: 'hsl(var(--text-tertiary))' }}>신청 내역이 없습니다</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'hsl(var(--bg-app))' }}>
                    {['신청일', '이름', '발신번호', '생년월일', '상태', '서류 재발송'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {smsAuthList.map(auth => (
                      <tr key={auth.id}>
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' })}>
                          {new Date(auth.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={tdStyle({ fontWeight: 600 })}>{auth.agent_name}</td>
                        <td style={tdStyle()}>{auth.sender_phone}</td>
                        <td style={tdStyle({ color: 'hsl(var(--text-secondary))' })}>{auth.birth_date}</td>
                        <td style={tdStyle()}>
                          {badge(
                            auth.status === 'approved' ? '#D1FAE5' : auth.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                            auth.status === 'approved' ? '#065F46' : auth.status === 'pending' ? '#92400E' : '#991B1B',
                            auth.status === 'approved' ? '승인완료' : auth.status === 'pending' ? '검토중' : '반려'
                          )}
                        </td>
                        <td style={tdStyle()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => resendSmsAuthDocs(auth)} disabled={resending === auth.id}
                              style={{ padding: '5px 14px', background: 'hsl(var(--accent))', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: resending === auth.id ? 0.6 : 1 }}>
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

        {/* ===== 보험 공시 관리 ===== */}
        {topMenu === '보험공시' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 현황 대시보드 */}
            {activeTab === 'dashboard' && (<>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: '전체 카테고리', value: totalCategories },
                  { label: '업로드 완료', value: totalUploaded },
                  { label: '업로드율', value: `${uploadRate}%` },
                  { label: '검증 오류', value: recentValidationErrors },
                ].map((card, i) => (
                  <div key={i} style={{ ...cardStyle, padding: '16px 20px' }}>
                    <p className="text-[13px]" style={{ color: 'hsl(var(--text-secondary))', marginBottom: 6 }}>{card.label}</p>
                    <p className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{card.value}</p>
                  </div>
                ))}
              </div>

              {[
                { src: 'life', title: '생명보험협회 공시', url: 'pub.insure.or.kr', cats: lifeCategories },
                { src: 'damage', title: '손해보험협회 공시', url: 'pub.knia.or.kr', cats: damageCategories },
              ].map(({ src, title, url, cats }) => (
                <div key={src} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{title}</span>
                    <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>{url}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'hsl(var(--bg-app))' }}>
                      {['카테고리', '우선순위', '업로드일', '보험사 수', '행 수', '상태'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {cats.map(cat => {
                        const uploaded = getSourceStatus(src, cat.category)
                        return (
                          <tr key={cat.id}>
                            <td style={tdStyle({ fontWeight: 500 })}>{cat.category}</td>
                            <td style={tdStyle()}>
                              {cat.is_priority ? badge('#FEF3C7', '#D97706', '핵심') : <span style={{ color: 'hsl(var(--text-tertiary))', fontSize: 14 }}>-</span>}
                            </td>
                            <td style={tdStyle({ color: 'hsl(var(--text-secondary))' })}>{uploaded ? new Date(uploaded.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                            <td style={tdStyle({ color: 'hsl(var(--text-secondary))' })}>{uploaded ? `${uploaded.company_count}개` : '-'}</td>
                            <td style={tdStyle({ color: 'hsl(var(--text-secondary))' })}>{uploaded ? `${uploaded.row_count.toLocaleString()}행` : '-'}</td>
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
                <div style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>최근 검증 로그</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    {validations.slice(0, 10).map(v => (
                      <div key={v.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid hsl(var(--border-default))', alignItems: 'flex-start' }}>
                        {badge(v.severity === 'error' ? '#FEE2E2' : '#FEF3C7', v.severity === 'error' ? '#991B1B' : '#D97706', v.severity === 'error' ? '오류' : '경고')}
                        <div>
                          <p style={{ fontSize: 14, color: 'hsl(var(--text-primary))' }}>{v.detail}</p>
                          <p style={{ fontSize: 13, color: 'hsl(var(--text-tertiary))', marginTop: 2 }}>
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
              <div style={{ ...cardStyle, padding: 32 }}>
                <h2 className="text-xl font-bold mb-1" style={{ color: 'hsl(var(--text-primary))' }}>보험 공시 파일 업로드</h2>
                <p className="text-[13px] mb-6" style={{ color: 'hsl(var(--text-secondary))' }}>파일을 업로드하면 자동으로 생명/손해보험, 카테고리를 판별해서 저장합니다.</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{ border: `2px dashed ${dragOver ? 'hsl(var(--accent))' : 'hsl(var(--border-default))'}`, borderRadius: 10, padding: 48, textAlign: 'center', cursor: 'pointer', background: dragOver ? 'hsl(var(--accent-bg))' : 'hsl(var(--bg-app))', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!dragOver) e.currentTarget.style.borderColor = 'hsl(var(--accent))' }}
                  onMouseLeave={e => { if (!dragOver) e.currentTarget.style.borderColor = 'hsl(var(--border-default))' }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: 'hsl(var(--text-primary))' }}>{dragOver ? '파일을 놓으세요!' : '클릭 또는 드래그로 파일 선택'}</p>
                  <p className="text-[13px]" style={{ color: 'hsl(var(--text-tertiary))' }}>공시 엑셀(.xls) 또는 보험사 요약서(.pdf)</p>
                  <input ref={fileRef} type="file" accept=".xls,.xlsx,.pdf" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                </div>

                {uploading && (
                  <div style={{ marginTop: 20, padding: 20, background: 'hsl(var(--accent-bg))', borderRadius: 10, textAlign: 'center' }}>
                    <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>파일 분석 중...</p>
                    <p className="text-[13px] mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>자동으로 보험 종류와 카테고리를 판별하고 있어요</p>
                  </div>
                )}

                {uploadResult && (
                  <div style={{ marginTop: 20, padding: 20, background: uploadResult.success ? '#F0FDF9' : '#FEF2F2', borderRadius: 10 }}>
                    {uploadResult.success ? (
                      <>
                        <p className="text-sm font-semibold mb-3" style={{ color: '#065F46' }}>{uploadResult.isPdf ? 'PDF 업로드 완료' : '업로드 완료'}</p>
                        {!uploadResult.isPdf && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                            <div><span style={{ color: 'hsl(var(--text-secondary))' }}>판별 결과:</span> <strong>{uploadResult.source === 'life' ? '생명보험협회' : '손해보험협회'} {uploadResult.category}</strong></div>
                            <div><span style={{ color: 'hsl(var(--text-secondary))' }}>보험사 수:</span> <strong>{uploadResult.companyCount}개</strong></div>
                            <div><span style={{ color: 'hsl(var(--text-secondary))' }}>총 행 수:</span> <strong>{uploadResult.rowCount?.toLocaleString()}행</strong></div>
                            <div><span style={{ color: 'hsl(var(--text-secondary))' }}>검증 경고:</span> <strong>{uploadResult.warnings}건</strong></div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold mb-1" style={{ color: '#991B1B' }}>업로드 실패</p>
                        <p className="text-[13px]" style={{ color: 'hsl(var(--text-secondary))' }}>{uploadResult.error}</p>
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
                  <div key={src} style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>
                        {src === 'life' ? '생명보험협회 공시 URL' : '손해보험협회 공시 URL'}
                      </span>
                    </div>
                    <div style={{ padding: 16 }}>
                      {categories.filter(c => c.source === src).map(cat => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid hsl(var(--border-default))' }}>
                          <div style={{ width: 120, fontSize: 13, fontWeight: 600, flexShrink: 0, color: 'hsl(var(--text-primary))' }}>
                            {cat.category}
                            {cat.is_priority && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: 20, marginLeft: 6 }}>핵심</span>}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, color: 'hsl(var(--text-secondary))', wordBreak: 'break-all', background: 'hsl(var(--bg-app))', padding: '6px 10px', borderRadius: 6 }}>
                            {cat.site_url}
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(cat.site_url); alert('URL 복사됨!') }}
                            style={{ flexShrink: 0, padding: '6px 14px', background: 'hsl(var(--accent))', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            복사
                          </button>
                          <a href={cat.site_url} target="_blank" rel="noreferrer"
                            style={{ flexShrink: 0, padding: '6px 14px', background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))', borderRadius: 6, fontSize: 12, textDecoration: 'none' }}>
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
