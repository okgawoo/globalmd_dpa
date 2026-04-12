import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import * as XLSX from 'xlsx'
import { parse as parseHtml } from 'node-html-parser'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function cleanNum(val: any): number | null {
  const n = parseInt(String(val || '').replace(/[^0-9]/g, ''))
  return isNaN(n) || n === 0 ? null : n
}

function cleanStr(val: any): string {
  return String(val || '').trim().replace(/\s+/g, ' ')
}

function isEmpty(val: any): boolean {
  const s = cleanStr(val)
  return !s || s === 'nan' || s === 'null' || s === 'undefined' || s === 'NaN'
}

const HEADER_WORDS = new Set([
  '보험회사명', '보험회사', '상품명', '구분', '급부명칭', '지급사유', '지급금액',
  '가입금액', '보험료', '확정이율', '공시이율', '최저보증이율', '보험가격지수',
  '부가보험료지수', '계약체결비용지수', '상품특징', '해약환급금', '갱신주기',
  '유니버셜', '판매채널', '판매일자', '특이사항', '대표번호',
  '주계약', '특약', '선택', '회사명', '담보명', '남자', '여자',
  '금리확정형', '금리연동형', '자산연계형',
])

function isHeaderWord(val: string): boolean {
  return HEADER_WORDS.has(val) || val.match(/^[0-9,.\s%]+$/) !== null
}

// 생명보험 파싱
// 구조: 0행부터 바로 데이터
// col0:보험회사명 col1:상품명 col2:구분 col3:급부명칭 col4:지급사유 col5:지급금액 col6:가입금액 col7:남자보험료 col8:여자보험료
function parseLifeFile(rows: any[][], category: string) {
  const products: any[] = []
  const warnings: string[] = []
  const companies = new Set<string>()

  let currentCompany = ''
  let currentProduct = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const col0 = cleanStr(row[0]) // 보험회사명
    const col1 = cleanStr(row[1]) // 상품명
    const col2 = cleanStr(row[2]) // 구분
    const col3 = cleanStr(row[3]) // 급부명칭
    const col4 = cleanStr(row[4]) // 지급사유
    const col5 = cleanStr(row[5]) // 지급금액
    const col7 = row[7]           // 보험료(남)
    const col8 = row[8]           // 보험료(여)

    // 보험회사명 업데이트
    if (!isEmpty(col0) && !isHeaderWord(col0) && col0.length < 50) {
      currentCompany = col0
      companies.add(col0)
    }
    // 상품명 업데이트
    if (!isEmpty(col1) && !isHeaderWord(col1) && col1.length < 300) {
      currentProduct = col1
    }

    // 급부명칭 없으면 스킵 (헤더 단어도 스킵)
    if (isEmpty(col3) || isHeaderWord(col3)) continue
    if (!currentCompany) continue

    const premiumMale = cleanNum(col7)
    const premiumFemale = cleanNum(col8)

    if (!premiumMale && !premiumFemale && warnings.length < 50) {
      warnings.push(`${currentCompany} - ${col3}: 보험료 누락 (${i + 1}행)`)
    }

    products.push({
      source: 'life',
      category,
      company: currentCompany,
      product_name: currentProduct || null,
      division: !isEmpty(col2) ? col2 : null,
      coverage_name: col3,
      payment_reason: !isEmpty(col4) ? col4 : null,
      payment_amount: !isEmpty(col5) ? col5 : null,
      premium_male: premiumMale,
      premium_female: premiumFemale,
    })
  }

  return { products, companies: Array.from(companies), warnings }
}

