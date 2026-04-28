import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MERITZ_BASE = 'https://www.meritzfire.com'
const CRON_SECRET = process.env.CRON_SECRET

const CATEGORIES: { srtSq: number; name: string }[] = [
  { srtSq: 6, name: '암보험' },
  { srtSq: 4, name: '질병보험' },
  { srtSq: 11, name: '생활보험' },
  { srtSq: 5, name: '어린이보험' },
  { srtSq: 2, name: '운전자보험' },
  { srtSq: 7, name: '상해보험' },
  { srtSq: 3, name: '통합보험' },
  { srtSq: 1, name: '자동차보험' },
  { srtSq: 8, name: '연금저축보험' },
  { srtSq: 14, name: '배상책임보험' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// 메리츠 공시실 접속해서 세션 쿠키 자동 발급
async function getSessionCookie(): Promise<string> {
  const res = await fetch(`${MERITZ_BASE}/disclosure/product-announcement/product-list.do`, {
    method: 'GET',
    headers: HEADERS,
    redirect: 'follow',
  })

  const setCookies = res.headers.getSetCookie?.() || []
  if (setCookies.length === 0) {
    // Node 18 이하 호환
    const rawCookie = res.headers.get('set-cookie') || ''
    return rawCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
  }

  return setCookies.map(c => c.split(';')[0].trim()).join('; ')
}

const JSON_SMART_HEADERS = (cookie: string) => ({
  ...HEADERS,
  'Content-Type': 'application/json',
  'Cookie': cookie,
  'Referer': `${MERITZ_BASE}/disclosure/product-announcement/product-list.do`,
  'Origin': MERITZ_BASE,
})

const BASE_HEADER = {
  encryDivCd: '0',
  globId: '',
  langDivCd: 'KR',
  screenId: '/disclosure/product-announcement/product-list.do',
  envirInfoDivCd: 'P',
  transGrpCd: 'F',
  transsLcatgBizafairCd: 'CS',
  firstTranssLcatgBizafairCd: 'HP',
  syncDivCd: 'S',
  reqRespnsDivCd: 'Q',
}

async function getProductList(cookie: string, srtSq: number) {
  // 1단계: 카테고리별 상품 목록 조회 → cmCommCd 추출
  const res1 = await fetch(`${MERITZ_BASE}/json.smart?v=${Date.now()}`, {
    method: 'POST',
    headers: JSON_SMART_HEADERS(cookie),
    body: JSON.stringify({
      header: { ...BASE_HEADER, rcvmsgSrvId: 'f.cg.he.cu.ua.o.bc.PbanBc.retrievePdList' },
      body: { notfYn: 'Y', srtSq },
    }),
  })
  const data1 = await res1.json()
  const pdDtlList: any[] = data1.body?.pdDtlList || []

  // cmCommCd 중복 제거
  const cmCommCds = [...new Set(pdDtlList.map((p: any) => p.cmCommCd).filter(Boolean))] as string[]
  console.log(`[insurance-crawl] srtSq=${srtSq} → cmCommCds:`, cmCommCds)

  if (cmCommCds.length === 0) return []

  // 2단계: cmCommCd별 판매상품 목록 조회 → salPdList (file3#[E] 포함)
  const allProducts: any[] = []
  for (const cmPdDivCd of cmCommCds) {
    const res2 = await fetch(`${MERITZ_BASE}/json.smart?v=${Date.now()}`, {
      method: 'POST',
      headers: JSON_SMART_HEADERS(cookie),
      body: JSON.stringify({
        header: { ...BASE_HEADER, rcvmsgSrvId: 'f.cg.he.cu.ua.o.bc.PbanBc.retrieveSalPdList' },
        body: { cmPdDivCd, notfYn: 'Y', bcType: 'SALPD_LST' },
      }),
    })
    const data2 = await res2.json()
    const salPdList: any[] = data2.body?.salPdList || []
    console.log(`[insurance-crawl] cmPdDivCd=${cmPdDivCd} salPdList count:`, salPdList.length)
    if (salPdList[0]) console.log(`[insurance-crawl] salPdList[0] keys:`, Object.keys(salPdList[0]))
    allProducts.push(...salPdList)
  }

  return allProducts
}

async function downloadPdf(cookie: string, encPath: string, fileName: string): Promise<Buffer> {
  const url = `${MERITZ_BASE}/hp/fileDownload.do?path=${encodeURIComponent(encPath)}&id=${encodeURIComponent(encPath)}&orgFileName=${encodeURIComponent(fileName)}&check=N`
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      'Cookie': cookie,
      'Referer': `${MERITZ_BASE}/disclosure/product-announcement/product-list.do`,
    },
  })
  if (!res.ok) throw new Error(`PDF 다운로드 실패: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function runCrawl(srtSqs: number[]) {
  // 세션 쿠키 자동 발급
  const cookie = await getSessionCookie()
  console.log(`[insurance-crawl] cookie length=${cookie.length}, value=${cookie.slice(0, 100)}`)
  if (!cookie) throw new Error('세션 쿠키 발급 실패')

  const results: { category: string; product: string; success: boolean; isNew?: boolean; error?: string }[] = []

  // 기존 저장된 파일 경로 목록
  const { data: existing } = await supabase.from('meritz_pdf_files').select('storage_path')
  const existingPaths = new Set((existing || []).map((r: any) => r.storage_path))

  for (const srtSq of srtSqs) {
    const category = CATEGORIES.find(c => c.srtSq === srtSq)
    if (!category) continue

    let products: any[]
    try {
      products = await getProductList(cookie, srtSq)
    } catch (e: any) {
      results.push({ category: category.name, product: '', success: false, error: `목록 조회 실패: ${e.message}` })
      continue
    }

    for (const product of products) {
      const encPath = product['file3#[E]']
      if (!encPath) continue

      const productName = product.ttlNm || '상품명 없음'
      const fileName = `${productName}_요약서.pdf`
      const today = new Date().toISOString().slice(0, 10) // 2026-04-29
      const storagePath = `meritz/${category.name}/${today}/${fileName}`

      // 이미 저장된 파일은 스킵 (신규만 다운로드)
      if (existingPaths.has(storagePath)) {
        results.push({ category: category.name, product: productName, success: true, isNew: false })
        continue
      }

      try {
        const pdfBuffer = await downloadPdf(cookie, encPath, fileName)

        await supabase.storage
          .from('insurance-files')
          .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

        await supabase.from('meritz_pdf_files').upsert({
          category_name: category.name,
          srt_sq: srtSq,
          product_name: productName,
          file_type: '요약서',
          storage_path: storagePath,
          file_name: fileName,
          file_size: pdfBuffer.length,
          status: 'stored',
          crawled_at: new Date().toISOString(),
        }, { onConflict: 'storage_path' })

        results.push({ category: category.name, product: productName, success: true, isNew: true })
        await delay(1500)
      } catch (e: any) {
        results.push({ category: category.name, product: productName, success: false, error: e.message })
      }
    }
  }

  return results
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // 크론잡 or Admin 수동 실행 구분
  const secret = req.headers['x-cron-secret']
  const isCron = !!secret
  if (isCron && CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ error: '인증 실패' })
  }

  // 크론잡이면 전체 카테고리, Admin이면 선택 카테고리
  const srtSqs: number[] = isCron
    ? CATEGORIES.map(c => c.srtSq)
    : (req.body.srtSqs || CATEGORIES.map(c => c.srtSq))

  try {
    const results = await runCrawl(srtSqs)
    const newCount = results.filter(r => r.success && r.isNew).length
    const skipCount = results.filter(r => r.success && !r.isNew).length
    const failCount = results.filter(r => !r.success).length

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      newCount,
      skipCount,
      failCount,
      total: results.length,
      results,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
