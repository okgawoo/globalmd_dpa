import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CATEGORY_BENCHMARKS: Record<string, { good: number; ok: number; unit: string; label: string }> = {
  암진단:   { good: 50000000, ok: 30000000, unit: '원', label: '암진단' },
  뇌혈관:   { good: 30000000, ok: 20000000, unit: '원', label: '뇌혈관' },
  심장:    { good: 30000000, ok: 20000000, unit: '원', label: '심장' },
  수술비:   { good: 3000000,  ok: 1500000,  unit: '원', label: '수술비' },
  실손:    { good: 1,        ok: 1,        unit: '유무', label: '실손' },
  상해:    { good: 100000000,ok: 50000000, unit: '원', label: '상해' },
  사고처리:  { good: 30000000, ok: 10000000, unit: '원', label: '사고처리' },
  벌금:    { good: 5000000,  ok: 2000000,  unit: '원', label: '벌금' },
  간병:    { good: 50000000, ok: 20000000, unit: '원', label: '간병' },
  비급여:   { good: 1,        ok: 1,        unit: '유무', label: '비급여' },
}

function getStatus(category: string, total: number): 'good' | 'ok' | 'low' {
  const b = CATEGORY_BENCHMARKS[category]
  if (!b) return 'ok'
  if (b.unit === '유무') return total > 0 ? 'good' : 'low'
  if (total >= b.good) return 'good'
  if (total >= b.ok) return 'ok'
  return 'low'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { customerId } = req.body
  if (!customerId) return res.status(400).json({ error: '고객 정보가 없어요' })

  // 1. 고객/계약/보장 데이터 조회
  const [
    { data: customer },
    { data: contracts },
    { data: youtubeAnalyses },
  ] = await Promise.all([
    supabase.from('dpa_customers').select('*').eq('id', customerId).single(),
    supabase.from('dpa_contracts').select('*, dpa_coverages(*)').eq('customer_id', customerId).eq('payment_status', '유지'),
    supabase.from('youtube_analyses').select('summary, key_points, pitch_points, scripts, comparison_criteria').limit(10),
  ])

  if (!customer) return res.status(404).json({ error: '고객을 찾을 수 없어요' })

  // customer.agent_id(= auth user_id)로 agent 조회
  const { data: agent } = await supabase.from('dpa_agents').select('*').eq('user_id', customer.agent_id).single()

  // 2. 통계 계산
  const activeContracts = contracts || []
  const monthlyTotal = activeContracts.reduce((s: number, c: any) => s + (c.monthly_fee || 0), 0)
  const allCoverages = activeContracts.flatMap((c: any) => c.dpa_coverages || [])
  const coverageCount = allCoverages.length

  // 3. 카테고리별 합산
  const categoryMap: Record<string, number> = {}
  for (const cov of allCoverages) {
    if (!cov.category) continue
    categoryMap[cov.category] = (categoryMap[cov.category] || 0) + (cov.amount || 0)
  }

  const coverageSummary = Object.entries(CATEGORY_BENCHMARKS).map(([cat, bench]) => ({
    category: bench.label,
    total: categoryMap[cat] || 0,
    benchmark_ok: bench.ok,
    benchmark_good: bench.good,
    unit: bench.unit,
    status: getStatus(cat, categoryMap[cat] || 0),
  }))

  // 4. 보험사별 월보험료 분포
  const companyMap: Record<string, number> = {}
  for (const c of activeContracts) {
    if (!c.company) continue
    companyMap[c.company] = (companyMap[c.company] || 0) + (c.monthly_fee || 0)
  }
  const companyDistribution = Object.entries(companyMap)
    .sort((a, b) => b[1] - a[1])
    .map(([company, amount]) => ({
      company,
      amount,
      percent: monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 100) : 0,
    }))

  // 5. 보장 공백 분석 (부족 항목)
  const gaps = coverageSummary.filter(c => c.status === 'low')

  // 6. YouTube 인사이트 수집 — 피칭 포인트 / 화법 / 비교기준 / 핵심요약 전부 활용
  const ytPitchPoints = (youtubeAnalyses || []).flatMap((a: any) => a.pitch_points || []).slice(0, 10)
  const ytScripts = (youtubeAnalyses || []).flatMap((a: any) => a.scripts || []).slice(0, 8)
  const ytCompCriteria = (youtubeAnalyses || []).flatMap((a: any) => a.comparison_criteria || []).slice(0, 6)
  const ytKeyPoints = (youtubeAnalyses || []).flatMap((a: any) => a.key_points || []).slice(0, 8)

  const ytBlock = [
    ytPitchPoints.length > 0 ? `[피칭 포인트]\n${ytPitchPoints.map((p: string) => `- ${p}`).join('\n')}` : '',
    ytScripts.length > 0 ? `[실전 화법 예시]\n${ytScripts.map((s: string) => `- ${s}`).join('\n')}` : '',
    ytCompCriteria.length > 0 ? `[상품 비교 기준]\n${ytCompCriteria.map((c: string) => `- ${c}`).join('\n')}` : '',
    ytKeyPoints.length > 0 ? `[핵심 인사이트]\n${ytKeyPoints.map((k: string) => `- ${k}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  // 7. Claude API — 핵심 포인트 / 공백 메시지 / 나이별 비교 / 상담 스크립트
  const age = customer.age || (customer.birth_date ? new Date().getFullYear() - parseInt(customer.birth_date.slice(0, 4)) : null)
  const gapsText = gaps.map(g => `${g.category}: 현재 ${(g.total / 10000).toLocaleString()}만원 (권장 ${(g.benchmark_ok / 10000).toLocaleString()}만원 이상)`).join('\n')
  const contractsText = activeContracts.map((c: any) => `- ${c.company} ${c.product_name} (${(c.monthly_fee || 0).toLocaleString()}원/월)`).join('\n')

  const prompt = `당신은 보험 설계사의 고객 미팅을 돕는 전문 분석 AI입니다.
아래 고객 데이터와 보험 전문가 유튜브 인사이트를 결합하여 설계사가 고객 미팅에서 실제로 활용할 수 있는 리포트를 생성하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요.

[고객 정보]
이름: ${customer.name} / 나이: ${age || '미확인'}세 / 성별: ${customer.gender || '미확인'} / 직업: ${customer.job || '미확인'}

[유지 중인 보유 계약]
${contractsText || '없음'}
월 보험료 합계: ${monthlyTotal.toLocaleString()}원

[보장 공백 (권장 미달 항목)]
${gapsText || '없음'}

${ytBlock ? `[보험 전문가 유튜브 인사이트 — 반드시 이 내용을 상담 스크립트에 반영할 것]\n${ytBlock}` : ''}

위 정보를 종합하여 아래 JSON 형식으로 정확히 응답하세요:
{
  "key_insight": "설계사가 미팅 시작 때 읽어줄 수 있는 핵심 포인트 2~3문장. 고객 이름/나이/보험료/주요 공백을 구체적 금액과 함께 언급. 위기감과 기회를 동시에 전달",
  "gap_analysis": [
    { "category": "카테고리명", "current": 현재금액숫자, "benchmark": 권장금액숫자, "message": "구체적 위험 상황과 함께 한 줄 설명" }
  ],
  "age_comparison": {
    "note": "현재 나이 기준 보험 가입 시기에 대한 코멘트",
    "at_60_monthly_increase": 60세 시 예상 추가 보험료 숫자(원),
    "at_65_note": "65세 이후 가입 제한 사유 한 줄"
  },
  "consultation_scripts": [
    "유튜브 인사이트 기반, 실제 상담에서 바로 쓸 수 있는 구체적 화법 1 (고객 이름 포함 가능)",
    "화법 2",
    "화법 3",
    "화법 4"
  ],
  "claim_cases": [
    {
      "name": "가명 (예: 김○○)",
      "masked_id": "생년월일 앞자리-*******  (예: 780312-*******)",
      "situation": "고객과 또래이며 비슷한 직업/상황. 어떤 사고나 질병이 발생했는지 2~3문장으로 실감나게 서술",
      "payout": "수령 보험금 금액 (예: 4,200만원)"
    },
    { "name": "...", "masked_id": "...", "situation": "...", "payout": "..." },
    { "name": "...", "masked_id": "...", "situation": "...", "payout": "..." }
  ],
  "rejection_risk": [
    "지급거절 위험 요소 1 (고객 계약/보장 공백 기반 구체적 사유)",
    "지급거절 위험 요소 2",
    "지급거절 위험 요소 3"
  ],
  "peer_comparison": "동년배(${age}세) 평균 보험 가입 현황과 비교하여 이 고객의 현재 보장 수준이 어떤지 2~3문장으로 설명. 구체적 수치 포함",
  "remodel_suggestion": "현재 보험 구성을 리모델링한다면 어떤 방향으로 개선할지 2~3문장으로 제안. 보장 공백 해소 방안 포함"
}

claim_cases 작성 규칙:
- 반드시 3건 생성
- 고객 나이 ±5세 또래, 동일 성별 기준
- 보장 공백 항목(암/뇌/심장/수술 등)과 연관된 사례 우선
- 이름은 가명(김○○, 이○○ 형식), 주민번호 뒷자리는 반드시 *******
- 수령 금액은 실제처럼 구체적으로 (단순 반올림 금지)
- 상황 설명은 감정을 자극하는 현실적 표현 사용`

  let aiResult: any = {}
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const aiData = await aiRes.json()
    const raw = aiData.content?.[0]?.text || '{}'
    aiResult = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.error('Claude API error:', e)
  }

  return res.status(200).json({
    customer: {
      name: customer.name,
      age,
      gender: customer.gender,
      job: customer.job,
      phone: customer.phone,
    },
    agent: {
      name: agent?.name || '',
      phone: agent?.phone || '',
      email: agent?.email || '',
      fax: agent?.settings?.fax || '',
      title: agent?.settings?.title || '',
      company: agent?.settings?.company || '',
      sns: agent?.settings?.sns || {},
    },
    generatedAt: new Date().toISOString(),
    stats: { contractCount: activeContracts.length, monthlyTotal, coverageCount },
    contracts: activeContracts.map((c: any) => ({
      id: c.id,
      company: c.company,
      productName: c.product_name,
      insuranceType: c.insurance_type,
      monthlyFee: c.monthly_fee || 0,
      contractStart: c.contract_start,
      paymentYears: c.payment_years,
      expiryAge: c.expiry_age,
    })),
    coverageSummary,
    companyDistribution,
    keyInsight: aiResult.key_insight || '',
    gapAnalysis: aiResult.gap_analysis || gaps.map(g => ({
      category: g.category, current: g.total, benchmark: g.benchmark_ok, message: '보강이 필요합니다',
    })),
    ageComparison: aiResult.age_comparison || {},
    consultationScripts: aiResult.consultation_scripts || ytScripts,
    claimCases: aiResult.claim_cases || [],
    rejectionRisk: aiResult.rejection_risk || [],
    peerComparison: aiResult.peer_comparison || '',
    remodelSuggestion: aiResult.remodel_suggestion || '',
  })
}
