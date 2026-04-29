import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Report.module.css'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'

// ── 상수 ──────────────────────────────────────────────
const PIE_COLORS = ['#5E6AD2','#7C86E0','#10B981','#F59E0B','#EF4444','#06B6D4','#8B5CF6','#F97316']
const STATUS_COLOR: Record<string, string> = { good: '#10B981', ok: '#F59E0B', low: '#EF4444' }
const STATUS_LABEL: Record<string, string> = { good: '충분', ok: '보통', low: '부족' }
const STATUS_BG: Record<string, string>    = { good: '#ECFDF5', ok: '#FFFBEB', low: '#FEF3F2' }

function fmtMoney(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (v >= 10000000)  return `${(v / 10000000).toFixed(0)}천만`
  if (v >= 10000)     return `${(v / 10000).toFixed(0)}만`
  return `${v.toLocaleString()}원`
}

// ── 블록 정의 ──────────────────────────────────────────
const BLOCK_DEFS = [
  { id: 'agent_card',          label: '전자명함',          hasAI: false, icon: '👤' },
  { id: 'customer_profile',    label: '고객 프로필',        hasAI: false, icon: '📋' },
  { id: 'contracts',           label: '보유계약',           hasAI: false, icon: '📄' },
  { id: 'coverage_analysis',   label: '보장분석',           hasAI: false, icon: '📊' },
  { id: 'gap_analysis',        label: '보장공백 진단',       hasAI: true,  icon: '⚠️' },
  { id: 'key_insight',         label: '후킹멘트',           hasAI: true,  icon: '💡' },
  { id: 'age_comparison',      label: '나이별 시사점',       hasAI: true,  icon: '📅' },
  { id: 'rejection_risk',      label: '지급거절 위험 체크',  hasAI: true,  icon: '🚨' },
  { id: 'peer_comparison',     label: '동년배 비교',         hasAI: true,  icon: '👥' },
  { id: 'remodel_suggestion',  label: '리모델링 제안',       hasAI: true,  icon: '🔧' },
  { id: 'pitch_points',        label: '피칭 포인트',        hasAI: true,  icon: '🎯' },
  { id: 'consultation_script', label: '화법 스크립트',      hasAI: true,  icon: '💬' },
] as const

type BlockId  = typeof BLOCK_DEFS[number]['id']
type BlockDef = { id: BlockId; label: string; hasAI: boolean; icon: string; enabled: boolean }

