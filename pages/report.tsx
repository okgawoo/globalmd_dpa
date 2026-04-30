import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Report.module.css'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { ReportPreviewDoc } from '../components/ReportPreviewDoc'

// ── 상수 ──────────────────────────────────────────────
const PIE_COLORS = ['#5E6AD2','#2A7D8D','#C5622D','#7C1E5E','#1E54B8','#3A2E8A','#D4945A','#94A3B8']
const STATUS_COLOR: Record<string, string> = { good: '#2E5F8A', ok: '#C5621C', low: '#9B2335' }
const STATUS_LABEL: Record<string, string> = { good: '충분', ok: '보통', low: '부족' }
const STATUS_BG: Record<string, string>    = { good: '#E8F0F7', ok: '#FBF0E8', low: '#F7E8EA' }

function fmtMoney(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (v >= 10000000)  return `${(v / 10000000).toFixed(0)}천만`
  if (v >= 10000)     return `${(v / 10000).toFixed(0)}만`
  return `${v.toLocaleString()}원`
}

// ── 보장 벤치마크 (generate-report.ts와 동일 기준) ──────
const CATEGORY_BENCHMARKS: Record<string, { good: number; ok: number; unit: string; label: string }> = {
  암진단:  { good: 50000000, ok: 30000000, unit: '원',  label: '암진단' },
  뇌혈관:  { good: 30000000, ok: 20000000, unit: '원',  label: '뇌혈관' },
  심장:    { good: 30000000, ok: 20000000, unit: '원',  label: '심장' },
  수술비:  { good: 3000000,  ok: 1500000,  unit: '원',  label: '수술비' },
  실손:    { good: 1,        ok: 1,        unit: '유무', label: '실손' },
  상해:    { good: 100000000,ok: 50000000, unit: '원',  label: '상해' },
  사고처리: { good: 30000000, ok: 10000000, unit: '원', label: '사고처리' },
  벌금:    { good: 5000000,  ok: 2000000,  unit: '원',  label: '벌금' },
  간병:    { good: 50000000, ok: 20000000, unit: '원',  label: '간병' },
  비급여:  { good: 1,        ok: 1,        unit: '유무', label: '비급여' },
}
function getCoverageStatus(category: string, total: number): 'good' | 'ok' | 'low' {
  const b = CATEGORY_BENCHMARKS[category]
  if (!b) return 'ok'
  if (b.unit === '유무') return total > 0 ? 'good' : 'low'
  if (total >= b.good) return 'good'
  if (total >= b.ok) return 'ok'
  return 'low'
}
function buildCoverageSummary(coverages: any[]) {
  const categoryMap: Record<string, number> = {}
  for (const cov of coverages) {
    if (!cov.category) continue
    categoryMap[cov.category] = (categoryMap[cov.category] || 0) + (cov.amount || 0)
  }
  return Object.entries(CATEGORY_BENCHMARKS).map(([cat, bench]) => ({
    category: bench.label,
    total: categoryMap[cat] || 0,
    benchmark_ok: bench.ok,
    benchmark_good: bench.good,
    unit: bench.unit,
    status: getCoverageStatus(cat, categoryMap[cat] || 0),
  }))
}

// ── 블록 정의 ──────────────────────────────────────────
const BLOCK_DEFS = [
  // ── 고객 리포트용 ──
  { id: 'header',              label: '헤더',                    hasAI: false, icon: '🪪',  agentOnly: false },
  { id: 'contracts',           label: '보유계약',                hasAI: false, icon: '📄',  agentOnly: false },
  { id: 'coverage_analysis',   label: '보장분석',                hasAI: false, icon: '📊',  agentOnly: false },
  { id: 'coverage_chart',      label: '보장금액 그래프(막대)',    hasAI: false, icon: '📈',  agentOnly: false },
  { id: 'company_chart',       label: '보험료 분배 그래프(도넛)', hasAI: false, icon: '🥧',  agentOnly: false },
  { id: 'gap_analysis',        label: '보장공백 진단',           hasAI: true,  icon: '⚠️', agentOnly: false },
  { id: 'claim_cases',         label: '보상 사례',               hasAI: true,  icon: '📋',  agentOnly: false },
  { id: 'age_comparison',      label: '나이별 시사점',           hasAI: true,  icon: '📅',  agentOnly: false },
  { id: 'rejection_risk',      label: '지급거절 위험 체크',      hasAI: true,  icon: '🚨',  agentOnly: false },
  { id: 'peer_comparison',     label: '동년배 비교',             hasAI: true,  icon: '👥',  agentOnly: false },
  { id: 'remodel_suggestion',  label: '리모델링 제안',           hasAI: true,  icon: '🔧',  agentOnly: false },
  // ── 설계사 전용 ──
  { id: 'key_insight',         label: '후킹멘트',                hasAI: true,  icon: '💡',  agentOnly: true },
  { id: 'pitch_points',        label: '피칭 포인트',             hasAI: true,  icon: '🎯',  agentOnly: true },
  { id: 'consultation_script', label: '화법 스크립트',           hasAI: true,  icon: '💬',  agentOnly: true },
] as const

