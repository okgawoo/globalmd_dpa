import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const { customerId, blockId } = req.body
  if (!customerId || !blockId) return res.status(400).json({ error: '필수 정보가 없어요' })

  // 고객/계약/보장 데이터 조회
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

  const activeContracts = contracts || []
  const monthlyTotal = activeContracts.reduce((s: number, c: any) => s + (c.monthly_fee || 0), 0)
  const allCoverages = activeContracts.flatMap((c: any) => c.dpa_coverages || [])

  const categoryMap: Record<string, number> = {}
  for (const cov of allCoverages) {
    if (!cov.category) continue
    categoryMap[cov.category] = (categoryMap[cov.category] || 0) + (cov.amount || 0)
  }

  const gaps = Object.entries(CATEGORY_BENCHMARKS)
    .filter(([cat]) => getStatus(cat, categoryMap[cat] || 0) === 'low')
    .map(([cat, bench]) => `${bench.label}: 현재 ${((categoryMap[cat] || 0) / 10000).toLocaleString()}만원 (권장 ${(bench.ok / 10000).toLocaleString()}만원 이상)`)
    .join('\n')

  const contractsText = activeContracts
    .map((c: any) => `- ${c.company} ${c.product_name} (${(c.monthly_fee || 0).toLocaleString()}원/월)`)
    .join('\n')

  const age = customer.age || (customer.birth_date ? new Date().getFullYear() - parseInt(customer.birth_date.slice(0, 4)) : null)

  const ytPitchPoints = (youtubeAnalyses || []).flatMap((a: any) => a.pitch_points || []).slice(0, 8)
  const ytScripts = (youtubeAnalyses || []).flatMap((a: any) => a.scripts || []).slice(0, 6)

  const baseInfo = `
고객: ${customer.name} / ${age || '?'}세 / ${customer.gender || '?'} / ${customer.job || '?'}
보유계약: ${contractsText || '없음'}
월보험료: ${monthlyTotal.toLocaleString()}원
보장 공백: ${gaps || '없음'}
`.trim()

  // 블록별 프롬프트
  const BLOCK_PROMPTS: Record<string, string> = {
    gap_analysis: `
${baseInfo}

위 정보를 바탕으로 보장 공백 진단 결과를 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "gap_analysis": [
    { "category": "카테고리명", "current": 현재금액숫자, "benchmark": 권장금액숫자, "message": "구체적 위험 상황 한 줄" }
  ]
}`,

    key_insight: `
${baseInfo}

설계사가 미팅 시작 때 읽어줄 핵심 후킹멘트를 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "key_insight": "고객 이름/나이/보험료/주요 공백을 구체적 금액과 함께 언급. 위기감과 기회를 동시에 전달하는 2~3문장."
}`,

    claim_cases: `
${baseInfo}

고객과 또래(±5세, 동성) 유사 보상 사례 3건을 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "claim_cases": [
    { "name": "김○○", "masked_id": "780312-*******", "situation": "실감나는 상황 2~3문장", "payout": "3,800만원" },
    { "name": "이○○", "masked_id": "...", "situation": "...", "payout": "..." },
    { "name": "박○○", "masked_id": "...", "situation": "...", "payout": "..." }
  ]
}
보장 공백 항목과 연관된 사례 우선. 수령 금액은 구체적으로.`,

    age_comparison: `
${baseInfo}

현재 나이(${age}세) 기준 보험 가입 시기 관련 내용을 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "age_comparison": {
    "note": "현재 나이 기준 보험 가입 시기에 대한 코멘트",
    "at_60_monthly_increase": 60세 시 예상 추가 보험료 숫자(원),
    "at_65_note": "65세 이후 가입 제한 사유 한 줄"
  }
}`,

    consultation_script: `
${baseInfo}
${ytPitchPoints.length > 0 ? `\n[피칭 포인트]\n${ytPitchPoints.map((p: string) => `- ${p}`).join('\n')}` : ''}
${ytScripts.length > 0 ? `\n[실전 화법 예시]\n${ytScripts.map((s: string) => `- ${s}`).join('\n')}` : ''}

실제 상담에서 바로 쓸 수 있는 화법 스크립트 4개를 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "consultation_scripts": ["화법1", "화법2", "화법3", "화법4"]
}`,

    rejection_risk: `
${baseInfo}

지급거절 위험 요소를 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "rejection_risk": ["위험요소1", "위험요소2", "위험요소3"]
}`,

    peer_comparison: `
${baseInfo}

동년배(${age}세) 평균과 비교 분석을 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "peer_comparison": "동년배 비교 내용 2~3문장"
}`,

    remodel_suggestion: `
${baseInfo}

현재 보험 구성의 리모델링 제안을 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "remodel_suggestion": "리모델링 제안 내용 2~3문장"
}`,

    pitch_points: `
${baseInfo}

핵심 피칭 포인트 5개를 JSON으로 응답하세요.
JSON 외 텍스트 절대 금지.
{
  "pitch_points": ["포인트1", "포인트2", "포인트3", "포인트4", "포인트5"]
}`,
  }

  const prompt = BLOCK_PROMPTS[blockId]
  if (!prompt) return res.status(400).json({ error: '지원하지 않는 블록이에요' })

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const aiData = await aiRes.json()
    const raw = aiData.content?.[0]?.text || '{}'
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return res.status(200).json({ blockId, result })
  } catch (e) {
    console.error('generate-block error:', e)
    return res.status(500).json({ error: 'AI 생성 실패' })
  }
}