const DEFAULT_ENABLED: BlockId[] = [
  'agent_card','customer_profile','contracts','coverage_analysis',
  'gap_analysis','key_insight','age_comparison','consultation_script',
]
const initBlocks = (): BlockDef[] =>
  BLOCK_DEFS.map(b => ({ ...b, enabled: DEFAULT_ENABLED.includes(b.id) }))

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function ReportPage() {
  const [customers, setCustomers]         = useState<any[]>([])
  const [localContracts, setLocalContracts] = useState<any[]>([])
  const [searchQ, setSearchQ]             = useState('')
  const [showDropdown, setShowDropdown]   = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selected, setSelected]           = useState<any>(null)
  const [agent, setAgent]                 = useState<any>(null)
  const [loading, setLoading]             = useState(false)
  const [reportData, setReportData]       = useState<any>(null)
  const [modalOpen, setModalOpen]         = useState(false)
  const [blocks, setBlocks]               = useState<BlockDef[]>(initBlocks)
  const [editContent, setEditContent]     = useState<Record<string, string>>({})
  const [dragIdx, setDragIdx]             = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('dpa_agents').select('*').eq('user_id', data.user.id).single().then(({ data: ag }) => {
        if (!ag) return
        setAgent(ag)
        const userId = data.user.id
        Promise.all([
          supabase.from('dpa_customers').select('*').eq('agent_id', userId).order('name'),
          supabase.from('dpa_contracts').select('customer_id,monthly_fee').eq('agent_id', userId).eq('payment_status', '유지'),
        ]).then(([{ data: c }, { data: ct }]) => {
          setCustomers(c || [])
          setLocalContracts(ct || [])
        })
      })
    })
  }, [])

  // reportData 들어오면 편집 텍스트 초기화
  useEffect(() => {
    if (!reportData) return
    setEditContent({
      key_insight: reportData.keyInsight || '',
      consultation_script: (reportData.consultationScripts || []).join('\n\n'),
      age_comparison: reportData.ageComparison?.note || '',
      pitch_points: (reportData.gapAnalysis || [])
        .map((g: any) => `• ${g.category}: ${g.message}`).join('\n'),
      rejection_risk: '',
      peer_comparison: '',
      remodel_suggestion: '',
    })
  }, [reportData])

  const filtered = customers.filter(c =>
    c.name?.includes(searchQ) || c.phone?.includes(searchQ)
  ).slice(0, 8)

  function getLocalStats(customerId: string) {
    const cc = localContracts.filter(c => c.customer_id === customerId)
    return {
      contractCount: cc.length,
      monthlyTotal: cc.reduce((s, c) => s + (c.monthly_fee || 0), 0),
    }
  }

  function selectCustomer(c: any) {
    setSelected(c)
    setSearchQ(c.name)
    setShowDropdown(false)
    setHighlightedIndex(-1)
    setReportData(null)
    setEditContent({})
  }

  async function generateReport() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected.id }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setReportData(data)
    } catch (e: any) {
      alert('리포트 생성 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── 드래그 핸들러 ──
  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...blocks]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setBlocks(next)
    setDragIdx(idx)
  }
  function onDragEnd() { setDragIdx(null) }
  function toggleBlock(id: string) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b))
  }

  const enabledBlocks = blocks.filter(b => b.enabled)
  const localStats    = selected ? getLocalStats(selected.id) : null

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>고객 리포트</div>
          <div className={styles.pageDesc}>블록을 선택하고 AI 보장 분석 리포트를 생성하세요</div>
        </div>
      </div>

      <div className={styles.reportLayout}>

        {/* ── 좌: 블록 에디터 ── */}
        <div className={styles.editorPanel}>
          {!selected ? (
            <div className={styles.editorEmpty}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
              <div className={styles.editorEmptyTitle}>고객을 선택해 주세요</div>
              <div className={styles.editorEmptyDesc}>
                오른쪽 검색창에서 고객을 선택하면<br />리포트 블록이 여기에 나타납니다
              </div>
            </div>
          ) : (
            <div className={styles.editorBlocks}>
              {enabledBlocks.map(block => (
                <EditorBlock
                  key={block.id}
                  block={block}
                  agent={agent}
                  customer={selected}
                  localStats={localStats}
                  reportData={reportData}
                  editContent={editContent}
                  loading={loading}
                  onEdit={(val: string) =>
                    setEditContent(prev => ({ ...prev, [block.id]: val }))
                  }
                  onAIGenerate={generateReport}
                />
              ))}
              {enabledBlocks.length === 0 && (
                <div className={styles.editorEmpty} style={{ minHeight: 160 }}>
                  <div style={{ fontSize: 13, color: '#8892A0' }}>오른쪽에서 블록을 선택해 주세요</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 우: 사이드바 ── */}
        <div className={styles.sidebar}>

          {/* 고객 검색 */}
          <div className={styles.sideSection}>
            <div className={styles.sideSectionTitle}>고객 선택</div>
            <div style={{ position: 'relative' }}>
              <input
                className={styles.searchInput}
                placeholder="이름 또는 연락처"
                value={searchQ}
                onChange={e => {
                  setSearchQ(e.target.value)
                  setShowDropdown(true)
                  setSelected(null)
                  setHighlightedIndex(-1)
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => { setShowDropdown(false); setHighlightedIndex(-1) }, 150)}
                onKeyDown={e => {
                  if (!showDropdown || !searchQ) return
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)) }
                  else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && filtered[highlightedIndex]) selectCustomer(filtered[highlightedIndex]) }
                  else if (e.key === 'Escape') { setShowDropdown(false); setHighlightedIndex(-1) }
                }}
              />
              {showDropdown && searchQ && (
                <div className={styles.dropdown}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: '#8892A0' }}>검색 결과 없음</div>
                  ) : filtered.map((c, idx) => {
                    const s = getLocalStats(c.id)
                    return (
                      <div
                        key={c.id}
                        className={styles.dropdownItem}
                        style={idx === highlightedIndex ? { background: '#F0F1FB' } : {}}
                        onMouseDown={() => selectCustomer(c)}
                      >
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#5E6AD2', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {c.name?.[0]}
                        </span>
                        <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                        <span style={{ fontSize: 10, color: '#8892A0' }}>{s.contractCount}건</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {selected && (
              <div className={styles.selectedMini}>
                <div className={styles.selectedMiniAvatar}>{selected.name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: '#8892A0', marginTop: 2 }}>
                    {selected.age ? `${selected.age}세` : ''}
                    {selected.gender ? ` · ${selected.gender}` : ''}
                    {localStats ? ` · ${localStats.contractCount}건 유지` : ''}
                  </div>
                </div>
                {reportData && (
                  <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, background: '#ECFDF5', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>
                    분석완료
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 블록 구성 */}
          <div className={`${styles.sideSection} ${styles.sideSectionFlex}`}>
            <div className={styles.sideSectionTitle}>
              리포트 구성
              <span style={{ fontSize: 10, color: '#8892A0', fontWeight: 400, marginLeft: 6 }}>
                드래그로 순서 변경
              </span>
            </div>
            <div className={styles.blockList}>
              {blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={`${styles.blockItem} ${dragIdx === idx ? styles.blockItemDragging : ''}`}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                >
                  <span className={styles.dragHandle}>⋮⋮</span>
                  <input
                    type="checkbox"
                    checked={block.enabled}
                    onChange={() => toggleBlock(block.id)}
                    className={styles.blockCheckbox}
                  />
                  <span className={styles.blockItemIcon}>{block.icon}</span>
                  <span className={styles.blockItemLabel}>{block.label}</span>
                  {block.hasAI && <span className={styles.aiTag}>AI</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className={styles.sideActions}>
            <button
              className={styles.generateBtn}
              onClick={generateReport}
              disabled={!selected || loading}
            >
              {loading ? '⏳ AI 분석 중...' : '✨ AI 분석 생성'}
            </button>
            <button
              className={styles.previewBtn}
              onClick={() => setModalOpen(true)}
              disabled={!reportData}
            >
              🖨 PDF 미리보기
            </button>
          </div>
        </div>
      </div>

      {modalOpen && reportData && (
        <ReportModal data={reportData} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

// ── 에디터 블록 컴포넌트 ──────────────────────────────
function EditorBlock({ block, agent, customer, localStats, reportData, editContent, loading, onEdit, onAIGenerate }: {
  block: BlockDef
  agent: any
  customer: any
  localStats: any
  reportData: any
  editContent: Record<string, string>
  loading: boolean
  onEdit: (val: string) => void
  onAIGenerate: () => void
}) {
  return (
    <div className={styles.editorBlock}>
      <div className={styles.editorBlockHeader}>
        <div className={styles.editorBlockTitle}>
          <span>{block.icon}</span>
          <span>{block.label}</span>
        </div>
        {block.hasAI && (
          <button className={styles.aiBtn} onClick={onAIGenerate} disabled={loading}>
            {loading ? '⏳' : '✨ AI 추천 생성'}
          </button>
        )}
      </div>
      <div className={styles.editorBlockContent}>
        <BlockContent
          id={block.id}
          agent={agent}
          customer={customer}
          localStats={localStats}
          reportData={reportData}
          editContent={editContent}
          onEdit={onEdit}
        />
      </div>
    </div>
  )
}

// ── 블록 내용 렌더러 ──────────────────────────────────
function BlockContent({ id, agent, customer, localStats, reportData, editContent, onEdit }: any) {
  const noData = !reportData

  switch (id) {

    // 전자명함
    case 'agent_card':
      if (!agent) return <Placeholder>설계사 정보를 불러오는 중...</Placeholder>
      return (
        <div className={styles.agentCardEditor}>
          <div className={styles.agentCardEditorAccent} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#5E6AD2', color: 'white', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {agent.name?.[0] || 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>{agent.name || '설계사'}</div>
              <div style={{ fontSize: 11, color: '#8892A0' }}>보험 컨설턴트 · iPlanner</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: '#636B78', flexWrap: 'wrap' }}>
            {agent.phone    && <span>📞 {agent.phone}</span>}
            {agent.email    && <span>✉ {agent.email}</span>}
            {agent.sns?.kakao    && <span>💬 {agent.sns.kakao}</span>}
            {agent.sns?.instagram && <span>📸 {agent.sns.instagram}</span>}
          </div>
        </div>
      )

    // 고객 프로필
    case 'customer_profile':
      return (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1A1A2E', color: 'white', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {customer.name?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: '#636B78', marginTop: 2 }}>
              {customer.age    ? `${customer.age}세` : ''}
              {customer.gender ? ` · ${customer.gender}` : ''}
              {customer.job    ? ` · ${customer.job}` : ''}
            </div>
          </div>
          {localStats && (
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#5E6AD2' }}>{localStats.contractCount}건</div>
                <div style={{ fontSize: 10, color: '#8892A0' }}>유지계약</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#5E6AD2' }}>{localStats.monthlyTotal.toLocaleString()}원</div>
                <div style={{ fontSize: 10, color: '#8892A0' }}>월보험료</div>
              </div>
            </div>
          )}
        </div>
      )

    // 보유계약
    case 'contracts':
      if (noData) return <Placeholder>✨ AI 분석 생성 후 계약 목록이 표시됩니다</Placeholder>
      if (!reportData.contracts?.length) return <Placeholder>유지 중인 계약이 없어요</Placeholder>
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.contractTable}>
            <thead>
              <tr>
                <th>보험사</th>
                <th>상품명</th>
                <th>종류</th>
                <th>월 보험료</th>
              </tr>
            </thead>
            <tbody>
              {reportData.contracts.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.company || '-'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productName || '-'}</td>
                  <td>{c.insuranceType || '-'}</td>
                  <td>{c.monthlyFee ? `${c.monthlyFee.toLocaleString()}원` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    // 보장분석 — 뱃지 목록
    case 'coverage_analysis':
      if (noData) return <Placeholder>✨ AI 분석 생성 후 보장 현황이 표시됩니다</Placeholder>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(reportData.coverageSummary || []).map((c: any) => (
            <div key={c.category} style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: STATUS_BG[c.status],
              border: `1px solid ${STATUS_COLOR[c.status]}44`,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[c.status], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#1A1A2E', fontWeight: 600 }}>{c.category}</span>
              <span style={{ color: STATUS_COLOR[c.status], fontWeight: 700 }}>{STATUS_LABEL[c.status]}</span>
              {c.unit !== '유무' && c.total > 0 && (
                <span style={{ color: '#8892A0', fontSize: 10 }}>{fmtMoney(c.total)}</span>
              )}
            </div>
          ))}
        </div>
      )

    // 보장공백 진단
    case 'gap_analysis':
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      if (!reportData.gapAnalysis?.length) return <Placeholder>공백 항목이 없어요 🎉</Placeholder>
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reportData.gapAnalysis.map((g: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', background: '#FEF3F2', border: '1px solid #FECACA', borderRadius: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>{g.category}</div>
                <div style={{ fontSize: 12, color: '#636B78', lineHeight: 1.6 }}>{g.message}</div>
              </div>
              <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {fmtMoney(g.current)} → {fmtMoney(g.benchmark)}
              </div>
            </div>
          ))}
        </div>
      )

    // 후킹멘트
    case 'key_insight':
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent.key_insight || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="핵심 후킹멘트..."
          rows={4}
        />
      )

    // 나이별 시사점
    case 'age_comparison':
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      if (!reportData.ageComparison?.note) return <Placeholder>나이 정보가 없어요</Placeholder>
      return (
        <div>
          <textarea
            className={styles.editableArea}
            value={editContent.age_comparison || ''}
            onChange={e => onEdit(e.target.value)}
            placeholder="나이별 시사점..."
            rows={3}
          />
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reportData.ageComparison.at_60_monthly_increase > 0 && (
              <div style={{ fontSize: 12, color: '#5E6AD2', fontWeight: 600 }}>
                📈 60세 시 예상 추가 보험료: +{reportData.ageComparison.at_60_monthly_increase.toLocaleString()}원/월
              </div>
            )}
            {reportData.ageComparison.at_65_note && (
              <div style={{ fontSize: 11, color: '#EF4444' }}>⚠️ {reportData.ageComparison.at_65_note}</div>
            )}
          </div>
        </div>
      )

    // 피칭 포인트
    case 'pitch_points':
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent.pitch_points || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="• 피칭 포인트 1&#10;• 피칭 포인트 2&#10;• 피칭 포인트 3"
          rows={5}
        />
      )

    // 화법 스크립트
    case 'consultation_script':
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent.consultation_script || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="실전 화법 스크립트..."
          rows={7}
        />
      )

    // 기타 AI 블록
    default:
      if (noData) return <Placeholder ai>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent[id] || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="내용을 직접 입력하거나 AI로 생성하세요"
          rows={4}
        />
      )
  }
}

