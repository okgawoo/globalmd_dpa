import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. 인증 확인
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '인증 필요' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '인증 실패' })

  // 2. admin 여부 확인
  const { data: me } = await supabaseAdmin
    .from('dpa_agents')
    .select('id, email, name')
    .eq('user_id', user.id)
    .single()

  if (me?.email !== 'admin@dpa.com') return res.status(403).json({ error: '관리자만 실행 가능합니다' })

  // 3. body 파싱
  const { sourceCustomerId } = req.body
  if (!sourceCustomerId) return res.status(400).json({ error: 'sourceCustomerId가 필요합니다' })

  try {
    // 4. 원본 고객 조회
    const { data: srcCustomer, error: custErr } = await supabaseAdmin
      .from('dpa_customers')
      .select('*')
      .eq('id', sourceCustomerId)
      .single()

    if (custErr || !srcCustomer) {
      return res.status(404).json({ error: '원본 고객을 찾을 수 없습니다', detail: custErr?.message })
    }

    // 5. 원본 계약 전체 조회
    const { data: srcContracts } = await supabaseAdmin
      .from('dpa_contracts')
      .select('*')
      .eq('customer_id', sourceCustomerId)

    const contracts = srcContracts || []

    // 6. 각 계약의 보장내역 조회
    const contractIds = contracts.map((c: any) => c.id)
    let srcCoverages: any[] = []
    if (contractIds.length > 0) {
      const { data: cvData } = await supabaseAdmin
        .from('dpa_coverages')
        .select('*')
        .in('contract_id', contractIds)
      srcCoverages = cvData || []
    }

    // 7. 새 고객 INSERT (현재 로그인 agent의 user_id로)
    const { id: _oldId, created_at: _ca, updated_at: _ua, ...customerFields } = srcCustomer
    const { data: newCustomer, error: newCustErr } = await supabaseAdmin
      .from('dpa_customers')
      .insert({
        ...customerFields,
        agent_id: user.id,  // 현재 로그인된 admin의 user_id
        customer_type: 'existing',
      })
      .select()
      .single()

    if (newCustErr || !newCustomer) {
      return res.status(500).json({ error: '고객 복사 실패', detail: newCustErr?.message })
    }

    // 8. 계약 복사 (원본 contract_id → 새 contract_id 매핑)
    const contractIdMap: Record<string, string> = {}
    let copiedContracts = 0
    let copiedCoverages = 0

    for (const ct of contracts) {
      const { id: _cid, created_at: _cca, updated_at: _cua, customer_id: _custid, agent_id: _aid, ...contractFields } = ct
      const { data: newContract, error: ctErr } = await supabaseAdmin
        .from('dpa_contracts')
        .insert({
          ...contractFields,
          customer_id: newCustomer.id,
          agent_id: user.id,
        })
        .select()
        .single()

      if (ctErr || !newContract) {
        console.error('계약 복사 실패:', ctErr?.message)
        continue
      }

      contractIdMap[ct.id] = newContract.id
      copiedContracts++

      // 9. 해당 계약의 보장내역 복사
      const cvList = srcCoverages.filter((cv: any) => cv.contract_id === ct.id)
      if (cvList.length > 0) {
        const newCvList = cvList.map((cv: any) => {
          const { id: _vid, created_at: _vca, contract_id: _vcid, ...cvFields } = cv
          return { ...cvFields, contract_id: newContract.id }
        })

        const { error: cvErr } = await supabaseAdmin
          .from('dpa_coverages')
          .insert(newCvList)

        if (!cvErr) copiedCoverages += newCvList.length
      }
    }

    return res.status(200).json({
      success: true,
      message: `복사 완료!`,
      newCustomerId: newCustomer.id,
      customerName: newCustomer.name,
      copiedContracts,
      copiedCoverages,
    })

  } catch (e: any) {
    console.error('admin-copy-customer error:', e.message)
    return res.status(500).json({ error: e.message || '복사 중 오류 발생' })
  }
}
