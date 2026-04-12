import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SKIP_WORDS = ['주계약', '특약', '구분', '급부명칭', '지급사유', '지급금액', '보험료', '선택', '회사명', '상품명', '담보명', 'NaN', '', 'null', 'undefined']

// 생명보험 파일 파싱 (HTML 위장 XLS)
function parseLifeFile(rows: any[][], category: string) {
  const products: any[] = []
  const warnings: string[] = []
  const companies = new Set<string>()

  // 데이터 시작 행 찾기
  let dataStart = 4
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map((c: any) => String(c || '')).join('')
    if (rowStr.includes('보험회사명') || rowStr.includes('보험회사')) {
      dataStart = i + 4
      break
    }
  }

  let currentCompany = ''
  let currentProduct = ''

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const col0 = String(row[0] || '').trim()
    const col1 = String(row[1] || '').trim()
    const col2 = String(row[2] || '').trim()
    const col3 = String(row[3] || '').trim()
    const col4 = String(row[4] || '').trim()
    const col5 = String(row[5] || '').trim()

    // 보험회사명 업데이트 (스킵 단어 제외)
    if (col0 && !SKIP_WORDS.includes(col0) && col0.length < 50 && !col0.match(/^[0-9,.\s%]+$/)) {
      currentCompany = col0
      companies.add(col0)
    }
    if (col1 && !SKIP_WORDS.includes(col1) && col1.length < 200) {
      currentProduct = col1
    }

    // 급부명칭 없으면 스킵
    if (!col3 || SKIP_WORDS.includes(col3) || col3.match(/^[0-9,.\s%]+$/)) continue
    if (!currentCompany) continue

    const premiumMale = parseInt(String(row[6] || '').replace(/[^0-9]/g, '')) || null
    const premiumFemale = parseInt(String(row[7] || '').replace(/[^0-9]/g, '')) || null

    if (!premiumMale && !premiumFemale) {
      if (warnings.length < 50) warnings.push(`${currentCompany} - ${col3}: 보험료 누락 (${i + 1}행)`)
    }

    products.push({
      source: 'life',
      category,
      company: currentCompany,
      product_name: currentProduct || null,
      division: col2 || null,
      coverage_name: col3,
      payment_reason: col4 || null,
      payment_amount: col5 || null,
      premium_male: premiumMale,
      premium_female: premiumFemale,
    })
  }

  return { products, companies: Array.from(companies), warnings }
}

// 손해보험 파일 파싱 (진짜 XLS)
function parseDamageFile(rows: any[][], category: string) {
  const products: any[] = []
  const warnings: string[] = []
  const companies = new Set<string>()

  // 헤더 행 찾기
  let dataStart = 7
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowStr = rows[i].map((c: any) => String(c || '')).join('')
    if (rowStr.includes('회사명') && rowStr.includes('담보명')) {
      dataStart = i + 1
      break
    }
  }

  let currentCompany = ''
  let currentProduct = ''

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const col1 = String(row[1] || '').trim() // 회사명
    const col2 = String(row[2] || '').trim() // 상품명
    const col3 = String(row[3] || '').trim() // 담보명
    const col4 = String(row[4] || '').trim() // 지급사유
    const col5 = String(row[5] || '').trim() // 지급액

    // 회사명 업데이트
    if (col1 && !SKIP_WORDS.includes(col1) && col1.length < 50 && !col1.match(/^[0-9,.\s%]+$/)) {
      currentCompany = col1
      companies.add(col1)
    }
    if (col2 && !SKIP_WORDS.includes(col2) && col2.length < 300) {
      currentProduct = col2
    }

    // 담보명 없으면 스킵
    if (!col3 || SKIP_WORDS.includes(col3) || col3.match(/^[0-9,.\s%]+$/)) continue
    if (!currentCompany) continue

    const premiumMale = parseInt(String(row[6] || '').replace(/[^0-9]/g, '')) || null
    const premiumFemale = parseInt(String(row[7] || '').replace(/[^0-9]/g, '')) || null

    if (!premiumMale && !premiumFemale) {
      if (warnings.length < 50) warnings.push(`${currentCompany} - ${col3}: 보험료 누락 (${i + 1}행)`)
    }

    if (!currentCompany) continue

    products.push({
      source: 'damage',
      category,
      company: currentCompany,
      product_name: currentProduct || null,
      division: null,
      coverage_name: col3,
      payment_reason: col4 || null,
      payment_amount: col5 || null,
      premium_male: premiumMale,
      premium_female: premiumFemale,
    })
  }

  return { products, companies: Array.from(companies), warnings }
}