type BlockId  = typeof BLOCK_DEFS[number]['id']
type BlockDef = { id: BlockId; label: string; hasAI: boolean; icon: string; agentOnly: boolean; enabled: boolean }

const DEFAULT_ENABLED: BlockId[] = BLOCK_DEFS.map(b => b.id)
const STORAGE_KEY = 'report_blocks_v1'

const initBlocks = (): BlockDef[] => {
  try {
    const saved = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { enabledIds, order }: { enabledIds: string[]; order: string[] } = JSON.parse(saved)
      // 저장된 순서로 정렬, 새로 추가된 블록은 끝에 추가
      const ordered = [
        ...order.map(id => BLOCK_DEFS.find(b => b.id === id)).filter(Boolean),
        ...BLOCK_DEFS.filter(b => !order.includes(b.id)),
      ] as typeof BLOCK_DEFS[number][]
      return ordered.map(b => ({
        ...b,
        // 저장된 블록은 저장된 상태 유지, 새로 추가된 블록은 기본 활성화
        enabled: order.includes(b.id) ? enabledIds.includes(b.id) : true,
      }))
    }
  } catch {}
  return BLOCK_DEFS.map(b => ({ ...b, enabled: DEFAULT_ENABLED.includes(b.id) }))
}

const saveBlocks = (blocks: BlockDef[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabledIds: blocks.filter(b => b.enabled).map(b => b.id),
      order: blocks.map(b => b.id),
    }))
  } catch {}
}

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
  const [customerContracts, setCustomerContracts] = useState<any[]>([])
  const [localCoverageSummary, setLocalCoverageSummary] = useState<any[]>([])
  const [dragIdx, setDragIdx]             = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx]     = useState<number | null>(null)
  const [saving, setSaving]               = useState(false)
  const [savedAt, setSavedAt]             = useState<string | null>(null)

  const layoutRef  = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 블록 상태 변경 시 localStorage 자동 저장
  useEffect(() => { saveBlocks(blocks) }, [blocks])

  // ── JS 기반 사이드바 스크롤 추적 (CSS sticky 레이아웃 구조 한계 우회) ──
  useEffect(() => {
    const sidebar = sidebarRef.current
    const layout  = layoutRef.current
    if (!sidebar || !layout) return

    const GAP = 20 // 뷰포트 상단으로부터 고정될 거리

    const update = () => {
      const scrollY    = window.scrollY
      const layoutTop  = layout.getBoundingClientRect().top + scrollY
      const sidebarH   = sidebar.offsetHeight
      const layoutH    = layout.offsetHeight

      const idealY   = scrollY + GAP - layoutTop
      const maxY     = layoutH - sidebarH - GAP
      const translateY = Math.max(0, Math.min(idealY, maxY))

      sidebar.style.transform = `translateY(${translateY}px)`
    }

    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

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
    setEditContent(prev => ({
      ...prev,
      key_insight: reportData.keyInsight || '',
      consultation_script: (reportData.consultationScripts || []).join('\n\n'),
      age_comparison: reportData.ageComparison?.note || '',
      pitch_points: (reportData.gapAnalysis || [])
        .map((g: any) => `• ${g.category}: ${g.message}`).join('\n'),
      claim_cases: prev.claim_cases || (reportData.claimCases || [])
        .map((c: any) => `■ ${c.name} (${c.masked_id})\n${c.situation}\n→ 수령 보험금: ${c.payout}`).join('\n\n'),
      rejection_risk: prev.rejection_risk || (reportData.rejectionRisk || []).join('\n'),
      peer_comparison: prev.peer_comparison || reportData.peerComparison || '',
      remodel_suggestion: prev.remodel_suggestion || reportData.remodelSuggestion || '',
    }))
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
    setCustomerContracts([])
    setLocalCoverageSummary([])
    supabase
      .from('dpa_contracts')
      .select('id, company, product_name, insurance_type, monthly_fee, dpa_coverages(category, amount)')
      .eq('customer_id', c.id)
      .eq('payment_status', '유지')
      .order('company')
      .then(({ data }) => {
        const contracts = data || []
        setCustomerContracts(contracts)
        const allCoverages = contracts.flatMap((ct: any) => ct.dpa_coverages || [])
        setLocalCoverageSummary(buildCoverageSummary(allCoverages))
      })
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

  const [blockLoading, setBlockLoading] = useState<string | null>(null)

  async function regenerateBlock(blockId: string) {
    if (!selected) return
    setBlockLoading(blockId)
    try {
      const res = await fetch('/api/generate-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected.id, blockId }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      const r = data.result
      const contentMap: Record<string, string> = {
        gap_analysis: (r.gap_analysis || []).map((g: any) => `• ${g.category}: ${g.message}`).join('\n'),
        key_insight: r.key_insight || '',
        claim_cases: (r.claim_cases || []).map((c: any) => `■ ${c.name} (${c.masked_id})\n${c.situation}\n→ 수령 보험금: ${c.payout}`).join('\n\n'),
        age_comparison: r.age_comparison?.note || '',
        consultation_script: (r.consultation_scripts || []).join('\n\n'),
        rejection_risk: (r.rejection_risk || []).join('\n'),
        peer_comparison: r.peer_comparison || '',
        remodel_suggestion: r.remodel_suggestion || '',
        pitch_points: (r.pitch_points || []).map((p: string) => `• ${p}`).join('\n'),
      }
      if (contentMap[blockId] !== undefined) {
        setEditContent(prev => ({ ...prev, [blockId]: contentMap[blockId] }))
      }
      // gap_analysis는 reportData도 업데이트
      if (blockId === 'gap_analysis' && r.gap_analysis) {
        setReportData((prev: any) => prev ? { ...prev, gapAnalysis: r.gap_analysis } : prev)
      }
    } catch (e: any) {
      alert('재생성 실패: ' + e.message)
    } finally {
      setBlockLoading(null)
    }
  }

  // ── 리포트 저장 ──
  async function saveReport() {
    if (!selected || !reportData) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const payload = {
        agent_id: user.id,
        customer_id: selected.id,
        report_data: reportData,
        edit_content: editContent,
        updated_at: new Date().toISOString(),
      }
      const { data: existing } = await supabase
        .from('dpa_reports')
        .select('id')
        .eq('customer_id', selected.id)
        .eq('agent_id', user.id)
        .single()
      if (existing) {
        await supabase.from('dpa_reports').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('dpa_reports').insert(payload)
      }
      setSavedAt(new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── 드래그 핸들러 ──
  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIdx(idx)
  }
  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...blocks]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setBlocks(next)
    setDragIdx(null)
    setDragOverIdx(null)
  }
  function onDragEnd() { setDragIdx(null); setDragOverIdx(null) }
  function toggleBlock(id: string) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b))
  }

  const enabledBlocks = blocks.filter(b => b.enabled)
  const localStats    = selected ? getLocalStats(selected.id) : null

  const localMonthlyTotal = customerContracts.reduce((s: number, c: any) => s + (c.monthly_fee || 0), 0)
  const localCompanyDistribution = (() => {
    const map: Record<string, number> = {}
    for (const c of customerContracts) {
      if (!c.company) continue
      map[c.company] = (map[c.company] || 0) + (c.monthly_fee || 0)
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([company, amount]) => ({
        company, amount,
        percent: localMonthlyTotal > 0 ? Math.round((amount / localMonthlyTotal) * 100) : 0,
      }))
  })()

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>고객 리포트</div>
          <div className={styles.pageDesc}>블록을 선택하고 AI 보장 분석 리포트를 생성하세요</div>
        </div>
      </div>

      <div className={styles.reportLayout} ref={layoutRef}>

        {/* ── 좌: 블록 에디터 ── */}
        <div className={styles.editorPanel}>
          <div className={styles.editorBlocks}>
            {enabledBlocks.map((block, idx) => {
              const prevBlock = enabledBlocks[idx - 1]
              const showDivider = block.agentOnly && (!prevBlock || !prevBlock.agentOnly)
              return (
                <div key={block.id}>
                  {showDivider && (
                    <div className={styles.agentOnlyDivider}>
                      <div className={styles.agentOnlyLine} />
                      <span className={styles.agentOnlyLabel}>설계사 전용</span>
                      <div className={styles.agentOnlyLine} />
                    </div>
                  )}
                  <EditorBlock
                    block={block}
                    agent={agent}
                    customer={selected}
                    localStats={localStats}
                    customerContracts={customerContracts}
                    localCoverageSummary={localCoverageSummary}
                    localCompanyDistribution={localCompanyDistribution}
                    reportData={reportData}
                    editContent={editContent}
                    loading={blockLoading === block.id}
                    isGenerating={loading}
                    hasReportData={!!reportData}
                    onEdit={(val: string) =>
                      setEditContent(prev => ({ ...prev, [block.id]: val }))
                    }
                    onAIGenerate={() => regenerateBlock(block.id)}
                  />
                </div>
              )
            })}
            {enabledBlocks.length === 0 && (
              <div className={styles.editorEmpty}>
                <div style={{ fontSize: 13, color: '#8892A0' }}>오른쪽에서 블록을 선택해 주세요</div>
              </div>
            )}
          </div>
        </div>

        {/* ── 우: 사이드바 ── */}
        <div className={styles.sidebar} ref={sidebarRef}>

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
                  <div style={{ fontSize: 10, color: '#5E6AD2', fontWeight: 600, background: '#F0F1FB', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>
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
              <button className={styles.resetBtn} onClick={() => { localStorage.removeItem(STORAGE_KEY); setBlocks(initBlocks()) }} title="초기화">↺</button>
            </div>
            <div className={styles.blockList}>
              {blocks.map((block, idx) => {
                const prevBlock = blocks[idx - 1]
                const showDivider = block.agentOnly && (!prevBlock || !prevBlock.agentOnly)
                return (
                  <div key={block.id}>
                    {showDivider && (
                      <div className={styles.agentOnlyDivider}>
                        <div className={styles.agentOnlyLine} />
                        <span className={styles.agentOnlyLabel}>설계사 전용</span>
                        <div className={styles.agentOnlyLine} />
                      </div>
                    )}
                    <div
                      className={`${styles.blockItem} ${block.agentOnly ? styles.blockItemAgentOnly : ''} ${dragIdx === idx ? styles.blockItemDragging : ''} ${dragOverIdx === idx && dragIdx !== idx ? styles.blockItemDropTarget : ''}`}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={e => onDragOver(e, idx)}
                      onDrop={e => onDrop(e, idx)}
                      onDragEnd={onDragEnd}
                    >
                      <span className={styles.dragHandle} />
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
                  </div>
                )
              })}
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
              type="button"
              className={styles.previewBtn}
              onClick={() => setModalOpen(true)}
              disabled={!reportData}
            >
              🖨 PDF 미리보기
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={saveReport}
              disabled={!reportData || saving}
            >
              {saving ? '저장 중...' : '💾 리포트 저장'}
            </button>
            {savedAt && <span className={styles.savedAt}>✓ {savedAt} 저장됨</span>}
          </div>
        </div>
      </div>

      {modalOpen && reportData && (
        <ReportModal data={reportData} blocks={blocks} editContent={editContent} localCoverageSummary={localCoverageSummary} localCompanyDistribution={localCompanyDistribution} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

// ── 에디터 블록 컴포넌트 ──────────────────────────────
function EditorBlock({ block, agent, customer, localStats, customerContracts, localCoverageSummary, localCompanyDistribution, reportData, editContent, loading, isGenerating, hasReportData, onEdit, onAIGenerate }: {
  block: BlockDef
  agent: any
  customer: any
  localStats: any
  customerContracts: any[]
  localCoverageSummary: any[]
  localCompanyDistribution: any[]
  reportData: any
  editContent: Record<string, string>
  loading: boolean
  isGenerating: boolean
  hasReportData: boolean
  onEdit: (val: string) => void
  onAIGenerate: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className={styles.editorBlock}>
      <div className={styles.editorBlockHeader}>
        <div className={styles.editorBlockTitle}>
          <span>{block.icon}</span>
          <span>{block.label}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {block.id === 'header' && !confirmed && (
            <span style={{ fontSize: 13, color: '#B0B8C4' }}>명함 정보는 설정에서 수정할 수 있습니다</span>
          )}
          {block.hasAI && !confirmed && (
            <button
              className={`${styles.aiBtn} ${hasReportData ? styles.aiBtnVisible : ''}`}
              onClick={onAIGenerate}
              disabled={loading}
            >
              {loading ? '⏳ 생성 중...' : '✨ AI 추천 재생성'}
            </button>
          )}
          <button
            onClick={() => setConfirmed(v => !v)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: confirmed ? '#636B78' : '#5E6AD2',
              background: confirmed ? '#F3F4F6' : '#EEF0FB',
              border: 'none',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {confirmed ? '수정' : '확인'}
          </button>
        </div>
      </div>
      {!confirmed && (
        <div className={styles.editorBlockContent}>
          <BlockContent
            id={block.id}
            agent={agent}
            customer={customer}
            localStats={localStats}
            customerContracts={customerContracts}
            localCoverageSummary={localCoverageSummary}
            localCompanyDistribution={localCompanyDistribution}
            reportData={reportData}
            editContent={editContent}
            onEdit={onEdit}
            isGenerating={loading || isGenerating}
          />
        </div>
      )}
    </div>
  )
}

// ── 블록 내용 렌더러 ──────────────────────────────────
const BLOCK_PLACEHOLDERS: Record<string, string> = {
  header:              '',
  contracts:           '보유 계약 목록이 여기에 표시됩니다',
  coverage_analysis:   '보장 현황 분석이 여기에 표시됩니다',
  gap_analysis:        '보장 공백 진단이 여기에 표시됩니다',
  key_insight:         '고객 맞춤 후킹멘트가 여기에 표시됩니다',
  age_comparison:      '나이별 시사점이 여기에 표시됩니다',
  rejection_risk:      '지급거절 위험 분석이 여기에 표시됩니다',
  peer_comparison:     '동년배 비교 분석이 여기에 표시됩니다',
  remodel_suggestion:  '리모델링 제안이 여기에 표시됩니다',
  pitch_points:        '피칭 포인트가 여기에 표시됩니다',
  consultation_script: '화법 스크립트가 여기에 표시됩니다',
}

function BlockContent({ id, agent, customer, localStats, customerContracts, localCoverageSummary, localCompanyDistribution, reportData, editContent, onEdit, isGenerating }: any) {
  const noData = !reportData

  if (!customer && id !== 'header') return <BlockSkeleton text={BLOCK_PLACEHOLDERS[id] || '고객 선택 후 표시됩니다'} />

  switch (id) {

    // 헤더 (전자명함 + 고객 프로필 통합)
    case 'header': {
      const gc = '#D1D5DB' // ghost color
      return (
        <div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>

          {/* 좌: 고객 정보 */}
          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>
            {/* 이름 */}
            <div style={{ fontSize: 26, fontWeight: 700, color: customer ? '#1A1A2E' : gc, marginBottom: 6 }}>
              {customer ? `${customer.name} 고객님` : '홍길동 고객님'}
            </div>
            {/* 나이·성별·직업 */}
            <div style={{ fontSize: 15, color: customer ? '#636B78' : gc, marginBottom: 20 }}>
              {customer
                ? [customer.age && `${customer.age}세`, customer.gender, customer.job].filter(Boolean).join(' · ')
                : '만 00세 · 남성 · 직장인'}
            </div>
            {/* 통계 */}
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: customer ? '#5E6AD2' : gc }}>
                  {customer ? `${localStats?.contractCount ?? 0}건` : '0건'}
                </div>
                <div style={{ fontSize: 12, color: '#8892A0', marginTop: 2 }}>유지계약</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: customer ? '#5E6AD2' : gc }}>
                  {customer ? `${(localStats?.monthlyTotal ?? 0).toLocaleString()}원` : '000,000원'}
                </div>
                <div style={{ fontSize: 12, color: '#8892A0', marginTop: 2 }}>월보험료</div>
              </div>
            </div>
          </div>

          {/* 우: 전자명함 */}
          {agent && (
            <div className={styles.agentCardBiz} style={{ flexShrink: 0 }}>
              <div className={styles.agentCardAccent} />
              <div style={{ display: 'flex', height: '100%' }}>
                <div style={{ width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#5E6AD2', color: 'white', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {agent.name?.[0] || 'A'}
                  </div>
                </div>
                <div style={{ width: 1, background: '#E5E7EB', margin: '14px 0', flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 1 }}>{agent.name || '설계사'}</div>
                    <div style={{ fontSize: 11, color: '#636B78' }}>
                      {agent.settings?.title || '보험 컨설턴트'}
                      {agent.settings?.company && <span style={{ color: '#B0B8C4' }}> · {agent.settings.company}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#636B78', lineHeight: 1.7 }}>
                    {agent.phone         && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📞 {agent.phone}</div>}
                    {agent.settings?.fax && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📠 {agent.settings.fax}</div>}
                    {agent.email         && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {agent.email}</div>}
                    {agent.settings?.sns?.kakao     && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💬 {agent.settings.sns.kakao}</div>}
                    {agent.settings?.sns?.instagram && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📸 {agent.settings.sns.instagram}</div>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5E6AD2', letterSpacing: '0.05em' }}>iPlanner</div>
                </div>
              </div>
            </div>
          )}

        </div>
        </div>
      )
    }

    // 보유계약
    case 'contracts': {
      const contracts = customerContracts?.length ? customerContracts : (reportData?.contracts || [])
      if (!customer) return <BlockSkeleton text="고객 선택 후 표시됩니다" />
      if (!contracts.length) return <Placeholder>유지 중인 계약이 없어요</Placeholder>
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
              {contracts.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.company || '-'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.product_name || c.productName || '-'}</td>
                  <td>{c.insurance_type || c.insuranceType || '-'}</td>
                  <td>{(c.monthly_fee ?? c.monthlyFee) ? `${(c.monthly_fee ?? c.monthlyFee).toLocaleString()}원` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // 보장분석 — 뱃지 목록
    case 'coverage_analysis': {
      const summary = localCoverageSummary?.length ? localCoverageSummary : (reportData?.coverageSummary || [])
      if (!customer) return <BlockSkeleton text="고객 선택 후 표시됩니다" />
      if (!summary.length) return <Placeholder>보장 데이터가 없어요</Placeholder>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {summary.map((c: any) => (
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
                <span style={{ color: '#8892A0', fontSize: 10, fontWeight: 700 }}>{fmtMoney(c.total)}</span>
              )}
            </div>
          ))}
        </div>
      )
    }

    // 보장금액 차트
    case 'coverage_chart': {
      const summary = localCoverageSummary?.length ? localCoverageSummary : (reportData?.coverageSummary || [])
      if (!customer) return <BlockSkeleton text="고객 선택 후 표시됩니다" />
      const chartData = summary
        .filter((c: any) => c.unit !== '유무' && c.total > 0)
        .sort((a: any, b: any) => b.total - a.total)
        .map((c: any) => ({ name: c.category, total: c.total, fill: STATUS_COLOR[c.status] }))
      if (!chartData.length) return <Placeholder>보장 데이터가 없어요</Placeholder>
      return (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 50, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={fmtMoney} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: any) => fmtMoney(v)} />
              <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                {chartData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    // 보험료 분배 차트
    case 'company_chart': {
      const dist = localCompanyDistribution?.length ? localCompanyDistribution : (reportData?.companyDistribution || [])
      if (!customer) return <BlockSkeleton text="고객 선택 후 표시됩니다" />
      const pieData = dist.map((d: any, i: number) => ({
        name: d.company, value: d.amount, percent: d.percent, fill: PIE_COLORS[i % PIE_COLORS.length],
      }))
      if (!pieData.length) return <Placeholder>계약 데이터가 없어요</Placeholder>
      return (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Legend formatter={(value: any, entry: any) => `${value} ${entry.payload.percent}%`} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v.toLocaleString()}원`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }

    // 보장공백 진단
    case 'gap_analysis':
      if (noData && !editContent.gap_analysis) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      if (!reportData?.gapAnalysis?.length) return <Placeholder>공백 항목이 없어요 🎉</Placeholder>
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

    // 또래 유사 사례
    case 'claim_cases':
      if (noData && !editContent.claim_cases) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent.claim_cases || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="또래 유사 사례..."
          rows={8}
        />
      )

    // 후킹멘트
    case 'key_insight':
      if (noData && !editContent.key_insight) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
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
      if (noData && !editContent.age_comparison) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      if (!reportData?.ageComparison?.note && !editContent.age_comparison) return <Placeholder>나이 정보가 없어요</Placeholder>
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
            {reportData?.ageComparison?.at_60_monthly_increase > 0 && (
              <div style={{ fontSize: 12, color: '#5E6AD2', fontWeight: 600 }}>
                📈 60세 시 예상 추가 보험료: +{reportData.ageComparison.at_60_monthly_increase.toLocaleString()}원/월
              </div>
            )}
            {reportData?.ageComparison?.at_65_note && (
              <div style={{ fontSize: 11, color: '#EF4444' }}>⚠️ {reportData.ageComparison.at_65_note}</div>
            )}
          </div>
        </div>
      )

    // 피칭 포인트
    case 'pitch_points':
      if (noData && !editContent.pitch_points) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
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
      if (noData && !editContent.consultation_script) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
      return (
        <textarea
          className={styles.editableArea}
          value={editContent.consultation_script || ''}
          onChange={e => onEdit(e.target.value)}
          placeholder="실전 화법 스크립트..."
          rows={7}
        />
      )

    // 기타 AI 블록 (rejection_risk, peer_comparison, remodel_suggestion 등)
    default:
      if (noData && !editContent[id]) return <Placeholder ai loading={isGenerating}>AI 분석 생성 버튼을 눌러주세요</Placeholder>
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

function BlockSkeleton({ text }: { text: string }) {
  return (
    <div className={styles.blockSkeleton}>
      <span>{text}</span>
    </div>
  )
}

/* AI 분석 중 shimmer 스켈레톤 */
function AILoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['88%', '72%', '95%', '65%', '40%', '80%']
  return (
    <div style={{ padding: '4px 0' }}>
      <div className={styles.skeletonLabel}>
        <div className={styles.skeletonDot} />
        <div className={styles.skeletonDot} />
        <div className={styles.skeletonDot} />
        <span>AI 분석 중</span>
      </div>
      <div className={styles.skeletonWrap}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={styles.skeletonLine}
            style={{ width: widths[i % widths.length], animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function Placeholder({ children, ai, loading }: { children: React.ReactNode; ai?: boolean; loading?: boolean }) {
  if (ai && loading) return <AILoadingSkeleton lines={5} />
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
function ReportModal({ data, blocks, editContent, localCoverageSummary, localCompanyDistribution, onClose }: { data: any; blocks: BlockDef[]; editContent: Record<string, any>; localCoverageSummary: any[]; localCompanyDistribution: any[]; onClose: () => void }) {
  const genDate = new Date(data.generatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const disabledBlocks = blocks.filter(b => !b.enabled).map(b => b.id)
  const [printToast, setPrintToast] = useState(false)
  function showPrintToast() {
    setPrintToast(true)
    setTimeout(() => setPrintToast(false), 2800)
  }

  return (
    <div className={`${styles.modalOverlay} report-print-overlay`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {printToast && (
        <div style={{
          position: 'fixed', top: 180, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1A2E', color: '#fff', fontSize: 13, fontWeight: 500,
          padding: '10px 20px', borderRadius: 10, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          animation: 'fadeInDown 0.2s ease',
        }}>
          🖨 인쇄 기능은 정식 오픈 후 제공될 예정이에요
        </div>
      )}
      <div className={`${styles.modalPanel} report-print-area`}>
        <div className={`${styles.modalTopbar} report-print-topbar`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7C88E8, #4A56C0)', boxShadow: '0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: 18, fontWeight: 400, fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1 }}>i</span>
              </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>아이플래너</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{data.customer.name} 고객 보험 분석 · {genDate}</div>
            </div>
          </div>
          <div className={styles.modalTopbarBtns}>
            <button className={`${styles.topbarBtn} ${styles.topbarBtnPrint}`} onClick={showPrintToast}>🖨 인쇄 / PDF 저장</button>
            <button className={`${styles.topbarBtn} ${styles.topbarBtnClose}`} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>

        <div className={styles.modalBody}>
          <ReportPreviewDoc
            data={data}
            editContent={editContent}
            disabledBlocks={disabledBlocks}
            localCoverageSummary={localCoverageSummary}
            localCompanyDistribution={localCompanyDistribution}
          />
        </div>
      </div>
    </div>
  )
}
