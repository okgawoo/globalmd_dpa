import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = [
  { source: 'life', label: '생명보험', color: '#1D9E75' },
  { source: 'damage', label: '손해보험', color: '#2563EB' },
]

const PRIORITY_CATEGORIES = ['암보험', '질병보험', '간병/치매보험']

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [validations, setValidations] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'urls'>('dashboard')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkUser()
    fetchData()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    // if (!user || user.email !== 'admin@dpa.com') {
      // window.location.href = '/'
      // return
    // }
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

  function getSourceStatus(source: string, category: string) {
    return sources.find(s => s.source === source && s.category === category)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/insurance-upload', { method: 'POST', body: formData })
      const result = await res.json()
      setUploadResult(result)
      if (result.success) fetchData()
    } catch (err) {
      setUploadResult({ success: false, error: '업로드 실패' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const lifeCategories = categories.filter(c => c.source === 'life')
  const damageCategories = categories.filter(c => c.source === 'damage')

  const totalUploaded = sources.length
  const totalCategories = categories.length
  const uploadRate = totalCategories > 0 ? Math.round((totalUploaded / totalCategories) * 100) : 0

  const recentValidationErrors = validations.filter(v => v.severity === 'error').length
  const recentValidationWarnings = validations.filter(v => v.severity === 'warning').length

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: 'Apple SD Gothic Neo, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ background: '#1D9E75', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>DPA 관리자</span>
          <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 20 }}>보험 공시 관리</span>
        </div>
        <button onClick={() => window.location.href = '/'} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          대시보드로
        </button>
      </div>

      {/* 탭 */}
      <div style={{ background: 'white', borderBottom: '1px solid #EDEBE4', padding: '0 24px', display: 'flex', gap: 0 }}>
        {[
          { key: 'dashboard', label: '📊 현황 대시보드' },
          { key: 'upload', label: '📁 파일 업로드' },
          { key: 'urls', label: '🔗 URL 목록' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? '#1D9E75' : '#666', borderBottom: activeTab === tab.key ? '2px solid #1D9E75' : '2px solid transparent' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>

        {/* 현황 대시보드 */}
        {activeTab === 'dashboard' && (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: '전체 카테고리', value: totalCategories, color: '#1D9E75', icon: '📋' },
                { label: '업로드 완료', value: totalUploaded, color: '#2563EB', icon: '✅' },
                { label: '업로드율', value: `${uploadRate}%`, color: uploadRate === 100 ? '#1D9E75' : '#F59E0B', icon: '📈' },
                { label: '검증 오류', value: recentValidationErrors, color: recentValidationErrors > 0 ? '#EF4444' : '#1D9E75', icon: '⚠️' },
              ].map((card, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', border: '1px solid #EDEBE4' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{card.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* 생명보험 현황 */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #EDEBE4', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#F0FDF9', borderBottom: '1px solid #EDEBE4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>생명보험협회 공시</span>
                <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>pub.insure.or.kr</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['카테고리', '우선순위', '업로드일', '보험사 수', '행 수', '상태'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#888', fontWeight: 600, borderBottom: '1px solid #EDEBE4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lifeCategories.map(cat => {
                    const uploaded = getSourceStatus('life', cat.category)
                    return (
                      <tr key={cat.id} style={{ borderBottom: '1px solid #F5F5F3' }}>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{cat.category}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {cat.is_priority ? <span style={{ fontSize: 11, background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>핵심</span> : <span style={{ fontSize: 11, color: '#CCC' }}>-</span>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? new Date(uploaded.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? `${uploaded.company_count}개` : '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? `${uploaded.row_count.toLocaleString()}행` : '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {uploaded
                            ? <span style={{ fontSize: 12, background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>✅ 완료</span>
                            : <span style={{ fontSize: 12, background: '#FEE2E2', color: '#991B1B', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>❌ 미업로드</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 손해보험 현황 */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #EDEBE4', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#EFF6FF', borderBottom: '1px solid #EDEBE4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>손해보험협회 공시</span>
                <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>pub.knia.or.kr</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['카테고리', '우선순위', '업로드일', '보험사 수', '행 수', '상태'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#888', fontWeight: 600, borderBottom: '1px solid #EDEBE4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {damageCategories.map(cat => {
                    const uploaded = getSourceStatus('damage', cat.category)
                    return (
                      <tr key={cat.id} style={{ borderBottom: '1px solid #F5F5F3' }}>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{cat.category}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {cat.is_priority ? <span style={{ fontSize: 11, background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>핵심</span> : <span style={{ fontSize: 11, color: '#CCC' }}>-</span>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? new Date(uploaded.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? `${uploaded.company_count}개` : '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>{uploaded ? `${uploaded.row_count.toLocaleString()}행` : '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {uploaded
                            ? <span style={{ fontSize: 12, background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>✅ 완료</span>
                            : <span style={{ fontSize: 12, background: '#FEE2E2', color: '#991B1B', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>❌ 미업로드</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 최근 검증 로그 */}
            {validations.length > 0 && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #EDEBE4', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #EDEBE4', fontWeight: 700, fontSize: 15 }}>⚠️ 최근 검증 로그</div>
                <div style={{ padding: 16 }}>
                  {validations.slice(0, 10).map(v => (
                    <div key={v.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #F5F5F3', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: v.severity === 'error' ? '#FEE2E2' : '#FEF3C7', color: v.severity === 'error' ? '#991B1B' : '#D97706' }}>
                        {v.severity === 'error' ? '오류' : '경고'}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, color: '#333' }}>{v.detail}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {v.dpa_insurance_sources?.source === 'life' ? '생명보험' : '손해보험'} {v.dpa_insurance_sources?.category} · {v.check_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 파일 업로드 탭 */}
        {activeTab === 'upload' && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #EDEBE4', padding: 32 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>📁 보험 공시 파일 업로드</h2>
            <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>파일을 업로드하면 자동으로 생명/손해보험, 카테고리를 판별해서 저장해요.</p>

            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #EDEBE4', borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer', background: '#FAFAF8', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#1D9E75')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#EDEBE4')}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>클릭해서 파일 선택</div>
              <div style={{ fontSize: 13, color: '#999' }}>생명보험협회 또는 손해보험협회 공시 엑셀(.xls) 파일</div>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
            </div>

            {uploading && (
              <div style={{ marginTop: 24, padding: 20, background: '#F0FDF9', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                <div style={{ fontWeight: 600 }}>파일 분석 중...</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>자동으로 보험 종류와 카테고리를 판별하고 있어요</div>
              </div>
            )}

            {uploadResult && (
              <div style={{ marginTop: 24, padding: 20, background: uploadResult.success ? '#F0FDF9' : '#FEF2F2', borderRadius: 12 }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{uploadResult.success ? '✅' : '❌'}</div>
                {uploadResult.success ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>업로드 완료!</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                      <div><span style={{ color: '#666' }}>판별 결과:</span> <strong>{uploadResult.source === 'life' ? '생명보험협회' : '손해보험협회'} {uploadResult.category}</strong></div>
                      <div><span style={{ color: '#666' }}>보험사 수:</span> <strong>{uploadResult.companyCount}개</strong></div>
                      <div><span style={{ color: '#666' }}>총 행 수:</span> <strong>{uploadResult.rowCount?.toLocaleString()}행</strong></div>
                      <div><span style={{ color: '#666' }}>검증 경고:</span> <strong style={{ color: uploadResult.warnings > 0 ? '#D97706' : '#1D9E75' }}>{uploadResult.warnings}건</strong></div>
                    </div>
                    {uploadResult.warningDetails?.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#FEF3C7', borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>⚠️ 검증 경고</div>
                        {uploadResult.warningDetails.map((w: string, i: number) => (
                          <div key={i} style={{ fontSize: 13, color: '#666' }}>• {w}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>업로드 실패</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{uploadResult.error}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* URL 목록 탭 */}
        {activeTab === 'urls' && (
          <>
            {['life', 'damage'].map(src => (
              <div key={src} style={{ background: 'white', borderRadius: 12, border: '1px solid #EDEBE4', marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: src === 'life' ? '#F0FDF9' : '#EFF6FF', borderBottom: '1px solid #EDEBE4', fontWeight: 700, fontSize: 15 }}>
                  {src === 'life' ? '🟢 생명보험협회 공시 URL' : '🔵 손해보험협회 공시 URL'}
                </div>
                <div style={{ padding: 16 }}>
                  {categories.filter(c => c.source === src).map(cat => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F5F3' }}>
                      <div style={{ width: 80, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        {cat.category}
                        {cat.is_priority && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: 20, marginLeft: 4 }}>핵심</span>}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: '#666', wordBreak: 'break-all', background: '#F8F8F6', padding: '6px 10px', borderRadius: 6 }}>
                        {cat.site_url}
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(cat.site_url); alert('URL 복사됨!') }}
                        style={{ flexShrink: 0, padding: '6px 12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        복사
                      </button>
                      <a href={cat.site_url} target="_blank" rel="noreferrer"
                        style={{ flexShrink: 0, padding: '6px 12px', background: '#F0F0EE', color: '#333', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
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
    </div>
  )
}