// 손해보험 파싱
// 구조: 5행 헤더상단, 6행 헤더하단, 7행부터 데이터
// col1:회사명 col2:상품명 col3:담보명 col4:지급사유 col5:지급액 col6:남자보험료 col7:여자보험료
function parseDamageFile(rows: any[][], category: string) {
  const products: any[] = []
  const warnings: string[] = []
  const companies = new Set<string>()

  // 데이터 시작 행 찾기 (담보명 + 지급사유가 있는 행의 다음)
  let dataStart = 7
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowStr = rows[i].map((c: any) => String(c || '')).join('')
    if (rowStr.includes('담보명') && rowStr.includes('지급사유')) {
      dataStart = i + 1
      break
    }
  }

  let currentCompany = ''
  let currentProduct = ''

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const col1 = cleanStr(row[1]) // 회사명
    const col2 = cleanStr(row[2]) // 상품명
    const col3 = cleanStr(row[3]) // 담보명
    const col4 = cleanStr(row[4]) // 지급사유
    const col5 = cleanStr(row[5]) // 지급액
    const col6 = row[6]           // 보험료(남)
    const col7 = row[7]           // 보험료(여)

    // 회사명 업데이트
    if (!isEmpty(col1) && !isHeaderWord(col1) && col1.length < 50) {
      currentCompany = col1
      companies.add(col1)
    }
    // 상품명 업데이트
    if (!isEmpty(col2) && !isHeaderWord(col2) && col2.length < 300) {
      currentProduct = col2
    }

    // 전체 행이 비어있으면 스킵 (손해보험 파일 특성상 빈행 존재)
    if (isEmpty(col1) && isEmpty(col2) && isEmpty(col3) && isEmpty(col4)) continue

    // 담보명 없으면 스킵 (헤더 단어도 스킵)
    if (isEmpty(col3) || isHeaderWord(col3)) continue
    if (!currentCompany) continue

    const premiumMale = cleanNum(col6)
    const premiumFemale = cleanNum(col7)
    // 보험료 없는 세부 담보는 경고 없이 저장 (손해보험 파일 특성)

    products.push({
      source: 'damage',
      category,
      company: currentCompany,
      product_name: currentProduct || null,
      division: null,
      coverage_name: col3,
      payment_reason: !isEmpty(col4) ? col4 : null,
      payment_amount: !isEmpty(col5) ? col5 : null,
      premium_male: premiumMale,
      premium_female: premiumFemale,
    })
  }

  return { products, companies: Array.from(companies), warnings }
}

// 카테고리 자동 판별
function detectFileType(allText: string): { category: string } {

  const categoryMap: { [key: string]: string[] } = {
    '암보험': ['암진단', '암수술', '암입원', '암종별', '암보험'],
    '질병보험': ['뇌혈관', '심혈관', '뇌졸중', '급성심근경색'],
    '종신보험': ['사망보험금', '종신보험'],
    '간병/치매보험': ['간병', '치매', '장기요양'],
    '어린이보험': ['어린이', '태아'],
    '치아보험': ['치아', '임플란트'],
    '정기보험': ['정기보험'],
    '상해보험': ['상해보험'],
  }

  let category = '기타'
  let maxScore = 0
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    const score = keywords.filter(k => allText.includes(k)).length
    if (score > maxScore) { maxScore = score; category = cat }
  }

  return { category }
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
        // 손해보험 형식 (진짜 XLS)
        const wb = XLSX.read(fileContent, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      } else {
        // 생명보험 형식 (HTML 위장 XLS)
        const html = fileContent.toString('utf-8')
        const root = parseHtml(html)
        const trs = root.querySelectorAll('tr')
        rows = trs.map((tr: any) => tr.querySelectorAll('td,th').map((td: any) => td.text.trim() || null))
      }

      // 자동 판별
      const allText = rows.slice(0, 30).flat().filter(Boolean).map((c: any) => String(c)).join(' ')
      // source는 파일 형식으로 확실하게 판별 (진짜 XLS = 손해보험, HTML XLS = 생명보험)
      const source = isRealXls ? 'damage' : 'life'
      const { category } = detectFileType(allText)

      // 파싱
      const result = isRealXls
        ? parseDamageFile(rows, category)
        : parseLifeFile(rows, category)

      const { products, companies, warnings } = result

      if (products.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: '파싱 가능한 데이터가 없어요.',
          debug: {
            source,
            category,
            rowCount: rows.length,
            dataStart: rows.slice(0,10).map((r: any[]) => r ? r.slice(0,4).map((c:any) => String(c||'').slice(0,20)) : []),
          }
        })
      }

      // 기존 active 데이터 superseded 처리
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
