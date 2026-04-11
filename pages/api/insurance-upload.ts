import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 파일 자동 판별 함수
function detectFileType(rows: any[][]) {
  const allText = rows.slice(0, 20).flat().filter(Boolean).join(' ')

  // 생명 vs 손해 판별
  const lifeKeywords = ['급부명칭', '지급사유', '생명', '보험가격지수']
  const damageKeywords = ['담보명', '메리츠화재', '현대해상', 'DB손보', 'KB손보']
  const isLife = lifeKeywords.some(k => allText.includes(k))
  const source = isLife ? 'life' : 'damage'

  // 카테고리 판별
  const categoryMap: { [key: string]: string[] } = {
    '암보험': ['암진단', '암수술', '암입원', '암보험'],
    '질병보험': ['뇌혈관', '심혈관', '뇌졸중', '급성심근경색', '질병보험'],
    '종신보험': ['사망보험금', '종신'],
    '간병/치매보험': ['간병', '치매', '장기요양'],
    '어린이보험': ['어린이', '태아', '소아'],
    '치아보험': ['치아', '임플란트', '보철'],
    'CI보험': ['CI', '중대한 질병'],
    '정기보험': ['정기', '만기'],
    '상해보험': ['상해', '재해'],
  }

  let detectedCategory = '기타'
  let maxScore = 0
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    const score = keywords.filter(k => allText.includes(k)).length
    if (score > maxScore) { maxScore = score; detectedCategory = cat }
  }

  return { source, category: detectedCategory }
}

// 데이터 파싱 함수
function parseRows(rows: any[][], source: string, category: string) {
  const products: any[] = []
  const warnings: string[] = []

  // 헤더 행 찾기
  let dataStartRow = 0
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (row.some(c => String(c || '').includes('보험회사') || String(c || '').includes('회사명'))) {
      dataStartRow = i + 2
      break
    }
  }

  const companies = new Set<string>()
  let currentCompany = ''
  let currentProduct = ''

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const company = String(row[0] || '').trim()
    const productName = String(row[1] || '').trim()
    const division = String(row[source === 'life' ? 2 : 0] || '').trim()
    const coverageName = source === 'life' ? String(row[3] || '').trim() : String(row[2] || '').trim()
    const paymentReason = source === 'life' ? String(row[4] || '').trim() : String(row[3] || '').trim()
    const paymentAmount = source === 'life' ? String(row[5] || '').trim() : String(row[4] || '').trim()
    const premiumMaleRaw = source === 'life' ? row[6] : row[5]
    const premiumFemaleRaw = source === 'life' ? row[7] : row[6]

    if (company) { currentCompany = company; companies.add(company) }
    if (productName) currentProduct = productName
    if (!coverageName || coverageName === 'NaN') continue

    const premiumMale = parseInt(String(premiumMaleRaw || '').replace(/[^0-9]/g, '')) || null
    const premiumFemale = parseInt(String(premiumFemaleRaw || '').replace(/[^0-9]/g, '')) || null

    if (!premiumMale && !premiumFemale) {
      warnings.push(`${currentCompany} - ${coverageName}: 보험료 누락 (${i + 1}행)`)
    }

    products.push({
      source,
      category,
      company: currentCompany,
      product_name: currentProduct,
      division: division || null,
      coverage_name: coverageName,
      payment_reason: paymentReason || null,
      payment_amount: paymentAmount || null,
      premium_male: premiumMale,
      premium_female: premiumFemale,
    })
  }

  return { products, companies: Array.from(companies), warnings }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ success: false, error: '파일 파싱 실패' })

    const file = Array.isArray(files.file) ? files.file[0] : files.file
    if (!file) return res.status(400).json({ success: false, error: '파일 없음' })

    try {
      // 파일 읽기 (HTML 위장 XLS)
      let rows: any[][] = []
      const fileContent = fs.readFileSync(file.filepath)
      const magic = fileContent.slice(0, 4).toString('hex')

      if (magic === 'd0cf11e0') {
        // 진짜 XLS (손해보험 형식)
        const XLSX = require('xlsx')
        const wb = XLSX.read(fileContent, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      } else {
        // HTML 위장 XLS (생명보험 형식)
        const { parse } = require('node-html-parser')
        const html = fileContent.toString('utf-8')
        const root = parse(html)
        const trs = root.querySelectorAll('tr')
        rows = trs.map((tr: any) => tr.querySelectorAll('td,th').map((td: any) => td.text.trim() || null))
      }

      // 자동 판별
      const { source, category } = detectFileType(rows)

      // 파싱
      const { products, companies, warnings } = parseRows(rows, source, category)

      if (products.length === 0) {
        return res.status(400).json({ success: false, error: '파싱 가능한 데이터가 없어요. 파일 형식을 확인해주세요.' })
      }

      // 기존 데이터 superseded 처리
      await supabase
        .from('dpa_insurance_sources')
        .update({ status: 'superseded' })
        .eq('source', source)
        .eq('category', category)
        .eq('status', 'active')

      // source 레코드 삽입
      const { data: sourceRecord, error: sourceError } = await supabase
        .from('dpa_insurance_sources')
        .insert({
          source,
          category,
          file_name: file.originalFilename,
          row_count: products.length,
          company_count: companies.length,
          status: 'active',
          downloaded_at: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (sourceError) throw sourceError

      // 상품 데이터 배치 삽입
      const batchSize = 500
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map(p => ({ ...p, source_id: sourceRecord.id }))
        const { error } = await supabase.from('dpa_insurance_products').insert(batch)
        if (error) throw error
      }

      // 검증 경고 저장
      if (warnings.length > 0) {
        const validationLogs = warnings.slice(0, 50).map(w => ({
          source_id: sourceRecord.id,
          check_type: 'missing_premium',
          detail: w,
          severity: 'warning'
        }))
        await supabase.from('dpa_insurance_validations').insert(validationLogs)
      }

      return res.status(200).json({
        success: true,
        source,
        category,
        rowCount: products.length,
        companyCount: companies.length,
        warnings: warnings.length,
        warningDetails: warnings.slice(0, 5),
      })
    } catch (e: any) {
      console.error('Upload error:', e)
      return res.status(500).json({ success: false, error: e.message || '서버 오류' })
    }
  })
}