// 파일 자동 판별
function detectFileType(rows: any[][]): { source: string, category: string } {
  const allText = rows.slice(0, 20).flat().filter(Boolean).map((c: any) => String(c)).join(' ')
  const isLife = ['급부명칭', '공시이율', '보험가격지수'].some(k => allText.includes(k))
  const source = isLife ? 'life' : 'damage'

  const categoryMap: { [key: string]: string[] } = {
    '암보험': ['암진단', '암수술', '암입원', '암종별'],
    '질병보험': ['뇌혈관', '심혈관', '뇌졸중', '급성심근경색'],
    '종신보험': ['사망보험금', '종신'],
    '간병/치매보험': ['간병', '치매', '장기요양'],
    '어린이보험': ['어린이', '태아'],
    '치아보험': ['치아', '임플란트'],
    '정기보험': ['정기보험'],
    '상해보험': ['상해보험', '재해'],
  }

  let category = '기타'
  let maxScore = 0
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    const score = keywords.filter(k => allText.includes(k)).length
    if (score > maxScore) { maxScore = score; category = cat }
  }

  return { source, category }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ success: false, error: '파일 파싱 실패' })

    const file = Array.isArray(files.file) ? files.file[0] : files.file
    if (!file) return res.status(400).json({ success: false, error: '파일 없음' })

    try {
      const fileContent = fs.readFileSync(file.filepath)
      const magic = fileContent.slice(0, 4).toString('hex')
      const isRealXls = magic === 'd0cf11e0'

      let rows: any[][] = []

      if (isRealXls) {
        const XLSX = require('xlsx')
        const wb = XLSX.read(fileContent, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      } else {
        const { parse } = require('node-html-parser')
        const html = fileContent.toString('utf-8')
        const root = parse(html)
        const trs = root.querySelectorAll('tr')
        rows = trs.map((tr: any) => tr.querySelectorAll('td,th').map((td: any) => td.text.trim() || null))
      }

      const { source, category } = detectFileType(rows)

      const result = isRealXls
        ? parseDamageFile(rows, category)
        : parseLifeFile(rows, category)

      const { products, companies, warnings } = result

      if (products.length === 0) {
        return res.status(400).json({ success: false, error: '파싱 가능한 데이터가 없어요.' })
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

      // 배치 삽입
      const batchSize = 500
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map(p => ({ ...p, source_id: sourceRecord.id }))
        const { error } = await supabase.from('dpa_insurance_products').insert(batch)
        if (error) throw error
      }

      // 검증 경고 저장
      if (warnings.length > 0) {
        const logs = warnings.map(w => ({
          source_id: sourceRecord.id,
          check_type: 'missing_premium',
          detail: w,
          severity: 'warning'
        }))
        await supabase.from('dpa_insurance_validations').insert(logs)
      }

      return res.status(200).json({
        success: true,
        source,
        category,
        rowCount: products.length,
        companyCount: companies.length,
        companies: companies.slice(0, 10),
        warnings: warnings.length,
        warningDetails: warnings.slice(0, 5),
      })
    } catch (e: any) {
      console.error('Upload error:', e)
      return res.status(500).json({ success: false, error: e.message || '서버 오류' })
    }
  })
}
