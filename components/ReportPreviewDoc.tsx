/**
 * ReportPreviewDoc — A4 리포트 콘텐츠 공용 컴포넌트
 * report.tsx(PDF 미리보기 모달)와 consultations.tsx(3열 인라인 뷰) 양쪽에서 사용
 */
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import styles from '../styles/Report.module.css'

// ── 상수 ──────────────────────────────────────────────
export const PIE_COLORS = ['#5E6AD2','#2A7D8D','#C5622D','#7C1E5E','#1E54B8','#3A2E8A','#D4945A','#94A3B8']
export const STATUS_COLOR: Record<string, string> = { good: '#2E5F8A', ok: '#C5621C', low: '#9B2335' }
export const STATUS_LABEL: Record<string, string>  = { good: '충분', ok: '보통', low: '부족' }

export function fmtMoney(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (v >= 10000000)  return `${(v / 10000000).toFixed(0)}천만`
  if (v >= 10000)     return `${(v / 10000).toFixed(0)}만`
  return `${v.toLocaleString()}원`
}

// ── 설계사 명함 ──────────────────────────────────────
export function AgentCard({ agent }: { agent: any }) {
  return (
    <div className={styles.agentCardBiz} style={{ flexShrink: 0 }}>
      <div className={styles.agentCardAccent} />
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 68, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 0, flexShrink: 0 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#5E6AD2', color: 'white', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7 }}>
            {agent.name?.[0] || 'A'}
          </div>
        </div>
        <div style={{ width: 1, background: '#E5E7EB', margin: '20px 0', flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>{agent.name || '설계사'}</div>
            <div style={{ fontSize: 12, color: '#636B78' }}>
              {agent.title || '보험 컨설턴트'}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#636B78', lineHeight: 1.8 }}>
            {agent.phone && <div>📞 {agent.phone}</div>}
            {agent.fax   && <div>📠 {agent.fax}</div>}
            {agent.email && <div>✉ {agent.email}</div>}
            {agent.sns?.kakao     && <div>💬 {agent.sns.kakao}</div>}
            {agent.sns?.instagram && <div>📸 {agent.sns.instagram}</div>}
          </div>
          {agent.company && <div style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{agent.company}</div>}
        </div>
      </div>
    </div>
  )
}

// ── 계약 테이블 ──────────────────────────────────────
export function ContractTable({ contracts }: { contracts: any[] }) {
  if (!contracts || contracts.length === 0) return (
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

// ── 메인 A4 콘텐츠 컴포넌트 ──────────────────────────
interface ReportPreviewDocProps {
  data: any
  editContent: Record<string, string>
  /** 비활성화할 블록 id 목록. 미전달 시 전체 활성화 */
  disabledBlocks?: string[]
  localCoverageSummary?: any[]
  localCompanyDistribution?: any[]
}

export function ReportPreviewDoc({
  data,
  editContent,
  disabledBlocks = [],
  localCoverageSummary = [],
  localCompanyDistribution = [],
}: ReportPreviewDocProps) {
  const isEnabled = (id: string) => !disabledBlocks.includes(id)

  const genDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const coverageSrc = data.coverageSummary?.length ? data.coverageSummary : localCoverageSummary
  const chartData = (coverageSrc || [])
    .filter((c: any) => c.unit !== '유무' && c.total > 0)
    .sort((a: any, b: any) => b.total - a.total)
    .map((c: any) => ({ name: c.category, total: c.total, benchmark: c.benchmark_ok, fill: STATUS_COLOR[c.status] }))

  const compDist = data.companyDistribution?.length ? data.companyDistribution : localCompanyDistribution
  const pieData = (compDist || []).map((d: any, i: number) => ({
    name: d.company, value: d.amount, percent: d.percent, fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  // 설계사 전용
  const agentKeyInsightText = editContent?.key_insight || data.keyInsight || ''
  const agentKeyInsight     = isEnabled('key_insight') && !!agentKeyInsightText

  const agentPitchPoints: string[] = isEnabled('pitch_points') && editContent?.pitch_points
    ? editContent.pitch_points.split('\n').map((s: string) => s.replace(/^[•\-]\s*/, '').trim()).filter(Boolean)
    : []

  const agentScriptLines: string[] = isEnabled('consultation_script') && editContent?.consultation_script
    ? editContent.consultation_script.split('\n\n').map((s: string) => s.trim()).filter(Boolean)
    : data.consultationScripts || []
  const agentScripts = agentScriptLines.length > 0

  const hasAgentPage = !!(agentKeyInsight || agentPitchPoints.length > 0 || agentScripts)

  const hasLastPage = coverageSrc.length > 0
    || chartData.length > 0 || pieData.length > 0
    || editContent?.gap_analysis || data.gapAnalysis?.length > 0
    || editContent?.age_comparison || data.ageComparison?.note
    || editContent?.claim_cases

  return (
    <div id="report-doc-print" className={styles.reportDoc}>

      {/* ── 섹션 1: 헤더 + 통계 + 계약 ── */}
      <div className={styles.reportHeaderRow}>
        <div>
          <div className={styles.reportTitle}>{data.customer?.name} 고객님 보험 분석</div>
          <div className={styles.reportSubtitle}>
            <div>
              {data.customer?.age ? `만 ${data.customer.age}세` : ''}
              {data.customer?.gender && data.customer.gender !== '미상' ? ` · ${data.customer.gender}` : ''}
              {data.customer?.job && data.customer.job !== '미상' ? ` · ${data.customer.job}` : ''}
            </div>
            <div>담당 설계사: {data.agent?.name}</div>
            <div>{genDate}</div>
          </div>
        </div>
        {data.agent && <AgentCard agent={data.agent} />}
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{data.stats?.contractCount}건</div>
          <div className={styles.statCardLabel}>보험 계약</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{data.stats?.monthlyTotal?.toLocaleString()}원</div>
          <div className={styles.statCardLabel}>월 보험료</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{data.stats?.coverageCount}건</div>
          <div className={styles.statCardLabel}>보장항목</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>보유 계약 현황</div>
      <ContractTable contracts={data.contracts || []} />

      <div className={styles.reportFooter}>
        <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
        <span>{genDate}</span>
      </div>

      {/* ── 섹션 2: 분석 ── */}
      {hasLastPage && (
        <div className={styles.reportSection}>

          {isEnabled('coverage_analysis') && coverageSrc.length > 0 && (
            <>
              <div className={styles.sectionTitle}>보장 분석</div>
              <table className={styles.contractTable} style={{ marginBottom: 24 }}>
                <thead>
                  <tr>
                    <th>보장 카테고리</th>
                    <th>현재 보장액</th>
                    <th>권장 기준</th>
                    <th style={{ textAlign: 'right' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageSrc.map((c: any, i: number) => (
                    <tr key={i}>
                      <td>{c.category}</td>
                      <td>{c.unit === '유무' ? (c.total > 0 ? '✓ 있음' : '없음') : fmtMoney(c.total)}</td>
                      <td style={{ color: '#8892A0', fontSize: 11 }}>{c.unit === '유무' ? '가입 권장' : fmtMoney(c.benchmark_ok) + ' 이상'}</td>
                      <td style={{ textAlign: 'right', color: STATUS_COLOR[c.status] ?? '#636B78', fontWeight: 600 }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {isEnabled('coverage_chart') && chartData.length > 0 && (
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

          {isEnabled('company_chart') && pieData.length > 0 && (
            <>
              <div className={styles.sectionTitle}>월 보험료 분배</div>
              <div className={styles.chartWrap} style={{ height: 200, marginBottom: 24 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                      {pieData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend formatter={(value: any, entry: any) => `${value} ${entry.payload.percent}%`} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `${v.toLocaleString()}원`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {isEnabled('age_comparison') && (editContent?.age_comparison || data.ageComparison?.note) && (
            <>
              <div className={styles.sectionTitle}>나이별 시사점</div>
              <div style={{ background: '#F0F1FB', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.8 }}>
                  {editContent?.age_comparison || data.ageComparison?.note}
                </div>
                {!editContent?.age_comparison && data.ageComparison?.at_60_monthly_increase > 0 && (
                  <div style={{ fontSize: 11, color: '#5E6AD2', fontWeight: 600, marginTop: 8 }}>
                    60세 시 예상 추가 보험료: +{data.ageComparison.at_60_monthly_increase.toLocaleString()}원/월
                  </div>
                )}
                {!editContent?.age_comparison && data.ageComparison?.at_65_note && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>{data.ageComparison.at_65_note}</div>
                )}
              </div>
            </>
          )}

          {isEnabled('gap_analysis') && (editContent?.gap_analysis || data.gapAnalysis?.length > 0) && (
            <>
              <div className={styles.sectionTitle}>보장 공백 분석</div>
              {editContent?.gap_analysis ? (
                <div className={styles.gapBox}>
                  {editContent.gap_analysis.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <div key={i} className={styles.gapItem}>
                      <div className={styles.gapDot} />
                      <div className={styles.gapMessage} style={{ flex: 1 }}>{line.replace(/^[•\-■]\s*/, '')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.gapBox}>
                  {(data.gapAnalysis || []).map((g: any, i: number) => (
                    <div key={i} className={styles.gapItem}>
                      <div className={styles.gapDot} />
                      <div className={styles.gapCategory}>{g.category}</div>
                      <div className={styles.gapMessage}>{g.message}</div>
                      <div className={styles.gapAmounts}>{fmtMoney(g.current)} → {fmtMoney(g.benchmark)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {isEnabled('claim_cases') && editContent?.claim_cases && (
            <>
              <div className={styles.sectionTitle}>보상 사례</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {editContent.claim_cases.split('\n\n').filter(Boolean).map((block: string, i: number) => (
                  <div key={i} style={{ background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>
                    {block.split('\n').map((line: string, j: number) => (
                      <div key={j} style={{ fontSize: 12, color: j === 0 ? '#1A1A2E' : '#636B78', fontWeight: j === 0 ? 600 : 400, lineHeight: 1.7 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.reportFooter}>
            <span>iPlanner v1.0 &nbsp;|&nbsp; AI 포함 설계사 전용</span>
            <span>{genDate}</span>
          </div>
        </div>
      )}

      {/* ── 섹션 3: 설계사 전용 ── */}
      {hasAgentPage && (
        <div className={styles.reportAgentSection}>
          <div className={styles.agentPageHeader}>
            <div className={styles.agentPageHeaderBar} />
            <div>
              <div className={styles.agentPageTitle}>설계사 전용</div>
              <div className={styles.agentPageSubtitle}>{data.customer?.name} 고객 미팅 준비 자료 &nbsp;·&nbsp; {genDate}</div>
            </div>
          </div>

          {agentKeyInsight && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionTitle}>후킹멘트</div>
              <div className={styles.insightBox}>
                <div className={styles.insightLabel}>미팅 시작 시 읽어줄 핵심 포인트</div>
                <div className={styles.insightText}>{agentKeyInsightText}</div>
              </div>
            </div>
          )}

          {agentPitchPoints.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionTitle}>핵심 피칭 포인트</div>
              <div className={styles.agentPointsList}>
                {agentPitchPoints.map((point: string, i: number) => (
                  <div key={i} className={styles.agentPointItem}>
                    <div className={styles.agentPointNum}>{i + 1}</div>
                    <div className={styles.agentPointText}>{point}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentScripts && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.sectionTitle}>화법 스크립트</div>
              {agentScriptLines.map((script: string, i: number) => (
                <div key={i} className={styles.scriptBox}>
                  <div className={styles.scriptNum}>화법 {i + 1}</div>
                  <div className={styles.scriptText}>
                    <span className={styles.scriptQuote}>"</span>{script}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.reportFooter}>
            <span>iPlanner v1.0 &nbsp;|&nbsp; 설계사 전용 — 고객 공유 금지</span>
            <span>{genDate}</span>
          </div>
        </div>
      )}
    </div>
  )
}
