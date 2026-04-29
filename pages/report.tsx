import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Report.module.css'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  암진단: '#EF4444', 뇌혈관: '#F97316', 심장: '#EAB308', 간병: '#8B5CF6',
  수술비: '#06B6D4', 실손: '#10B981', 비급여: '#6366F1', 상해: '#3B82F6',
  사고처리: '#F59E0B', 벌금: '#6B7280', 특이사항: '#9CA3AF',
}
const PIE_COLORS = ['#5E6AD2','#7C86E0','#10B981','#F59E0B','#EF4444','#06B6D4','#8B5CF6','#F97316']
const STATUS_COLOR: Record<string, string> = { good: '#10B981', ok: '#F59E0B', low: '#EF4444' }
const STATUS_LABEL: Record<string, string> = { good: '충분', ok: '보통', low: '부족' }

function fmtMoney(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (v >= 10000000) return `${(v / 10000000).toFixed(0)}천만`
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return `${v.toLocaleString()}원`
}

export default function ReportPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('dpa_agents').select('*').eq('user_id', data.user.id).single().then(({ data: ag }) => {
        if (!ag) return
        setAgent(ag)
        Promise.all([
          supabase.from('dpa_customers').select('id,name,age,gender,job,phone').eq('agent_id', ag.id).order('name'),
          supabase.from('dpa_contracts').select('customer_id,monthly_fee').eq('agent_id', ag.id).eq('payment_status', '유지'),
        ]).then(([{ data: c }, { data: ct }]) => {
          setCustomers(c || [])
          setContracts(ct || [])
        })
      })
    })
  }, [])

  const filtered = customers.filter(c =>
    c.name?.includes(searchQ) || c.phone?.includes(searchQ)
  ).slice(0, 10)

  function selectCustomer(c: any) {
    setSelected(c)
    setSearchQ(c.name)
    setShowDropdown(false)
  }

  function getCustomerStats(customerId: string) {
    const cc = contracts.filter(c => c.customer_id === customerId)
    return {
      contractCount: cc.length,
      monthlyTotal: cc.reduce((s, c) => s + (c.monthly_fee || 0), 0),
    }
  }

  async function generateReport() {
    if (!selected || !agent) return
    setLoading(true)
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected.id, agentId: agent.id }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setReportData(data)
      setModalOpen(true)
    } catch (e: any) {
      alert('리포트 생성 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = selected ? getCustomerStats(selected.id) : null

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.pageTitle}>고객 리포트</div>
        <div className={styles.pageDesc}>고객을 선택하고 AI 보장 분석 리포트를 생성하세요</div>
      </div>

      <div className={styles.searchBox}>
        <label className={styles.searchLabel}>고객 선택</label>
        <input
          className={styles.searchInput}
          placeholder="고객 이름 또는 연락처 검색"
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); setShowDropdown(true); setSelected(null) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        {showDropdown && searchQ && (
          <div className={styles.dropdown}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#8892A0' }}>검색 결과 없음</div>
            ) : filtered.map(c => {
              const s = getCustomerStats(c.id)
              return (
                <div key={c.id} className={styles.dropdownItem} onMouseDown={() => selectCustomer(c)}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#5E6AD2', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.name?.[0]}</span>
                  <span>{c.name}</span>
                  <span style={{ fontSize: 11, color: '#8892A0' }}>{c.age ? `${c.age}세` : ''}</span>
                  <span className={styles.dropdownMeta}>{s.contractCount}건 · {s.monthlyTotal.toLocaleString()}원</span>
                </div>
              )
            })}
          </div>
        )}

        {selected && (
          <>
            <div className={styles.selectedCard} style={{ marginTop: 12 }}>
              <div className={styles.selectedAvatar}>{selected.name?.[0]}</div>
              <div style={{ flex: 1 }}>
                <div className={styles.selectedName}>{selected.name}</div>
                <div className={styles.selectedMeta}>{selected.age ? `${selected.age}세` : ''}{selected.gender ? ` · ${selected.gender}` : ''}{selected.job ? ` · ${selected.job}` : ''}</div>
                {stats && (
                  <div className={styles.selectedStats}>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{stats.contractCount}건</div>
                      <div className={styles.statLabel}>유지 계약</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{stats.monthlyTotal.toLocaleString()}원</div>
                      <div className={styles.statLabel}>월 보험료</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              className={styles.generateBtn}
              onClick={generateReport}
              disabled={loading}
            >
              {loading ? 'AI 분석 중...' : '리포트 생성하기'}
            </button>
          </>
        )}
      </div>

      {modalOpen && reportData && (
        <ReportModal data={reportData} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

/* ──────────────────────────────────────
   리포트 모달
────────────────────────────────────── */
function ReportModal({ data, onClose }: { data: any; onClose: () => void }) {
  const genDate = new Date(data.generatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // 계약 목록 — 페이지당 최대 10건, 초과시 다음 페이지
  const PAGE1_CONTRACTS = 8
  const contracts1 = data.contracts.slice(0, PAGE1_CONTRACTS)
  const contracts2 = data.contracts.slice(PAGE1_CONTRACTS)

  // 카테고리 차트 데이터
  const chartData = data.coverageSummary
    .filter((c: any) => c.unit !== '유무' && c.total > 0)
    .sort((a: any, b: any) => b.total - a.total)
    .map((c: any) => ({
      name: c.category,
      total: c.total,
      benchmark: c.benchmark_ok,
      fill: STATUS_COLOR[c.status],
    }))

  // 도넛 차트 데이터
  const pieData = data.companyDistribution.map((d: any, i: number) => ({
    name: d.company,
    value: d.amount,
    percent: d.percent,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalTopbar}>
        <div className={styles.modalTopbarTitle}>{data.customer.name} 고객 보험 분석 리포트</div>
        <div className={styles.modalTopbarBtns}>
          <button className={`${styles.topbarBtn} ${styles.topbarBtnPrint}`} onClick={() => window.print()}>인쇄 / PDF</button>
          <button className={`${styles.topbarBtn} ${styles.topbarBtnClose}`} onClick={onClose}>닫기</button>
        </div>
      </div>

      <div className={styles.modalBody}>

        {/* ── PAGE 1: 헤더 + 프로필 + 핵심포인트 + 계약목록(일부) ── */}
        <div className={styles.a4Page}>
          {/* 헤더 */}
          <div className={styles.reportHeaderRow}>
            <div>
              <div className={styles.reportBrand}>iPlanner · Meeting Report</div>
              <div className={styles.reportTitle}>{data.customer.name} 고객 보험 분석</div>
              <div className={styles.reportSubtitle}>담당 설계사: {data.agent.name} &nbsp;|&nbsp; {genDate}</div>
            </div>
            <AgentCard agent={data.agent} />
          </div>

          {/* 고객 프로필 */}
          <div className={styles.profileRow}>
            <div className={styles.profileAvatar}>{data.customer.name?.[0]}</div>
            <div>
              <div className={styles.profileName}>{data.customer.name}</div>
              <div className={styles.profileMeta}>
                {data.customer.age ? `${data.customer.age}세` : ''}
                {data.customer.gender ? ` · ${data.customer.gender}` : ''}
                {data.customer.job ? ` · ${data.customer.job}` : ''}
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

          {/* 핵심 포인트 */}
          {data.keyInsight && (
            <div className={styles.insightBox}>
              <div className={styles.insightLabel}>핵심 포인트</div>
              <div className={styles.insightText}>{data.keyInsight}</div>
            </div>
          )}

          {/* 보유 계약 현황 */}
          <div className={styles.sectionTitle}>보유 계약 현황</div>
          <ContractTable contracts={contracts1} />

          {contracts2.length === 0 && (
            <div className={styles.reportFooter}>
              <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
              <span>1 / {data.contracts.length > PAGE1_CONTRACTS ? 3 : 2}</span>
            </div>
          )}
        </div>

        {/* ── PAGE 2 (계약 초과분): 계약 추가 목록 ── */}
        {contracts2.length > 0 && (
          <>
            <div className={styles.pageBreakHint}>2페이지</div>
            <div className={styles.a4Page}>
              <div className={styles.sectionTitle}>보유 계약 현황 (계속)</div>
              <ContractTable contracts={contracts2} />
              <div className={styles.reportFooter}>
                <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
                <span>2 / 3</span>
              </div>
            </div>
          </>
        )}

        {/* ── PAGE 2/3: 차트 + 보장공백 + 스크립트 ── */}
        <div className={styles.pageBreakHint}>{contracts2.length > 0 ? '3페이지' : '2페이지'}</div>
        <div className={styles.a4Page}>

          {/* 카테고리별 보장 금액 */}
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

          {/* 도넛 + 나이 비교 */}
          <div className={styles.chartsRow}>
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
                    <Legend
                      formatter={(value: any, entry: any) => `${value} ${entry.payload.percent}%`}
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <Tooltip formatter={(v: any) => `${v.toLocaleString()}원`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 나이별 코멘트 */}
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

          {/* 보장 공백 분석 */}
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

          {/* 추천 상담 스크립트 */}
          {data.consultationScripts?.length > 0 && (
            <>
              <div className={styles.sectionTitle}>추천 상담 스크립트</div>
              {data.consultationScripts.map((script: string, i: number) => (
                <div key={i} className={styles.scriptBox}>
                  <div className={styles.scriptNum}>Script {i + 1}</div>
                  <div className={styles.scriptText}>
                    <span className={styles.scriptQuote}>"</span>{script}
                  </div>
                </div>
              ))}
            </>
          )}

          <div className={styles.reportFooter}>
            <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
            <span>{contracts2.length > 0 ? '3' : '2'} / {contracts2.length > 0 ? 3 : 2}</span>
          </div>
        </div>

      </div>
    </div>
  )
}

/* 설계사 명함 */
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

/* 계약 테이블 */
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
