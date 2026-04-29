/**
 * 메리츠 암보험 PDF 바탕화면 → Supabase Storage 업로드 + DB 레코드 수정
 * node scripts/upload-meritz-test.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

const SUPABASE_URL = 'https://tmticcyqbaotrvmoqftv.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdGljY3lxYmFvdHJ2bW9xZnR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU0ODEyNiwiZXhwIjoyMDg5MTI0MTI2fQ.bkM7t2Z7e0JYYUCnSdBVXAV-VnLL7Jq53W9tIO-j4KQ'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DESKTOP = 'C:/Users/OKGA-HOME/Desktop'
const FILE_NAME = '무배당 메리츠 또 걸려도 또 받는 간편한 암보험(세만기형)2601요약서.pdf'
const PRODUCT_NAME = '무배당 메리츠 또 걸려도 또 받는 간편한 암보험(세만기형)2601'

function safeStorageName(productName, today) {
  const hash = createHash('md5').update(productName).digest('hex').slice(0, 8)
  return `${hash}_${today}.pdf`
}

const today = '2026-04-29'
const safeFileName = safeStorageName(PRODUCT_NAME, today)
const storagePath = `meritz/cancer/${today}/${safeFileName}`

console.log('📁 Storage 경로:', storagePath)

const pdfBuffer = readFileSync(`${DESKTOP}/${FILE_NAME}`)
console.log('📄 파일 크기:', pdfBuffer.length, 'bytes')

// 1) Storage 업로드
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('insurance-files')
  .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

if (uploadError) {
  console.error('❌ Storage 업로드 실패:', uploadError.message)
  process.exit(1)
}
console.log('✅ Storage 업로드 성공:', uploadData?.path)

// 2) 기존 DB 레코드 확인
const { data: existing } = await supabase
  .from('meritz_pdf_files')
  .select('id, product_name, storage_path, status')
  .eq('product_name', PRODUCT_NAME)
  .single()

console.log('🗄️  기존 레코드:', existing)

if (existing) {
  const { error: updateError } = await supabase
    .from('meritz_pdf_files')
    .update({
      storage_path: storagePath,
      status: 'parsed',
      file_name: safeFileName,
      file_size: pdfBuffer.length,
    })
    .eq('id', existing.id)

  if (updateError) {
    console.error('❌ DB 업데이트 실패:', updateError.message)
  } else {
    console.log('✅ DB 레코드 업데이트 완료')
  }
} else {
  // 레코드 없으면 새로 삽입
  const { error: insertError } = await supabase.from('meritz_pdf_files').insert({
    category_name: '암보험',
    srt_sq: 6,
    product_name: PRODUCT_NAME,
    file_type: '요약서',
    storage_path: storagePath,
    file_name: safeFileName,
    file_size: pdfBuffer.length,
    status: 'parsed',
    crawled_at: new Date().toISOString(),
  })
  if (insertError) {
    console.error('❌ DB 삽입 실패:', insertError.message)
  } else {
    console.log('✅ DB 레코드 새로 삽입 완료')
  }
}

console.log('\n🎉 완료! storage_path:', storagePath)