function Placeholder({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <div style={{
      padding: '16px',
      background: '#F7F8FA',
      borderRadius: 8,
      fontSize: 12,
      color: '#8892A0',
      textAlign: 'center',
      border: '1.5px dashed #E5E7EB',
    }}>
      {ai && <span style={{ color: '#5E6AD2', marginRight: 4 }}>✨</span>}
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   PDF 미리보기 모달 (A4 인쇄용)
───────────────────────────────────────────────────────── */
function ReportModal({ data, onClose }: { data: any; onClose: () => void }) {
  const genDate = new Date(data.generatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const PAGE1_CONTRACTS = 8
  const contracts1 = data.contracts.slice(0, PAGE1_CONTRACTS)
  const contracts2 = data.contracts.slice(PAGE1_CONTRACTS)

  const chartData = (data.coverageSummary || [])
    .filter((c: any) => c.unit !== '유무' && c.total > 0)
    .sort((a: any, b: any) => b.total - a.total)
    .map((c: any) => ({ name: c.category, total: c.total, benchmark: c.benchmark_ok, fill: STATUS_COLOR[c.status] }))

  const pieData = (data.companyDistribution || []).map((d: any, i: number) => ({
    name: d.company, value: d.amount, percent: d.percent, fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const hasLastPage = chartData.length > 0 || pieData.length > 0
    || data.gapAnalysis?.length > 0
    || data.consultationScripts?.length > 0
    || data.ageComparison?.note

  const totalPages = (contracts2.length > 0 ? 2 : 1) + (hasLastPage ? 1 : 0)

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modalPanel}>
        <div className={styles.modalTopbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#5E6AD2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white' }}>iP</div>
            <div>
              <div className={styles.modalTopbarTitle}>{data.customer.name} 고객 보험 분석 리포트</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{genDate} &nbsp;·&nbsp; {totalPages}페이지</div>
            </div>
          </div>
          <div className={styles.modalTopbarBtns}>
            <button className={`${styles.topbarBtn} ${styles.topbarBtnPrint}`} onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
            <button className={`${styles.topbarBtn} ${styles.topbarBtnClose}`} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>

        <div className={styles.modalBody}>

          {/* ── PAGE 1 ── */}
          <div className={styles.a4Page}>
            <div className={styles.reportHeaderRow}>
              <div>
                <div className={styles.reportBrand}>iPlanner · Meeting Report</div>
                <div className={styles.reportTitle}>{data.customer.name} 고객 보험 분석</div>
                <div className={styles.reportSubtitle}>담당 설계사: {data.agent.name} &nbsp;|&nbsp; {genDate}</div>
              </div>
              <AgentCard agent={data.agent} />
            </div>

            <div className={styles.profileRow}>
              <div className={styles.profileAvatar}>{data.customer.name?.[0]}</div>
              <div>
                <div className={styles.profileName}>{data.customer.name}</div>
                <div className={styles.profileMeta}>
                  {data.customer.age    ? `${data.customer.age}세` : ''}
                  {data.customer.gender ? ` · ${data.customer.gender}` : ''}
                  {data.customer.job    ? ` · ${data.customer.job}` : ''}
                </div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statCardValue}>{data.stats.contractCount}건</div>
                <div className={styles.statCardLabel}>보험 계약</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statCardValue}>{data.stats.monthlyTotal.toLocaleString()}원</div>
                <div className={styles.statCardLabel}>월 보험료</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statCardValue}>{data.stats.coverageCount}건</div>
                <div className={styles.statCardLabel}>보장항목</div>
              </div>
            </div>

            {data.keyInsight && (
              <div className={styles.insightBox}>
                <div className={styles.insightLabel}>핵심 포인트</div>
                <div className={styles.insightText}>{data.keyInsight}</div>
              </div>
            )}

            <div className={styles.sectionTitle}>보유 계약 현황</div>
            <ContractTable contracts={contracts1} />

            {contracts2.length === 0 && (
              <div className={styles.reportFooter}>
                <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
                <span>1 / {totalPages}</span>
              </div>
            )}
          </div>

          {/* ── PAGE 2 (계약 초과) ── */}
          {contracts2.length > 0 && (
            <>
              <div className={styles.pageBreakHint}>2페이지</div>
              <div className={styles.a4Page}>
                <div className={styles.sectionTitle}>보유 계약 현황 (계속)</div>
                <ContractTable contracts={contracts2} />
                <div className={styles.reportFooter}>
                  <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
                  <span>2 / {totalPages}</span>
                </div>
              </div>
            </>
          )}

          {/* ── 마지막 페이지: 차트 + 공백 + 스크립트 ── */}
          {hasLastPage && (
            <>
              <div className={styles.pageBreakHint}>{contracts2.length > 0 ? '3페이지' : '2페이지'}</div>
              <div className={styles.a4Page}>

                {chartData.length > 0 && (
                  <>
                    <div className={styles.sectionTitle}>카테고리별 보장 금액</div>
                    <div style={{ marginBottom: 8, display: 'flex', gap: 16, fontSize: 11, color: '#636B78' }}>
                      {['good','ok','low'].map(s => (
                        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR[s], display: 'inline-block' }} />
                          {STATUS_LABEL[s]}
                        </span>
                      ))}
                    </div>
                    <div className={styles.chartWrap} style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 50, right: 60, top: 0, bottom: 0 }}>
                          <XAxis type="number" tickFormatter={fmtMoney} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                          <Tooltip formatter={(v: any) => fmtMoney(v)} />
                          <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                            {chartData.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}

                {(pieData.length > 0 || data.ageComparison?.note) && (
                  <div className={styles.chartsRow}>
                    {pieData.length > 0 && (
                      <div>
                        <div className={styles.sectionTitle}>월 보험료 분배</div>
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                                {pieData.map((entry: any, i: number) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Legend formatter={(value: any, entry: any) => `${value} ${entry.payload.percent}%`} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                              <Tooltip formatter={(v: any) => `${v.toLocaleString()}원`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {data.ageComparison?.note && (
                      <div>
                        <div className={styles.sectionTitle}>나이별 시사점</div>
                        <div style={{ background: '#F0F1FB', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.8, marginBottom: 10 }}>{data.ageComparison.note}</div>
                          {data.ageComparison.at_60_monthly_increase > 0 && (
                            <div style={{ fontSize: 11, color: '#5E6AD2', fontWeight: 600 }}>
                              60세 시 예상 추가 보험료: +{data.ageComparison.at_60_monthly_increase.toLocaleString()}원/월
                            </div>
                          )}
                          {data.ageComparison.at_65_note && (
                            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>{data.ageComparison.at_65_note}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {data.gapAnalysis?.length > 0 && (
                  <>
                    <div className={styles.sectionTitle}>보장 공백 분석</div>
                    <div className={styles.gapBox}>
                      {data.gapAnalysis.map((g: any, i: number) => (
                        <div key={i} className={styles.gapItem}>
                          <div className={styles.gapDot} />
                          <div className={styles.gapCategory}>{g.category}</div>
                          <div className={styles.gapMessage}>{g.message}</div>
                          <div className={styles.gapAmounts}>{fmtMoney(g.current)} → {fmtMoney(g.benchmark)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {data.consultationScripts?.length > 0 && (
                  <>
                    <div className={styles.sectionTitle}>화법 스크립트</div>
                    {data.consultationScripts.map((script: string, i: number) => (
                      <div key={i} className={styles.scriptBox}>
                        <div className={styles.scriptNum}>화법 {i + 1}</div>
                        <div className={styles.scriptText}>
                          <span className={styles.scriptQuote}>"</span>{script}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className={styles.reportFooter}>
                  <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
                  <span>{totalPages} / {totalPages}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* 설계사 명함 (PDF용) */
function AgentCard({ agent }: { agent: any }) {
  return (
    <div className={styles.agentCard}>
      <div className={styles.agentCardAccent} />
      <div className={styles.agentAvatar}>{agent.name?.[0] || 'A'}</div>
      <div className={styles.agentName}>{agent.name || '설계사'}</div>
      <div className={styles.agentTitle}>보험 컨설턴트</div>
      <div className={styles.agentInfo}>
        {agent.phone && <div>📞 {agent.phone}</div>}
        {agent.email && <div>✉ {agent.email}</div>}
        {agent.sns?.kakao && <div>💬 {agent.sns.kakao}</div>}
        {agent.sns?.instagram && <div>📸 {agent.sns.instagram}</div>}
      </div>
      <div className={styles.agentBrand}>iPlanner</div>
    </div>
  )
}

/* 계약 테이블 (PDF용) */
function ContractTable({ contracts }: { contracts: any[] }) {
  if (contracts.length === 0) return (
    <div style={{ fontSize: 13, color: '#8892A0', padding: '12px 0', marginBottom: 16 }}>유지 중인 계약이 없어요</div>
  )
  return (
    <table className={styles.contractTable}>
      <thead>
        <tr>
          <th>보험사</th>
          <th>상품명</th>
          <th>종류</th>
          <th>납입기간</th>
          <th>가입일</th>
          <th>월 보험료</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((c: any) => (
          <tr key={c.id}>
            <td>{c.company || '-'}</td>
            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productName || '-'}</td>
            <td>{c.insuranceType || '-'}</td>
            <td>{c.paymentYears || '-'}</td>
            <td>{c.contractStart || '-'}</td>
            <td>{c.monthlyFee ? `${c.monthlyFee.toLocaleString()}원` : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
