import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import styles from '../styles/Input.module.css'
import InsuranceCompanySelect from '../components/InsuranceCompanySelect'
import { ClipboardList, Camera, PenLine, FileUp } from 'lucide-react'

function ScanCardTab({ onComplete }: { onComplete: () => void }) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return alert('이미지 파일만 업로드할 수 있어요.')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setUploadedImage(dataUrl)
      setScanning(true)
      try {
        const res = await fetch('/api/scan-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        })
        const data = await res.json()
        if (data.error) { alert('스캔 오류: ' + data.error); setScanning(false); return }
        if (!data.name && !data.phone && !data.email && !data.company) {
          alert('명함 정보를 인식하지 못했어요. 다른 이미지를 사용해보세요.')
          setScanning(false); return
        }
        setResult(data)
      } catch { alert('명함 분석 중 오류가 발생했어요!') }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!result?.name) return alert('이름이 없어요! 직접 입력해주세요.')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('dpa_customers').insert({
        name: result.name, phone: result.phone || null,
        email: result.email || null, address: result.address || null,
        workplace: result.company || null, job: result.position || null,
        grade: '일반', customer_type: 'prospect', agent_id: user?.id,
      })
      onComplete()
    } catch { alert('저장 중 오류가 발생했어요!') }
    setSaving(false)
  }

  function reset() { setResult(null); setUploadedImage(null); setScanning(false) }

  const FIELDS = [
    { label: '이름', key: 'name' },
    { label: '회사', key: 'company' },
    { label: '직함', key: 'position' },
    { label: '휴대폰', key: 'phone' },
    { label: '유선전화', key: 'phone2' },
    { label: '이메일', key: 'email' },
    { label: '주소', key: 'address' },
    { label: '팩스', key: 'fax' },
  ]

  return (
    <div className={styles.formWrap}>

      {/* ── 이미지 업로드 ── */}
      <div className={styles.formSection}>명함 이미지 업로드</div>

      {!uploadedImage ? (
        /* 빈 상태 — 큰 드롭존 */
        <div
          className={[styles.dropZone, dragOver ? styles.dropZoneActive : ''].join(' ')}
          style={{ minHeight: 180 }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(94, 106, 210, 0.1)', border: '1px solid rgba(94, 106, 210, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Camera style={{ width: 22, height: 22, color: '#5E6AD2' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>명함 이미지를 드래그하거나 클릭하세요</div>
          <div style={{ fontSize: 13, color: '#636B78' }}>.jpg, .png, .webp 파일 지원</div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
        </div>
      ) : (
        /* 이미지 있을 때 — 컴팩트 교체 바 + 미리보기 */
        <>
          <div
            className={[styles.dropZone, dragOver ? styles.dropZoneActive : ''].join(' ')}
            style={{ flexDirection: 'row', padding: '10px 16px', gap: 8, minHeight: 'unset' }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { reset(); handleImageFile(f) } }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera style={{ width: 15, height: 15, color: '#5E6AD2', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#636B78' }}>다른 이미지로 교체 — 클릭 또는 드래그</span>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { reset(); handleImageFile(f) } }} />
          </div>
          <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={uploadedImage} alt="명함" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
          </div>
        </>
      )}

      {/* ── 인식 결과 ── */}
      <div className={styles.formSection}>인식 결과</div>

      {/* 빈 상태 */}
      {!scanning && !result && (
        <div className={styles.pastePanelEmpty} style={{ minHeight: 120 }}>
          <div style={{ fontSize: 24, opacity: 0.3 }}>🪪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>명함을 업로드하면 자동으로 인식됩니다</div>
          <div style={{ fontSize: 13, color: '#636B78' }}>이름, 연락처, 회사 등을 AI가 자동으로 추출해요</div>
        </div>
      )}

      {/* 분석 중 */}
      {scanning && (
        <div className={styles.pastePanelEmpty} style={{ minHeight: 120 }}>
          <div style={{ fontSize: 24 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#5E6AD2' }}>AI가 명함을 분석하고 있어요...</div>
          <div style={{ fontSize: 13, color: '#636B78' }}>잠시만 기다려주세요</div>
        </div>
      )}

      {/* 결과 — 2열 그리드 */}
      {result && !scanning && (
        <>
          <div className={styles.formGrid}>
            {FIELDS.map(f => (
              <div key={f.key} className={styles.field}
                style={f.key === 'address' ? { gridColumn: '1 / -1' } : {}}>
                <label>{f.label}</label>
                <input
                  value={result[f.key] || ''}
                  onChange={e => setResult({ ...result, [f.key]: e.target.value })}
                  placeholder={f.label}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 8, width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#5E6AD2', color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {saving ? '저장 중...' : '관심고객으로 저장'}
          </button>
        </>
      )}
    </div>
  )
}

type InputTab = 'paste' | 'file' | 'scan' | 'manual'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

const JOBS = ['직장인 (회사원)', '자영업자', '공무원', '교사 / 교직원', '의료인', '전문직', '주부', '학생', '농업 / 어업', '프리랜서', '은퇴 / 무직', '기타']
const COMPANIES = ['삼성생명', '한화생명', '교보생명', '신한라이프', 'DB생명', '흥국생명', '동양생명', '미래에셋생명', '푸본현대생명', '메트라이프', '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재', '흥국화재', '롯데손해보험', 'MG손해보험', 'MG새마을금고', '한화손해보험', 'AIG손해보험', 'NH농협손해보험', '라이나손해보험', '하나손해보험', '캐롯손해보험', 'AXA손해보험', '라이나생명', '처브라이프', '카디프생명', '푸르덴셜생명', '현대라이프', '휴먼라이프', 'ABL생명', 'AIA생명', 'DGB생명', 'iM라이프', 'IBK연금보험', 'KB라이프', 'KDB생명', 'NH농협생명', 'PCA생명', '하나생명', '오렌지라이프', '유니버셜생명', '기타']
const INS_TYPES = ['건강', '실손', '운전자', '자동차', '암', '치아', '간병', 'CI', '종신', '기타']
const CATEGORIES = ['암진단', '뇌혈관', '심장', '간병', '수술비', '실손', '비급여', '상해', '사고처리', '벌금', '특이사항']
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'IBK기업은행', 'NH농협은행', '카카오뱅크', '토스뱅크', '케이뱅크', 'SC제일은행', '씨티은행', '대구은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행', '수협은행', '신협', '우체국', '기타']
const PAYMENT_STATUSES = ['유지', '완납', '실효', '실납', '해지']
const PAYMENT_YEARS = ['1년납','3년납','5년납','10년납','15년납','20년납','25년납','30년납','40년납','전기납','종신납','일시납']
const EXPIRY_AGES = ['60세', '65세', '70세', '75세', '80세', '85세', '90세', '95세', '100세', '종신']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({length: 30}, (_, i) => String(CURRENT_YEAR - i))
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']

function parseContractStart(v: string): {year: string, month: string} {
  if (!v) return {year: '', month: ''}
  const [y, m] = v.split('.')
  return {year: y || '', month: m ? m.padStart(2,'0') : ''}
}
function joinContractStart(year: string, month: string): string {
  if (!year || !month) return ''
  return `${year}.${month}`
}

function formatMoney(value: string): string {
  const num = value.replace(/[^0-9]/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function parseMoney(value: string): string {
  return value.replace(/,/g, '')
}

function formatRRN(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 6) return digits
  return digits.slice(0, 6) + '-' + digits.slice(6)
}

function getGenderFromRRN(rrn: string): string {
  const digits = rrn.replace(/\D/g, '')
  if (digits.length < 8) return '여'
  const code = parseInt(digits[6])
  if ([1, 3, 5, 7].includes(code)) return '남'
  if ([2, 4, 6, 8].includes(code)) return '여'
  return '여'
}

function getAgeFromRRN(rrn: string): string {
  const digits = rrn.replace(/\D/g, '')
  if (digits.length < 7) return ''
  const code = parseInt(digits[6])
  const yy = parseInt(digits.slice(0, 2))
  let year: number
  if ([1, 2, 5, 6].includes(code)) year = 1900 + yy
  else if ([3, 4, 7, 8].includes(code)) year = 2000 + yy
  else year = 1900 + yy
  return String(new Date().getFullYear() - year)
}

function getBirthDateFromRRN(rrn: string): string | null {
  const digits = rrn.replace(/\D/g, '')
  if (digits.length < 7) return null
  const code = parseInt(digits[6])
  const yy = parseInt(digits.slice(0, 2))
  let year: number
  if ([1, 2, 5, 6].includes(code)) year = 1900 + yy
  else if ([3, 4, 7, 8].includes(code)) year = 2000 + yy
  else year = 1900 + yy
  return `${year}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`
}

type Coverage = { category: string; coverage_name: string; amount: string }
type Contract = {
  company: string; companyCustom: string; product_name: string; insurance_type: string
  monthly_fee: string; payment_status: string; payment_rate: string
  payment_total: string; payment_done: string; contract_start: string
  payment_years: string; expiry_age: string
  coverages: Coverage[]
  showCoverageModal: boolean
}

function emptyContract(): Contract {
  return {
    company: '', companyCustom: '', product_name: '', insurance_type: '건강',
    monthly_fee: '', payment_status: '유지', payment_rate: '', payment_total: '', payment_done: '',
    contract_start: '', payment_years: '', expiry_age: '',
    coverages: [], showCoverageModal: false
  }
}

export default function InputPage() {
  const router = useRouter()
  const queryTab = router.query.tab as string
  const [inputTab, setInputTab] = useState<InputTab>('paste')
  const [guideOpen, setGuideOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [jobCustom, setJobCustom] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const parsedResultRef = useRef<HTMLDivElement>(null)
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new')
  const saveModeRef = useRef<'new' | 'existing'>('new')
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const selectedCustomerIdRef = useRef<string>('')
  const [customerSearch, setCustomerSearch] = useState<string>('')
  // paste 탭 — 단계별 입력
  const [currentText, setCurrentText] = useState('')
  const [currentTextLoss, setCurrentTextLoss] = useState('')
  const [confirmedContracts, setConfirmedContracts] = useState<any[]>([])
  const [parsedCustomer, setParsedCustomer] = useState<any>(null)
  const isMobile = useIsMobile()
  // 결과 패널 표시 여부 (AI 분석 중/후 또는 확인된 계약 있을 때)
  const showResults = parsing || !!parsed || confirmedContracts.length > 0

  // 페이지 로드 시 고객 목록 미리 불러오기
  useEffect(() => {
    async function loadCustomers() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: custs } = await supabase.from('dpa_customers').select('id, name, age').eq('agent_id', user?.id).order('name')
      setExistingCustomers(custs || [])
    }
    loadCustomers()
  }, [])

  useEffect(() => {
    if (queryTab === 'paste' || queryTab === 'file' || queryTab === 'scan' || queryTab === 'manual') {
      setInputTab(queryTab as InputTab)
    }
  }, [queryTab])

  function handleTabChange(tab: InputTab) {
    setInputTab(tab)
    router.replace({ pathname: '/input', query: { tab } }, undefined, { shallow: true })
  }

  const [form, setForm] = useState({
    name: '', rrn: '', age: '', gender: '여', job: '직장인 (회사원)',
    phone: '', grade: '일반', address: '', workplace: '',
    bank_name: '', bank_account: '', driver_license: '',
  })
  const [contracts, setContracts] = useState<Contract[]>([emptyContract()])
  const [activeCovModal, setActiveCovModal] = useState<number | null>(null)
  const [newCov, setNewCov] = useState<Coverage>({ category: '암진단', coverage_name: '', amount: '' })

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleContractCount(n: number) {
    const count = Math.max(1, Math.min(20, n))
    setContracts(prev => {
      const arr = [...prev]
      while (arr.length < count) arr.push(emptyContract())
      return arr.slice(0, count)
    })
  }

  function handleRRN(v: string) {
    const formatted = formatRRN(v)
    setForm(f => ({ ...f, rrn: formatted, gender: getGenderFromRRN(formatted), age: getAgeFromRRN(formatted) }))
  }

  function updateContract(idx: number, k: string, v: string) {
    setContracts(cs => cs.map((c, i) => {
      if (i !== idx) return c
      const updated = { ...c, [k]: v }
      if (k === 'payment_done' || k === 'payment_total') {
        const done = parseInt(k === 'payment_done' ? v : c.payment_done) || 0
        const total = parseInt(k === 'payment_total' ? v : c.payment_total) || 0
        updated.payment_rate = total > 0 ? String(Math.round((done / total) * 100)) : ''
      }
      return updated
    }))
  }

  function addContract() { setContracts(cs => [...cs, emptyContract()]) }
  function removeContract(idx: number) { setContracts(cs => cs.filter((_, i) => i !== idx)) }

  function addCoverage(idx: number) {
    if (!newCov.coverage_name || !newCov.amount) return alert('보장명과 금액을 입력해주세요!')
    setContracts(cs => cs.map((c, i) => i === idx ? { ...c, coverages: [...c.coverages, { ...newCov }] } : c))
    setNewCov({ category: '암진단', coverage_name: '', amount: '' })
  }

  function removeCoverage(ctIdx: number, cvIdx: number) {
    setContracts(cs => cs.map((c, i) => i === ctIdx ? { ...c, coverages: c.coverages.filter((_, j) => j !== cvIdx) } : c))
  }

  async function handleManualSave() {
    if (!form.name) return alert('고객명은 필수예요!')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const agentId = user?.id
      const finalJob = form.job === '기타' ? jobCustom : form.job
      const birthDate = getBirthDateFromRRN(form.rrn)
      const { data: cust } = await supabase.from('dpa_customers').insert({
        name: form.name, age: parseInt(form.age) || null, birth_date: birthDate,
        gender: form.gender, job: finalJob, phone: form.phone, grade: form.grade,
        address: form.address, workplace: form.workplace,
        bank_name: form.bank_name, bank_account: form.bank_account,
        driver_license: form.driver_license,
        agent_id: agentId,
      }).select().single()

      if (cust) {
        for (const ct of contracts) {
          const finalCompany = ct.company === '기타' ? ct.companyCustom : ct.company
          if (!finalCompany) continue
          const { data: contract } = await supabase.from('dpa_contracts').insert({
            customer_id: cust.id, agent_id: agentId,
            company: finalCompany, product_name: ct.product_name,
            insurance_type: ct.insurance_type, monthly_fee: parseInt(ct.monthly_fee) || 0,
            payment_status: ct.payment_status, payment_rate: parseInt(ct.payment_rate) || 0,
            payment_total: parseInt(ct.payment_total) || 0, payment_done: parseInt(ct.payment_done) || 0,
            contract_start: ct.contract_start, payment_years: ct.payment_years, expiry_age: ct.expiry_age,
            input_method: 'manual',
          }).select().single()

          if (contract && ct.coverages.length > 0) {
            for (const cv of ct.coverages) {
              await supabase.from('dpa_coverages').insert({
                contract_id: contract.id, category: cv.category,
                coverage_name: cv.coverage_name, amount: parseInt(cv.amount.replace(/,/g, '')) || 0, status: '정상',
              })
            }
          }
        }
      }
      setDone(true)
      setTimeout(() => router.push('/customers'), 1500)
    } catch (e) { alert('저장 중 오류가 발생했어요!') }
    setSaving(false)
  }

  async function handleParse() {
    const combined = [
      currentText.trim() ? `[정액형]\n${currentText.trim()}` : '',
      currentTextLoss.trim() ? `[실손형]\n${currentTextLoss.trim()}` : '',
    ].filter(Boolean).join('\n\n')
    if (!combined.trim()) return alert('텍스트를 붙여넣어 주세요!')
    setParsing(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combined }),
      })
      const data = await res.json()
      // API 에러 처리
      if (!res.ok || data.error) {
        const errMsg = data?.error || `분석 오류 (${res.status})`
        alert(`AI 분석 실패: ${errMsg}`)
        setParsing(false)
        return
      }
      // 검증 경고
      const warns: string[] = []
      const isFirst = confirmedContracts.length === 0 && !parsedCustomer
      if (isFirst) {
        if (!data.name) warns.push('고객명이 인식되지 않았어요')
        if (!data.age || !data.gender || data.gender === '미상') warns.push('나이/성별이 인식되지 않았어요')
        if (!data.phone) warns.push('연락처가 인식되지 않았어요')
      }
      const ct = data.contracts?.[0]
      if (ct) {
        if (!ct.monthly_fee || ct.monthly_fee === 0) warns.push(`월보험료 0원 — 확인 필요`)
        if (!ct.contract_start) warns.push('가입연월이 없어요')
        if (!ct.payment_years) warns.push('납입기간이 없어요')
        if (!ct.coverages || ct.coverages.length === 0) warns.push('보장내역이 없어요')
      }
      data._warnings = warns
      // 첫 분석에서 고객 정보 저장
      if (isFirst) setParsedCustomer(data)
      setParsed(data)
    } catch (e) { alert('파싱 중 오류가 발생했어요!') }
    setParsing(false)
  }

  function handleConfirmContract() {
    const ct = parsed?.contracts?.[0]
    if (!ct) return
    setConfirmedContracts(prev => [...prev, { ...ct, _originalText: currentText, _originalTextLoss: currentTextLoss }])
    setParsed(null)
    setCurrentText('')
    setCurrentTextLoss('')
  }

  async function handleParseSave() {
    const currentSaveMode = saveModeRef.current
    const currentCustomerId = selectedCustomerIdRef.current
    if (currentSaveMode === 'existing' && !currentCustomerId) return alert('기존 고객을 선택해주세요!')
    // 현재 분석 중인 계약도 포함
    const allContracts = [
      ...confirmedContracts,
      ...(parsed?.contracts?.[0] ? [parsed.contracts[0]] : []),
    ]
    if (allContracts.length === 0) return alert('저장할 계약이 없어요!')
    const customerData = parsedCustomer || parsed
    if (!customerData && currentSaveMode === 'new') return alert('고객 정보가 없어요!')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const agentId = user?.id
      let customerId: string
      if (currentSaveMode === 'existing') {
        customerId = currentCustomerId
      } else {
        const birthDate = getBirthDateFromRRN(customerData.rrn || '')
        const { data: cust } = await supabase.from('dpa_customers').insert({
          name: customerData.name || '이름미상', age: customerData.age || null,
          gender: customerData.gender || '미상', grade: '일반',
          phone: customerData.phone || null, address: customerData.address || null,
          job: customerData.job || null, workplace: customerData.workplace || null,
          bank_name: customerData.bank_name || null, bank_account: customerData.bank_account || null,
          driver_license: customerData.driver_license || null,
          resident_number: customerData.rrn || null,
          birth_date: birthDate, customer_type: 'existing', agent_id: agentId,
        }).select().single()
        if (!cust) throw new Error('고객 저장 실패')
        customerId = cust.id
      }
      for (const ct of allContracts) {
        const { data: contract } = await supabase.from('dpa_contracts').insert({
          customer_id: customerId, agent_id: agentId,
          company: ct.company || '', product_name: ct.product_name || '',
          monthly_fee: parseInt(String(ct.monthly_fee || '').replace(/,/g, '')) || 0,
          payment_status: ct.payment_status || '유지', payment_rate: ct.payment_rate || 0,
          insurance_type: ct.insurance_type || '', contract_start: ct.contract_start || '',
          payment_years: ct.payment_years || '', expiry_age: ct.expiry_age || '',
          input_method: 'paste',
        }).select().single()
        if (contract && ct.coverages) {
          for (const cv of ct.coverages) {
            await supabase.from('dpa_coverages').insert({
              contract_id: contract.id, category: cv.category || '',
              coverage_name: cv.name || '', amount: parseInt(String(cv.amount || '').replace(/,/g, '')) || 0, status: '정상',
            })
          }
        }
      }
      setDone(true)
      setTimeout(() => router.push('/customers'), 1500)
    } catch (e) { alert('저장 중 오류가 발생했어요!') }
    setSaving(false)
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleExcelFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleExcelFile(file)
  }

  async function handleExcelFile(file: File) {
    alert(`${file.name} 파일 업로드됨!\nExcel 파싱 기능은 준비 중이에요 😊`)
  }

  const resetForm = () => {
    setDone(false)
    setForm({ name: '', rrn: '', age: '', gender: '여', job: '직장인 (회사원)', phone: '', grade: '일반', address: '', workplace: '', bank_name: '', bank_account: '', driver_license: '' })
    setContracts([emptyContract()])
    setParsed(null); setCurrentText(''); setCurrentTextLoss(''); setConfirmedContracts([]); setParsedCustomer(null); setJobCustom('')
  }

  if (done) return (
    <div className={styles.page}>
      <div className={styles.doneWrap}>
        <div className={styles.doneIcon}>✅</div>
        <div className={styles.doneText}>저장 완료!</div>
        <div className={styles.doneActions}>
          <a href="/customers" className={styles.btnPrimary}>고객 목록 보기</a>
          <button className={styles.btnSecondary} onClick={resetForm}>추가 입력</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>데이터 입력</h1>
        <p className={styles.pageSub}>고객 정보와 보험 계약을 등록하세요</p>
      </div>
    </div>
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <button className={[styles.tab, inputTab === 'paste' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('paste')}>
          <ClipboardList className={styles.tabIcon} />텍스트 붙여넣기
        </button>
        <button className={[styles.tab, inputTab === 'file' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('file')}>
          <FileUp className={styles.tabIcon} />파일 업로드
        </button>
        <button className={[styles.tab, inputTab === 'scan' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('scan')}>
          <Camera className={styles.tabIcon} />명함 입력
        </button>
        <button className={[styles.tab, inputTab === 'manual' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('manual')}>
          <PenLine className={styles.tabIcon} />수동 입력
        </button>
      </div>

      {inputTab === 'manual' && (
        <div className={styles.formWrap}>
          <div className={styles.formSection}>고객 기본 정보</div>
          <div className={styles.formGrid}>
            <div className={styles.field}><label>고객명 *</label><input value={form.name} onChange={e => setF('name', e.target.value.replace(/[0-9]/g, ''))} placeholder="홍길동" /></div>
            <div className={styles.field}><label>연락처</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="010-0000-0000" /></div>
            <div className={styles.field}><label>주민등록번호</label><input value={form.rrn} onChange={e => handleRRN(e.target.value)} placeholder="000000-0000000" maxLength={14} /></div>
            <div className={styles.field}><label>성별 <span className={styles.autoTag}>자동</span></label><select value={form.gender} onChange={e => setF('gender', e.target.value)}><option>여</option><option>남</option></select></div>
            <div className={styles.field}><label>은행명</label><select value={form.bank_name} onChange={e => setF('bank_name', e.target.value)}><option value="">선택</option>{BANKS.map(b => <option key={b}>{b}</option>)}</select></div>
            <div className={styles.field}><label>계좌번호</label><input value={form.bank_account} onChange={e => setF('bank_account', e.target.value)} placeholder="1002-3628-09746" /></div>
            <div className={styles.field} style={{gridColumn:'1 / -1'}}><label>주소</label><input value={form.address} onChange={e => setF('address', e.target.value)} placeholder="서울시 강남구..." /></div>
            <div className={styles.field}><label>직업</label><select value={form.job} onChange={e => setF('job', e.target.value)}>{JOBS.map(j => <option key={j}>{j}</option>)}</select></div>
            <div className={styles.field}><label>직장/소속</label><input value={form.workplace} onChange={e => setF('workplace', e.target.value)} placeholder="서울시청" /></div>
            {form.job === '기타' && <div className={styles.field} style={{gridColumn:'1 / -1'}}><label>직업 직접 입력</label><input value={jobCustom} onChange={e => setJobCustom(e.target.value)} placeholder="직업을 입력해주세요" /></div>}
            <div className={styles.field}><label>운전면허</label><input value={form.driver_license} onChange={e => setF('driver_license', e.target.value)} placeholder="26-06-009864-70" /></div>
            <div className={styles.field}><label>등급</label><select value={form.grade} onChange={e => setF('grade', e.target.value)}><option>일반</option><option>VIP</option></select></div>
          </div>

          {/* 보험 계약 */}
          {contracts.map((ct, idx) => (
            <div key={idx} className={styles.contractBlock}>
              <div className={styles.contractBlockHeader}>
                <div className={styles.formSection}>보험 {idx + 1}</div>
                {contracts.length > 1 && <button className={styles.removeBtn} onClick={() => removeContract(idx)}>삭제</button>}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field} style={{gridColumn:'1 / -1'}}><label>보험사</label><InsuranceCompanySelect value={ct.company} onChange={v => updateContract(idx, 'company', v)} /></div>
                <div className={styles.field} style={{gridColumn:'1 / -1'}}><label>상품명</label><input value={ct.product_name} onChange={e => updateContract(idx, 'product_name', e.target.value)} placeholder="무배당 건강보험" /></div>
                <div className={styles.field}><label>보험 종류</label><select value={ct.insurance_type} onChange={e => updateContract(idx, 'insurance_type', e.target.value)}>{INS_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className={styles.field}><label>월보험료 (원)</label><input inputMode="numeric" value={ct.monthly_fee ? formatMoney(String(ct.monthly_fee)) : ''} onChange={e => updateContract(idx, 'monthly_fee', parseMoney(e.target.value))} placeholder="50,000" /></div>
                <div className={styles.field}><label>납입 상태</label><select value={ct.payment_status} onChange={e => updateContract(idx, 'payment_status', e.target.value)}>{PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div className={styles.field}><label>가입 연월</label>
                  <div style={{display:'flex',gap:4}}>
                    <select value={parseContractStart(ct.contract_start).year} onChange={e=>updateContract(idx,'contract_start',joinContractStart(e.target.value,parseContractStart(ct.contract_start).month))} style={{flex:1,fontSize:13,padding:'9px 6px',borderRadius:8,border:'1px solid #E5E7EB',background:'#F7F8FA'}}>
                      <option value="">년</option>
                      {YEARS.map(y=><option key={y}>{y}</option>)}
                    </select>
                    <select value={parseContractStart(ct.contract_start).month} onChange={e=>updateContract(idx,'contract_start',joinContractStart(parseContractStart(ct.contract_start).year,e.target.value))} style={{flex:1,fontSize:13,padding:'9px 6px',borderRadius:8,border:'1px solid #E5E7EB',background:'#F7F8FA'}}>
                      <option value="">월</option>
                      {MONTHS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.field}><label>납입기간</label><select value={ct.payment_years} onChange={e => updateContract(idx, 'payment_years', e.target.value)}><option value="">선택</option>{PAYMENT_YEARS.map(p => <option key={p}>{p}</option>)}</select></div>
                <div className={styles.field}><label>만기</label><select value={ct.expiry_age} onChange={e => updateContract(idx, 'expiry_age', e.target.value)}><option value="">선택</option>{EXPIRY_AGES.map(a => <option key={a}>{a}</option>)}</select></div>
                <div className={styles.field}><label>총 납입 회차</label><input inputMode="numeric" value={ct.payment_total} onChange={e => updateContract(idx, 'payment_total', e.target.value.replace(/[^0-9]/g, ''))} placeholder="120" /></div>
                <div className={styles.field}><label>완료 회차</label><input inputMode="numeric" value={ct.payment_done} onChange={e => updateContract(idx, 'payment_done', e.target.value.replace(/[^0-9]/g, ''))} placeholder="36" /></div>
                <div className={styles.field}><label>납입률 (%) <span className={styles.autoTag}>자동</span></label><input value={ct.payment_rate} readOnly placeholder="자동 계산" className={styles.readOnly} /></div>
              </div>

              {/* 보장 항목 */}
              <div className={styles.coverageSection}>
                <div className={styles.coverageSectionHeader}>
                  <span className={styles.coverageSectionTitle}>보장 항목</span>
                  <button className={styles.addCovBtn} onClick={() => setActiveCovModal(activeCovModal === idx ? null : idx)}>+ 보장 추가</button>
                </div>

                {activeCovModal === idx && (
                  <div className={styles.covModal}>
                    <div className={styles.covModalGrid}>
                      <div className={styles.field}><label>카테고리</label><select value={newCov.category} onChange={e => setNewCov(n => ({ ...n, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                      <div className={styles.field}><label>보장명</label><input value={newCov.coverage_name} onChange={e => setNewCov(n => ({ ...n, coverage_name: e.target.value }))} placeholder="예: 급성심근경색진단비" /></div>
                      <div className={styles.field}><label>금액 (원)</label><input inputMode="numeric" value={newCov.amount ? formatMoney(String(newCov.amount)) : ''} onChange={e => setNewCov(n => ({ ...n, amount: parseMoney(e.target.value) }))} placeholder="예: 30,000,000" /></div>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:8,alignItems:'flex-start'}}>
                      <button style={{flex:1,padding:'7px',fontSize:13,background:'#5E6AD2',color:'#ffffff',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}} onClick={() => addCoverage(idx)}>추가하기</button>
                      <button className={styles.covCloseBtn} onClick={() => setActiveCovModal(null)}>닫기</button>
                    </div>
                  </div>
                )}

                {ct.coverages.length > 0 && (
                  <div className={styles.coverageList}>
                    {ct.coverages.map((cv, cvIdx) => (
                      <div key={cvIdx} className={styles.covItem}>
                        <span className={styles.covCat}>{cv.category}</span>
                        <span className={styles.covName}>{cv.coverage_name}</span>
                        <span className={styles.covAmt}>{parseInt(cv.amount).toLocaleString()}원</span>
                        <button className={styles.covDel} onClick={() => removeCoverage(idx, cvIdx)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <button className={styles.addContractBtn} onClick={addContract}>+ 보험 추가</button>
          <button className={styles.saveBtn} onClick={handleManualSave} disabled={saving}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}

      {inputTab === 'paste' && (
        <div style={{display:'flex',flexDirection:isMobile?'column':'row',gap:16,flex:1,alignItems:'stretch'}}>

          {/* ── 왼쪽: 입력 패널 ── */}
          <div className={styles.pastePanel} style={!isMobile?{
            flex:'0 0 auto',
            width:showResults?'calc(50% - 8px)':'min(720px, 100%)',
            marginLeft:showResults?'0':'auto',
            marginRight:showResults?'0':'auto',
            transition:'width 0.35s ease, margin 0.35s ease',
            overflowY:'auto',
            boxSizing:'border-box',
          }:{}}>

            {/* 저장 방식 — 첫 계약에만 표시 */}
            {confirmedContracts.length === 0 && (
              <div style={{marginBottom:16}}>
                <div className={styles.formSection}>저장 방식 선택</div>
                <div style={{display:'flex',gap:8,marginBottom:20}}>
                  <button onClick={() => { setSaveMode('new'); saveModeRef.current = 'new' }}
                    style={{flex:1,padding:'11px 0',borderRadius:8,border:`1.5px solid ${saveMode==='new'?'#5E6AD2':'#E5E7EB'}`,background:saveMode==='new'?'rgba(94,106,210,0.06)':'transparent',color:saveMode==='new'?'#5E6AD2':'#636B78',fontWeight:saveMode==='new'?600:400,fontSize:13,cursor:'pointer',transition:'all 120ms',fontFamily:'inherit'}}>
                    + 새 고객으로 저장
                  </button>
                  <button onClick={() => { setSaveMode('existing'); saveModeRef.current = 'existing' }}
                    style={{flex:1,padding:'11px 0',borderRadius:8,border:`1.5px solid ${saveMode==='existing'?'#5E6AD2':'#E5E7EB'}`,background:saveMode==='existing'?'rgba(94,106,210,0.06)':'transparent',color:saveMode==='existing'?'#5E6AD2':'#636B78',fontWeight:saveMode==='existing'?600:400,fontSize:13,cursor:'pointer',transition:'all 120ms',fontFamily:'inherit'}}>
                    👤 기존 고객에 추가
                  </button>
                </div>
                {saveMode === 'existing' && (
                  <div>
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="고객 이름 검색..."
                      style={{width:'100%',fontSize:13,padding:'8px 12px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',marginBottom:6,boxSizing:'border-box',fontFamily:'inherit'}} />
                    <div style={{maxHeight:150,overflowY:'auto',border:'1px solid #E5E7EB',borderRadius:8,background:'#ffffff'}}>
                      {existingCustomers.filter(c => !customerSearch || c.name.includes(customerSearch)).length === 0
                        ? <div style={{padding:'12px',fontSize:13,color:'#636B78',textAlign:'center'}}>검색 결과가 없어요</div>
                        : existingCustomers.filter(c => !customerSearch || c.name.includes(customerSearch)).map(c => (
                          <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); selectedCustomerIdRef.current = c.id }}
                            style={{padding:'9px 14px',fontSize:13,cursor:'pointer',background:selectedCustomerId===c.id?'rgba(94,106,210,0.08)':'transparent',color:selectedCustomerId===c.id?'#5E6AD2':'#1A1A2E',fontWeight:selectedCustomerId===c.id?600:400,borderBottom:'1px solid #E5E7EB'}}>
                            {c.name} {c.age ? `(${c.age}세)` : ''}{selectedCustomerId===c.id && <span style={{float:'right'}}>✓</span>}
                          </div>
                        ))}
                    </div>
                    {selectedCustomerId && (
                      <div style={{marginTop:6,fontSize:12,color:'#5E6AD2',fontWeight:600}}>
                        ✓ {existingCustomers.find(c => c.id === selectedCustomerId)?.name} 선택됨
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 현재 계약 라벨 */}
            <div className={styles.guideRow}>
              <span className={styles.guideLabel}>
                {confirmedContracts.length > 0 ? `${confirmedContracts.length + 1}번째 계약 입력` : '보장 내역 붙여넣기'}
              </span>
              <button className={styles.guideBtn} onClick={() => setGuideOpen(v => !v)} title="도움말">❓</button>
              {guideOpen && (
                <>
                  <div style={{position:'fixed',inset:0,zIndex:499}} onClick={() => setGuideOpen(false)} />
                  <div className={styles.guidePopup} onClick={e => e.stopPropagation()}>
                    <div className={styles.guidePopupHeader}>
                      <span>보장 내역 붙여넣기 방법</span>
                      <button onClick={() => setGuideOpen(false)} className={styles.guideCloseBtn}>✕</button>
                    </div>
                    <div className={styles.pasteGuideStep}>① 보험사 프로그램에서 계약 보장내역을 복사하세요</div>
                    <div className={styles.pasteGuideStep}>② 정액형 / 실손형 칸에 각각 <b>Ctrl+V</b> 로 붙여넣기</div>
                    <div className={styles.pasteGuideStep}>③ AI 분석 후 오른쪽에서 결과 확인 및 수정</div>
                    <div className={styles.pasteGuideStep}>④ 확인 후 다음 계약 또는 저장하기</div>
                  </div>
                </>
              )}
            </div>

            {/* 텍스트 입력 — 정액형 / 실손형 */}
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              <div style={{flex:1,...(!isMobile?{display:'flex',flexDirection:'column'}:{})}}>
                <div style={{fontSize:13,fontWeight:600,color:'#5E6AD2',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>정액형</div>
                <textarea className={styles.pasteArea} value={currentText} onChange={e => setCurrentText(e.target.value)}
                  placeholder="정액형 보장내역 붙여넣기 (Ctrl+V)" rows={10} />
              </div>
              <div style={{flex:1,...(!isMobile?{display:'flex',flexDirection:'column'}:{})}}>
                <div style={{fontSize:13,fontWeight:600,color:'#636B78',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>실손형</div>
                <textarea className={styles.pasteArea} value={currentTextLoss} onChange={e => setCurrentTextLoss(e.target.value)}
                  placeholder="실손형 보장내역 붙여넣기 (Ctrl+V)" rows={10} />
              </div>
            </div>

            <button className={styles.parseBtn} onClick={handleParse}
              disabled={parsing || (!currentText.trim() && !currentTextLoss.trim())}>
              {parsing ? 'AI 분석 중...' : 'AI로 분석하기'}
            </button>
          </div>

          {/* ── 오른쪽: 결과 패널 (애니메이션 wrapper) ── */}
          <div style={!isMobile?{
            flex:'0 0 auto',
            width:showResults?'calc(50% - 8px)':'0',
            opacity:showResults?1:0,
            overflow:'hidden',
            transition:'width 0.35s ease, opacity 0.25s ease',
          }:{flex:1}}>
          <div className={styles.pastePanel} style={{overflowY:'auto',height:'100%',boxSizing:'border-box',minWidth:!isMobile&&showResults?'calc(50vw - 60px)':0}}>

            {/* 확인된 계약 목록 */}
            {confirmedContracts.length > 0 && (
              <div style={{marginBottom:12}}>
                <div className={styles.parsedSection}>확인된 계약 ({confirmedContracts.length}건)</div>
                <div style={{maxHeight:'220px',overflowY:'auto'}}>
                {confirmedContracts.map((ct, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',marginBottom:4,background:'rgba(94,106,210,0.06)',border:'1px solid rgba(94,106,210,0.15)',borderRadius:6,fontSize:13}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#5E6AD2',flexShrink:0,minWidth:16,textAlign:'right'}}>{i+1}.</span>
                    <span style={{color:'#1A1A2E',fontWeight:510,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {ct.company || '보험사 미상'} · {ct.product_name || '상품명 미상'}
                    </span>
                    <span style={{color:'#8892A0',fontSize:12,flexShrink:0,fontVariantNumeric:'tabular-nums'}}>
                      {ct.monthly_fee ? `${Number(ct.monthly_fee).toLocaleString()}원` : '-'}
                    </span>
                    <button
                      onClick={() => {
                        const orig = confirmedContracts[i]
                        setConfirmedContracts(prev => prev.filter((_, idx) => idx !== i))
                        setCurrentText(orig._originalText || '')
                        setCurrentTextLoss(orig._originalTextLoss || '')
                        setParsed(null)
                      }}
                      style={{flexShrink:0,fontSize:11,padding:'2px 8px',borderRadius:4,border:'1px solid rgba(94,106,210,0.35)',background:'transparent',color:'#5E6AD2',cursor:'pointer',fontFamily:'inherit',transition:'all 120ms',whiteSpace:'nowrap'}}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(94,106,210,0.1)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      재입력
                    </button>
                    <button
                      onClick={() => setConfirmedContracts(prev => prev.filter((_, idx) => idx !== i))}
                      style={{flexShrink:0,fontSize:13,padding:'1px 6px',borderRadius:4,border:'none',background:'transparent',color:'#8892A0',cursor:'pointer',fontFamily:'inherit',lineHeight:1}}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E24B4A' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8892A0' }}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                </div>
              </div>
            )}

            {/* 현재 분석 결과 */}
            {parsed && (
              <div ref={parsedResultRef}>
                {/* 경고 */}
                {parsed._warnings?.length > 0 && (
                  <div style={{background:'hsl(45 100% 96%)',border:'1px solid hsl(45 90% 70%)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:'hsl(35 80% 35%)',marginBottom:4}}>확인 필요 ({parsed._warnings.length}건)</div>
                    {parsed._warnings.map((w: string, i: number) => (
                      <div key={i} style={{fontSize:12,color:'hsl(35 70% 40%)',marginBottom:2,display:'flex',gap:4}}>
                        <span>•</span><span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 기존 고객 선택 표시 */}
                {saveMode === 'existing' && selectedCustomerId && (
                  <div style={{background:'rgba(94,106,210,0.08)',border:'1px solid rgba(94,106,210,0.25)',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:13,color:'#5E6AD2',fontWeight:600}}>
                    👤 {existingCustomers.find(c => c.id === selectedCustomerId)?.name} 님 계약에 추가
                  </div>
                )}

                {/* 고객 정보 — 첫 계약만 표시 */}
                {confirmedContracts.length === 0 && saveMode === 'new' && (
                  <>
                    <div className={styles.parsedSection}>고객 정보</div>
                    <div className={styles.parsedEditGrid}>
                      <div className={styles.field}><label>고객명</label><input value={parsed.name||''} onChange={e=>setParsed({...parsed,name:e.target.value})} placeholder="고객명" /></div>
                      <div className={styles.field}><label>주민등록번호</label><input value={parsed.rrn||''} onChange={e=>{const f=formatRRN(e.target.value);setParsed({...parsed,rrn:f,gender:getGenderFromRRN(f),age:getAgeFromRRN(f)})}} placeholder="000000-0000000" maxLength={14} /></div>
                      <div className={styles.field}><label>성별</label><input value={parsed.gender||''} onChange={e=>setParsed({...parsed,gender:e.target.value})} placeholder="남/여" /></div>
                      <div className={styles.field}><label>나이</label><input value={parsed.age||''} onChange={e=>setParsed({...parsed,age:e.target.value})} placeholder="나이" /></div>
                      <div className={styles.field}><label>연락처</label><input value={parsed.phone||''} onChange={e=>setParsed({...parsed,phone:e.target.value})} placeholder="010-0000-0000" /></div>
                      <div className={styles.field}><label>직업</label><input value={parsed.job||''} onChange={e=>setParsed({...parsed,job:e.target.value})} placeholder="공무원" /></div>
                    </div>
                  </>
                )}

                {/* 계약 정보 */}
                {parsed.contracts?.slice(0,1).map((ct: any, ctIdx: number) => (
                  <div key={ctIdx} className={styles.parsedContractBlock}>
                    <div className={styles.parsedSection}>{confirmedContracts.length + 1}번. {ct.company} · {ct.product_name}</div>
                    <div className={styles.parsedEditGrid}>
                      <div className={styles.field} style={{gridColumn:'1 / -1'}}><label>보험사</label>
                        <InsuranceCompanySelect value={ct.company||''} onChange={v=>{const c=[...parsed.contracts];c[ctIdx].company=v;setParsed({...parsed,contracts:c})}} />
                      </div>
                      <div className={styles.field}><label>상품명</label><input value={ct.product_name||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].product_name=e.target.value;setParsed({...parsed,contracts:c})}} /></div>
                      <div className={styles.field}><label>월보험료</label><input value={ct.monthly_fee?Number(ct.monthly_fee).toLocaleString():''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].monthly_fee=e.target.value.replace(/,/g,'');setParsed({...parsed,contracts:c})}} /></div>
                      <div className={styles.field}><label>납입상태</label>
                        <select value={ct.payment_status||'유지'} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].payment_status=e.target.value;setParsed({...parsed,contracts:c})}}
                          style={{width:'100%',fontSize:13,padding:'8px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',fontFamily:'inherit'}}>
                          {PAYMENT_STATUSES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className={styles.field}><label>가입연월</label>
                        <div style={{display:'flex',gap:4}}>
                          <select value={parseContractStart(ct.contract_start||'').year} onChange={e=>{const m=parseContractStart(ct.contract_start||'').month;const c=[...parsed.contracts];c[ctIdx].contract_start=joinContractStart(e.target.value,m);setParsed({...parsed,contracts:c})}}
                            style={{flex:1,fontSize:13,padding:'8px 6px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',fontFamily:'inherit'}}>
                            <option value="">년</option>{YEARS.map(y=><option key={y}>{y}</option>)}
                          </select>
                          <select value={parseContractStart(ct.contract_start||'').month} onChange={e=>{const y=parseContractStart(ct.contract_start||'').year;const c=[...parsed.contracts];c[ctIdx].contract_start=joinContractStart(y,e.target.value);setParsed({...parsed,contracts:c})}}
                            style={{flex:1,fontSize:13,padding:'8px 6px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',fontFamily:'inherit'}}>
                            <option value="">월</option>{MONTHS.map(m=><option key={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className={styles.field}><label>납입기간</label>
                        <select value={ct.payment_years||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].payment_years=e.target.value;setParsed({...parsed,contracts:c})}}
                          style={{width:'100%',fontSize:13,padding:'8px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',fontFamily:'inherit'}}>
                          <option value="">선택</option>{PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className={styles.field}><label>만기</label>
                        <select value={ct.expiry_age||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].expiry_age=e.target.value;setParsed({...parsed,contracts:c})}}
                          style={{width:'100%',fontSize:13,padding:'8px 10px',borderRadius:6,border:'1px solid #E5E7EB',background:'#F7F8FA',color:'#1A1A2E',fontFamily:'inherit'}}>
                          <option value="">선택</option>{EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.parsedCovList}>
                      {ct.coverages?.map((cv: any, cvIdx: number) => (
                        <div key={cvIdx} className={styles.covItem}>
                          <span className={styles.covCat}>{cv.category}</span>
                          <input className={styles.covNameInput} value={cv.name||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].coverages[cvIdx].name=e.target.value;setParsed({...parsed,contracts:c})}} />
                          <input className={styles.covAmtInput} value={cv.amount?Number(cv.amount).toLocaleString():''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].coverages[cvIdx].amount=e.target.value.replace(/,/g,'');setParsed({...parsed,contracts:c})}} />
                          <button className={styles.covDel} onClick={()=>{const c=[...parsed.contracts];c[ctIdx].coverages.splice(cvIdx,1);setParsed({...parsed,contracts:c})}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* 액션 버튼 */}
                <div style={{display:'flex',gap:8,marginTop:14}}>
                  <button onClick={() => setParsed(null)} className={styles.btnSecondary} style={{flex:'0 0 auto',padding:'9px 14px',fontSize:13}}>
                    ← 재분석
                  </button>
                  <button onClick={handleConfirmContract} className={styles.btnSecondary}
                    style={{flex:1,padding:'9px 14px',fontSize:13,borderColor:'rgba(94,106,210,0.3)',color:'#5E6AD2'}}>
                    + 다음 계약 추가
                  </button>
                  <button onClick={handleParseSave} disabled={saving}
                    style={{flex:1,padding:'9px 14px',fontSize:13,fontWeight:600,background:'#5E6AD2',color:'#ffffff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.6:1}}>
                    {saving ? '저장 중...' : '💾 저장하기'}
                  </button>
                </div>
              </div>
            )}

            {/* 빈 상태 — 분석 전 */}
            {!parsed && confirmedContracts.length === 0 && (
              <div className={styles.pastePanelEmpty}>
                <div style={{fontSize:28,opacity:0.3}}>📊</div>
                <div style={{fontSize:14,fontWeight:600,color:'#1A1A2E'}}>분석 결과가 여기 표시됩니다</div>
                <div style={{fontSize:13,color:'#636B78'}}>왼쪽에 보장내역을 붙여넣고<br/>AI 분석을 실행해주세요</div>
              </div>
            )}

            {/* 확인된 계약만 있고 현재 분석 없음 — 추가입력 + 저장 버튼 */}
            {!parsed && confirmedContracts.length > 0 && (
              <div style={{marginTop:4}}>
                <div style={{fontSize:13,color:'#636B78',textAlign:'center',marginBottom:12}}>
                  다음 계약을 입력하거나, 저장하세요
                </div>
                <button
                  onClick={() => { setCurrentText(''); setCurrentTextLoss('') }}
                  style={{
                    width:'100%',padding:'11px 0',marginBottom:8,
                    borderRadius:8,border:'1.5px solid #5E6AD2',
                    background:'rgba(94,106,210,0.06)',
                    color:'#5E6AD2',fontWeight:600,fontSize:13,
                    cursor:'pointer',transition:'all 120ms',fontFamily:'inherit',
                  }}
                >
                  + 계약 추가 입력
                </button>
                <button onClick={handleParseSave} disabled={saving} className={styles.saveParsedBtn}>
                  {saving ? '저장 중...' : `💾 전체 저장하기 (${confirmedContracts.length}건)`}
                </button>
              </div>
            )}
          </div>
          </div>{/* 오른쪽 애니메이션 wrapper 닫기 */}
        </div>
      )}

      {inputTab === 'file' && (
        <div className={styles.formWrap}>

          <div className={styles.formSection}>업로드 가이드</div>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
            {[
              { step:'①', text:'아이플래너 양식 엑셀 파일을 준비하세요' },
              { step:'②', text:'아래 영역에 파일을 드래그하거나 클릭해서 선택하세요' },
              { step:'③', text:'업로드 후 고객 정보와 계약 내역을 자동으로 등록합니다' },
              { step:'④', text:'등록 완료 후 고객 관리 페이지에서 확인하세요' },
            ].map(({ step, text }) => (
              <div key={step} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <span style={{fontSize:13,fontWeight:700,color:'#5E6AD2',flexShrink:0,minWidth:20}}>{step}</span>
                <span style={{fontSize:13,color:'#636B78',lineHeight:1.6}}>{text}</span>
              </div>
            ))}
          </div>

          <div className={styles.formSection}>파일 업로드</div>
          <div
            className={[styles.dropZone, dragOver ? styles.dropZoneActive : ''].join(' ')}
            style={{minHeight:180}}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{width:48,height:48,borderRadius:12,background:'rgba(94,106,210,0.1)',border:'1px solid rgba(94,106,210,0.2)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
              <FileUp style={{width:22,height:22,color:'#5E6AD2'}} />
            </div>
            <div style={{fontSize:14,fontWeight:600,color:'#1A1A2E',marginBottom:6}}>엑셀 파일을 드래그하거나 클릭하세요</div>
            <div style={{fontSize:13,color:'#636B78'}}>
              .xlsx, .xls, .csv 파일 지원 · 아이플래너 양식에 맞춰주세요
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleFileInput} />
          </div>

          <div style={{marginTop:16,padding:'14px 16px',background:'rgba(94,106,210,0.05)',border:'1px solid rgba(94,106,210,0.15)',borderRadius:8}}>
            <div style={{fontSize:13,fontWeight:600,color:'#5E6AD2',marginBottom:4}}>준비 중인 기능</div>
            <div style={{fontSize:13,color:'#636B78',lineHeight:1.6}}>
              엑셀 대량 업로드 기능은 현재 개발 중이에요. 빠른 시일 내에 제공할게요!
            </div>
          </div>
        </div>
      )}

      {inputTab === 'scan' && (
        <ScanCardTab onComplete={() => { setDone(true); setTimeout(() => router.push('/customers'), 1500) }} />
      )}
    </div>
    </div>
  )
}

