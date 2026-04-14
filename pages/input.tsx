import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import styles from '../styles/Input.module.css'

function ScanCardTab({ onComplete }: { onComplete: () => void }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => { return () => { stopCamera() } }, [stopCamera])

  async function openCamera() {
    try {
      setCameraOpen(true)
      window.history.pushState({ camera: true }, '')
      await new Promise(r => setTimeout(r, 100))
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      setCameraOpen(false)
      alert('카메라 접근이 거부되었어요. 설정에서 카메라 권한을 허용해주세요.')
    }
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
  }

  useEffect(() => {
    function handlePopState() {
      if (cameraOpen) {
        stopCamera()
        setCameraOpen(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [cameraOpen, stopCamera])

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    stopCamera()
    setCameraOpen(false)
    handleScan(dataUrl)
  }

  async function handleScan(imageData: string) {
    setScanning(true)
    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      })
      const data = await res.json()
      if (data.error) {
        alert('스캔 오류: ' + data.error)
        setScanning(false)
        return
      }
      if (!data.name && !data.phone && !data.email && !data.company) {
        alert('명함 정보를 인식하지 못했어요. 다시 촬영해주세요.')
        setScanning(false)
        return
      }
      setResult(data)
    } catch (e) {
      alert('명함 스캔 중 오류가 발생했어요!')
    }
    setScanning(false)
  }

  async function handleSave() {
    if (!result?.name) return alert('이름이 없어요! 직접 입력해주세요.')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('dpa_customers').insert({
        name: result.name,
        phone: result.phone || null,
        email: result.email || null,
        address: result.address || null,
        workplace: result.company || null,
        job: result.position || null,
        grade: '일반',
        customer_type: 'prospect',
        agent_id: user?.id,
      })
      onComplete()
    } catch (e) {
      alert('저장 중 오류가 발생했어요!')
    }
    setSaving(false)
  }

  function resetScan() {
    setResult(null)
    setCapturedImage(null)
    setScanning(false)
  }

  // 카메라 오버레이 UI (삼성페이 스타일)
  if (cameraOpen) {
    return (
      <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:9999,background:'#000',animation:'slideInRight 0.3s ease-out'}}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <video ref={videoRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover'}} playsInline muted />
        {/* 흰색 반투명 오버레이 + 명함 비율 라운드 사각형 */}
        <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
          <defs>
            <mask id="cardMask">
              <rect width="100%" height="100%" fill="white"/>
              <rect x="8%" y="35%" width="84%" height="22%" rx="14" ry="14" fill="black"/>
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(255,255,255,0.7)" mask="url(#cardMask)"/>
          {/* 코너 가이드 (삼성페이 스타일) */}
          <rect x="8%" y="35%" width="84%" height="22%" rx="14" ry="14" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1"/>
        </svg>
        {/* 뒤로가기 */}
        <div style={{position:'absolute',top:16,left:16,zIndex:1,cursor:'pointer'}} onClick={() => { window.history.back() }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 4L8 14L18 24" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {/* 가이드 텍스트 */}
        <div style={{position:'absolute',top:'28%',left:0,right:0,textAlign:'center',color:'#333',fontSize:15,fontWeight:500}}>
          명함을 사각형 안에 맞춰주세요
        </div>
        {/* 하단 촬영 버튼 */}
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'32px 0 48px',display:'flex',justifyContent:'center'}}>
          <button onClick={capturePhoto} style={{width:68,height:68,borderRadius:'50%',background:'#1D9E75',border:'4px solid rgba(29,158,117,0.3)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 2px 12px rgba(29,158,117,0.3)'}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="2"/></svg>
          </button>
        </div>
        <canvas ref={canvasRef} style={{display:'none'}} />
      </div>
    )
  }

  // 스캔 결과 화면
  if (result) {
    return (
      <div style={{padding:'16px 0'}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:600,color:'#1D9E75',marginBottom:4}}>명함 스캔 완료!</div>
          <div style={{fontSize:13,color:'#888'}}>내용을 확인하고 수정해주세요</div>
        </div>
        {capturedImage && (
          <div style={{marginBottom:16,borderRadius:12,overflow:'hidden',border:'1px solid #e8e6e1'}}>
            <img src={capturedImage} alt="명함" style={{width:'100%',display:'block'}} />
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
          {[
            {label:'이름', key:'name'},
            {label:'회사', key:'company'},
            {label:'직함', key:'position'},
            {label:'휴대폰', key:'phone'},
            {label:'유선전화', key:'phone2'},
            {label:'이메일', key:'email'},
            {label:'주소', key:'address'},
            {label:'팩스', key:'fax'},
          ].map(f => (
            <div key={f.key} style={{display:'flex',alignItems:'center',gap:8}}>
              <label style={{fontSize:13,color:'#888',width:60,flexShrink:0,textAlign:'right'}}>{f.label}</label>
              <input
                value={result[f.key] || ''}
                onChange={e => setResult({ ...result, [f.key]: e.target.value })}
                style={{flex:1,fontSize:14,padding:'8px 12px',borderRadius:8,border:'1px solid #e8e6e1',background:'#FAF9F5'}}
                placeholder={f.label}
              />
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={resetScan} style={{flex:1,padding:'12px 0',borderRadius:10,border:'1px solid #e8e6e1',background:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',color:'#666'}}>
            다시 촬영
          </button>
          <button onClick={handleSave} disabled={saving} style={{flex:1,padding:'12px 0',borderRadius:10,border:'none',background:'#1D9E75',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>
            {saving ? '저장 중...' : '관심고객으로 저장'}
          </button>
        </div>
      </div>
    )
  }

  // 스캔 중
  if (scanning) {
    return (
      <div style={{padding:'60px 0',textAlign:'center'}}>
        <div style={{fontSize:32,marginBottom:12}}>🔍</div>
        <div style={{fontSize:15,fontWeight:500,color:'#1D9E75'}}>AI가 명함을 분석하고 있어요...</div>
        <div style={{fontSize:13,color:'#888',marginTop:4}}>잠시만 기다려주세요</div>
      </div>
    )
  }

  // 초기 화면
  return (
    <div style={{padding:'40px 0',textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>📷</div>
      <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>명함을 촬영해서 고객을 등록하세요</div>
      <div style={{fontSize:13,color:'#888',marginBottom:24,lineHeight:1.5}}>
        명함을 촬영하면 AI가 자동으로<br/>이름, 연락처, 이메일 등을 인식합니다
      </div>
      <button onClick={openCamera} style={{padding:'14px 36px',borderRadius:12,background:'#1D9E75',color:'#fff',border:'none',fontSize:15,fontWeight:600,cursor:'pointer'}}>
        명함촬영
      </button>
    </div>
  )
}

type InputTab = 'paste' | 'scan' | 'manual'


const JOBS = ['직장인 (회사원)', '자영업자', '공무원', '교사 / 교직원', '의료인', '전문직', '주부', '학생', '농업 / 어업', '프리랜서', '은퇴 / 무직', '기타']
const COMPANIES = ['삼성생명', '한화생명', '교보생명', '신한라이프', 'DB생명', '흥국생명', '동양생명', '미래에셋생명', '푸본현대생명', '메트라이프', '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재', '흥국화재', '롯데손해보험', 'MG손해보험', '기타']
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
    company: '삼성생명', companyCustom: '', product_name: '', insurance_type: '건강',
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
  const [pasteText, setPasteText] = useState('')
  const [contractCount, setContractCount] = useState<number>(1)
  const [contractTexts, setContractTexts] = useState<string[]>([''])
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [jobCustom, setJobCustom] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new')
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  useEffect(() => {
    if (queryTab === 'scan' || queryTab === 'manual' || queryTab === 'paste') {
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
    setContractCount(count)
    setContractTexts(prev => {
      const arr = [...prev]
      while (arr.length < count) arr.push('')
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
    const combinedText = contractTexts.some(t => t.trim())
      ? contractTexts.map((t, i) => t.trim() ? `[계약 ${i + 1}번]\n${t.trim()}` : '').filter(Boolean).join('\n\n')
      : pasteText
    if (!combinedText.trim()) return alert('텍스트를 붙여넣어 주세요!')
    setParsing(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combinedText }),
      })
      const data = await res.json()
      setParsed(data)
      setSaveMode('new')
      setSelectedCustomerId('')
      // 기존 고객 목록 불러오기
      const { data: { user } } = await supabase.auth.getUser()
      const { data: custs } = await supabase.from('dpa_customers').select('id, name, age').eq('agent_id', user?.id).order('name')
      setExistingCustomers(custs || [])
    } catch (e) { alert('파싱 중 오류가 발생했어요!') }
    setParsing(false)
  }

  async function handleParseSave() {
    if (!parsed) return
    if (saveMode === 'existing' && !selectedCustomerId) return alert('기존 고객을 선택해주세요!')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const agentId = user?.id

      let customerId: string

      if (saveMode === 'existing') {
        // 기존 고객에 보험만 추가
        customerId = selectedCustomerId
      } else {
        // 새 고객으로 저장
        const birthDate = getBirthDateFromRRN(parsed.rrn || '')
        const { data: cust } = await supabase.from('dpa_customers').insert({
          name: parsed.name || '이름미상', age: parsed.age || null,
          gender: parsed.gender || '미상', grade: '일반',
          phone: parsed.phone || null, address: parsed.address || null,
          job: parsed.job || null, workplace: parsed.workplace || null,
          bank_name: parsed.bank_name || null, bank_account: parsed.bank_account || null,
          driver_license: parsed.driver_license || null,
          resident_number: parsed.rrn || null,
          birth_date: birthDate,
          customer_type: 'existing',
          agent_id: agentId,
        }).select().single()
        if (!cust) throw new Error('고객 저장 실패')
        customerId = cust.id
      }

      if (parsed.contracts) {
        for (const ct of parsed.contracts) {
          const { data: contract } = await supabase.from('dpa_contracts').insert({
            customer_id: customerId, agent_id: agentId,
            company: ct.company || '', product_name: ct.product_name || '',
            monthly_fee: ct.monthly_fee || 0, payment_status: ct.payment_status || '유지',
            payment_rate: ct.payment_rate || 0, insurance_type: ct.insurance_type || '',
            contract_start: ct.contract_start || '', payment_years: ct.payment_years || '',
            expiry_age: ct.expiry_age || '', input_method: 'paste',
          }).select().single()

          if (contract && ct.coverages) {
            for (const cv of ct.coverages) {
              await supabase.from('dpa_coverages').insert({
                contract_id: contract.id, category: cv.category || '',
                coverage_name: cv.name || '', amount: cv.amount || 0, status: '정상',
              })
            }
          }
        }
      }
      setDone(true)
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
    setParsed(null); setPasteText(''); setContractTexts(['']); setContractCount(1); setJobCustom('')
  }

  if (done) return (
    <div className={styles.doneWrap}>
      <div className={styles.doneIcon}>✅</div>
      <div className={styles.doneText}>저장 완료!</div>
      <div className={styles.doneActions}>
        <a href="/customers" className={styles.btnPrimary}>고객 목록 보기</a>
        <button className={styles.btnSecondary} onClick={resetForm}>추가 입력</button>
      </div>
    </div>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <button className={[styles.tab, inputTab === 'paste' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('paste')}>📋 텍스트 붙여넣기</button>
        <button className={[styles.tab, inputTab === 'scan' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('scan')}>📷 명함 입력</button>
        <button className={[styles.tab, inputTab === 'manual' ? styles.activeTab : ''].join(' ')} onClick={() => handleTabChange('manual')}>✏️ 수동 입력</button>
      </div>

      {inputTab === 'manual' && (
        <div className={styles.formWrap}>
          <div className={styles.formSection}>고객 기본 정보</div>
          <div className={styles.formGrid}>
            <div className={styles.field}><label>고객명 *</label><input value={form.name} onChange={e => setF('name', e.target.value.replace(/[0-9]/g, ''))} placeholder="홍길동" /></div>
            <div className={styles.field}><label>주민등록번호</label><input value={form.rrn} onChange={e => handleRRN(e.target.value)} placeholder="000000-0000000" maxLength={14} /></div>
            <div className={styles.field}><label>성별 <span className={styles.autoTag}>자동</span></label><select value={form.gender} onChange={e => setF('gender', e.target.value)}><option>여</option><option>남</option></select></div>
            <div className={styles.field}><label>나이 <span className={styles.autoTag}>자동</span></label><input value={form.age} onChange={e => setF('age', e.target.value)} placeholder="45" /></div>
            <div className={styles.field}><label>연락처</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="010-0000-0000" /></div>
            <div className={styles.field}><label>등급</label><select value={form.grade} onChange={e => setF('grade', e.target.value)}><option>일반</option><option>VIP</option></select></div>
            <div className={styles.field}><label>직업</label><select value={form.job} onChange={e => setF('job', e.target.value)}>{JOBS.map(j => <option key={j}>{j}</option>)}</select></div>
            {form.job === '기타' && <div className={styles.field}><label>직업 직접 입력</label><input value={jobCustom} onChange={e => setJobCustom(e.target.value)} placeholder="직업을 입력해주세요" /></div>}
            <div className={styles.field}><label>주소</label><input value={form.address} onChange={e => setF('address', e.target.value)} placeholder="서울시 강남구..." /></div>
            <div className={styles.field}><label>직장/소속</label><input value={form.workplace} onChange={e => setF('workplace', e.target.value)} placeholder="서울시청" /></div>
            <div className={styles.field}><label>은행명</label><select value={form.bank_name} onChange={e => setF('bank_name', e.target.value)}><option value="">선택</option>{BANKS.map(b => <option key={b}>{b}</option>)}</select></div>
            <div className={styles.field}><label>계좌번호</label><input value={form.bank_account} onChange={e => setF('bank_account', e.target.value)} placeholder="1002-3628-09746" /></div>
            <div className={styles.field}><label>운전면허</label><input value={form.driver_license} onChange={e => setF('driver_license', e.target.value)} placeholder="26-06-009864-70" /></div>
          </div>

          {/* 보험 계약 */}
          {contracts.map((ct, idx) => (
            <div key={idx} className={styles.contractBlock}>
              <div className={styles.contractBlockHeader}>
                <div className={styles.formSection}>보험 {idx + 1}</div>
                {contracts.length > 1 && <button className={styles.removeBtn} onClick={() => removeContract(idx)}>삭제</button>}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}><label>보험사</label><select value={ct.company} onChange={e => updateContract(idx, 'company', e.target.value)}>{COMPANIES.map(c => <option key={c}>{c}</option>)}</select></div>
                {ct.company === '기타' && <div className={styles.field}><label>보험사 직접 입력</label><input value={ct.companyCustom} onChange={e => updateContract(idx, 'companyCustom', e.target.value)} placeholder="보험사명" /></div>}
                <div className={styles.field}><label>상품명</label><input value={ct.product_name} onChange={e => updateContract(idx, 'product_name', e.target.value)} placeholder="무배당 건강보험" /></div>
                <div className={styles.field}><label>보험 종류</label><select value={ct.insurance_type} onChange={e => updateContract(idx, 'insurance_type', e.target.value)}>{INS_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className={styles.field}><label>월보험료 (원)</label><input inputMode="numeric" value={ct.monthly_fee ? formatMoney(String(ct.monthly_fee)) : ''} onChange={e => updateContract(idx, 'monthly_fee', parseMoney(e.target.value))} placeholder="50,000" /></div>
                <div className={styles.field}><label>납입 상태</label><select value={ct.payment_status} onChange={e => updateContract(idx, 'payment_status', e.target.value)}>{PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div className={styles.field}><label>가입 연월</label>
                  <div style={{display:'flex',gap:4}}>
                    <select value={parseContractStart(ct.contract_start).year} onChange={e=>updateContract(idx,'contract_start',joinContractStart(e.target.value,parseContractStart(ct.contract_start).month))} style={{flex:1,fontSize:13,padding:'9px 6px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)'}}>
                      <option value="">년</option>
                      {YEARS.map(y=><option key={y}>{y}</option>)}
                    </select>
                    <select value={parseContractStart(ct.contract_start).month} onChange={e=>updateContract(idx,'contract_start',joinContractStart(parseContractStart(ct.contract_start).year,e.target.value))} style={{flex:1,fontSize:13,padding:'9px 6px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)'}}>
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
                      <button style={{flex:1,padding:'7px',fontSize:13,background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer'}} onClick={() => addCoverage(idx)}>추가하기</button>
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
        <div className={styles.formWrap}>
          {/* 가이드 아이콘 버튼 + 팝업 */}
          {/* 가이드 + 계약 수 입력 */}
          <div className={styles.guideRow}>
            <span className={styles.guideLabel}>보장 내역 붙여넣기</span>
            <button className={styles.guideBtn} onClick={() => setGuideOpen(v => !v)} title="도움말">❓</button>
            {guideOpen && (
              <>
                <div style={{position:'fixed',inset:0,zIndex:499}} onClick={() => setGuideOpen(false)} />
                <div className={styles.guidePopup} onClick={e => e.stopPropagation()}>
                  <div className={styles.guidePopupHeader}>
                    <span>📋 보장 내역 붙여넣기 방법</span>
                    <button onClick={() => setGuideOpen(false)} className={styles.guideCloseBtn}>✕</button>
                  </div>
                  <div className={styles.pasteGuideStep}>① 보험사 프로그램에서 계약 수를 확인하세요</div>
                  <div className={styles.pasteGuideStep}>② 아래 계약 수를 입력하면 칸이 자동으로 생성돼요</div>
                  <div className={styles.pasteGuideStep}>③ 각 계약별로 보장 내역을 긁어서 <b>Ctrl + C → Ctrl + V</b></div>
                  <div className={styles.pasteGuideStep}>④ 모두 붙여넣기 완료 후 AI 분석하기 클릭!</div>
                </div>
              </>
            )}
          </div>

          {/* 계약 수 입력 */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 14px',background:'var(--green-light)',borderRadius:10}}>
            <span style={{fontSize:13,color:'var(--green)',fontWeight:600}}>📋 보험 계약 수</span>
            <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
              <button onClick={() => handleContractCount(contractCount - 1)} style={{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',fontSize:16,cursor:'pointer',color:'var(--text-primary)'}}>−</button>
              <input
                type="number" min={1} max={20}
                value={contractCount}
                onChange={e => handleContractCount(parseInt(e.target.value) || 1)}
                style={{width:44,textAlign:'center',fontSize:14,fontWeight:700,border:'1px solid var(--border)',borderRadius:6,padding:'4px',background:'var(--bg-card)',color:'var(--text-primary)'}}
              />
              <button onClick={() => handleContractCount(contractCount + 1)} style={{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',fontSize:16,cursor:'pointer',color:'var(--text-primary)'}}>+</button>
              <span style={{fontSize:12,color:'var(--text-secondary)'}}>건</span>
            </div>
          </div>

          {/* 계약별 textarea */}
          {contractTexts.map((text, idx) => (
            <div key={idx} style={{marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:4}}>
                {idx + 1}번 계약 붙여넣기
              </div>
              <textarea
                className={styles.pasteArea}
                value={text}
                onChange={e => {
                  const arr = [...contractTexts]
                  arr[idx] = e.target.value
                  setContractTexts(arr)
                }}
                placeholder={`${idx + 1}번 보험 보장내역을 여기에 붙여넣기 하세요 (Ctrl+V)`}
                rows={5}
                style={{marginBottom:0}}
              />
            </div>
          ))}

          {/* 엑셀 업로드 */}
          <div className={styles.excelSection}>
            <div className={styles.excelLabel}>또는 엑셀 파일로 업로드</div>
            <div
              className={[styles.dropZone, dragOver ? styles.dropZoneActive : ''].join(' ')}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles.dropIcon}>📂</div>
              <div className={styles.dropText}>파일을 끌어다 놓거나 클릭해서 업로드</div>
              <div className={styles.dropSub}>.xlsx, .xls 파일 지원</div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />
            </div>
          </div>

          <button className={styles.parseBtn} onClick={handleParse} disabled={parsing || !contractTexts.some(t => t.trim())}>
            {parsing ? 'AI 분석 중...' : '🤖 1단계: AI로 분석하기'}
          </button>

          {parsed && (
            <div className={styles.parsedResult}>
              <div className={styles.parsedResultTitle}>✅ 분석 완료! 내용을 확인하고 수정해주세요</div>

              {/* 저장 방식 선택 */}
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <button onClick={() => setSaveMode('new')} style={{flex:1,padding:'8px 0',borderRadius:8,border:`2px solid ${saveMode==='new'?'#1D9E75':'#E5E7EB'}`,background:saveMode==='new'?'#E8F8F2':'#fff',color:saveMode==='new'?'#1D9E75':'#6B7280',fontWeight:saveMode==='new'?600:400,fontSize:13,cursor:'pointer'}}>
                  ➕ 새 고객으로 저장
                </button>
                <button onClick={() => setSaveMode('existing')} style={{flex:1,padding:'8px 0',borderRadius:8,border:`2px solid ${saveMode==='existing'?'#1D9E75':'#E5E7EB'}`,background:saveMode==='existing'?'#E8F8F2':'#fff',color:saveMode==='existing'?'#1D9E75':'#6B7280',fontWeight:saveMode==='existing'?600:400,fontSize:13,cursor:'pointer'}}>
                  👤 기존 고객에 추가
                </button>
              </div>

              {/* 기존 고객 선택 드롭다운 */}
              {saveMode === 'existing' && (
                <div style={{marginBottom:12}}>
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} style={{width:'100%',fontSize:13,padding:'8px 12px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff'}}>
                    <option value="">고객을 선택해주세요</option>
                    {existingCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.age ? `(${c.age}세)` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.parsedSection}>고객 정보</div>
              {saveMode === 'new' && (
              <div className={styles.parsedEditGrid}>
                <div className={styles.field}><label>고객명</label><input value={parsed.name || ''} onChange={e => setParsed({...parsed, name: e.target.value})} placeholder="고객명" /></div>
                <div className={styles.field}><label>나이</label><input value={parsed.age || ''} onChange={e => setParsed({...parsed, age: e.target.value})} placeholder="나이" /></div>
                <div className={styles.field}><label>성별</label><input value={parsed.gender || ''} onChange={e => setParsed({...parsed, gender: e.target.value})} placeholder="남/여" /></div>
                <div className={styles.field}><label>주민번호</label><input value={parsed.rrn || ''} onChange={e => {
                  const formatted = formatRRN(e.target.value)
                  setParsed({...parsed, rrn: formatted, gender: getGenderFromRRN(formatted), age: getAgeFromRRN(formatted)})
                }} placeholder="000000-0000000" maxLength={14} /></div>
                <div className={styles.field}><label>연락처</label><input value={parsed.phone || ''} onChange={e => setParsed({...parsed, phone: e.target.value})} placeholder="010-0000-0000" /></div>
                <div className={styles.field}><label>직업</label><input value={parsed.job || ''} onChange={e => setParsed({...parsed, job: e.target.value})} placeholder="공무원" /></div>
              </div>
              )}

              {parsed.contracts?.map((ct: any, ctIdx: number) => (
                <div key={ctIdx} className={styles.parsedContractBlock}>
                  <div className={styles.parsedSection}>{ctIdx + 1}. {ct.company} · {ct.product_name}</div>
                  <div className={styles.parsedEditGrid}>
                    <div className={styles.field}><label>보험사</label>
                      <select value={ct.company || ''} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].company = e.target.value; setParsed({...parsed, contracts: c}) }} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-primary)'}}>
                        {COMPANIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}><label>상품명</label><input value={ct.product_name || ''} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].product_name = e.target.value; setParsed({...parsed, contracts: c}) }} /></div>
                    <div className={styles.field}><label>월보험료</label><input value={ct.monthly_fee ? Number(ct.monthly_fee).toLocaleString() : ''} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].monthly_fee = e.target.value.replace(/,/g, ''); setParsed({...parsed, contracts: c}) }} /></div>
                    <div className={styles.field}><label>납입상태</label>
                      <select value={ct.payment_status || '유지'} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].payment_status = e.target.value; setParsed({...parsed, contracts: c}) }} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-primary)'}}>
                        {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}><label>가입연월</label>
                      <div style={{display:'flex',gap:4}}>
                        <select value={parseContractStart(ct.contract_start||'').year} onChange={e=>{const m=parseContractStart(ct.contract_start||'').month;const c=[...parsed.contracts];c[ctIdx].contract_start=joinContractStart(e.target.value,m);setParsed({...parsed,contracts:c})}} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                          <option value="">년</option>
                          {YEARS.map(y=><option key={y}>{y}</option>)}
                        </select>
                        <select value={parseContractStart(ct.contract_start||'').month} onChange={e=>{const y=parseContractStart(ct.contract_start||'').year;const c=[...parsed.contracts];c[ctIdx].contract_start=joinContractStart(y,e.target.value);setParsed({...parsed,contracts:c})}} style={{flex:1,fontSize:13,padding:'6px 6px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff'}}>
                          <option value="">월</option>
                          {MONTHS.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.field}><label>납입기간</label>
                      <select value={ct.payment_years||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].payment_years=e.target.value;setParsed({...parsed,contracts:c})}} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-primary)'}}>
                        <option value="">선택</option>
                        {PAYMENT_YEARS.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}><label>만기</label>
                      <select value={ct.expiry_age||''} onChange={e=>{const c=[...parsed.contracts];c[ctIdx].expiry_age=e.target.value;setParsed({...parsed,contracts:c})}} style={{width:'100%',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text-primary)'}}>
                        <option value="">선택</option>
                        {EXPIRY_AGES.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.parsedCovList}>
                    {ct.coverages?.map((cv: any, cvIdx: number) => (
                      <div key={cvIdx} className={styles.covItem}>
                        <span className={styles.covCat}>{cv.category}</span>
                        <input className={styles.covNameInput} value={cv.name || ''} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].coverages[cvIdx].name = e.target.value; setParsed({...parsed, contracts: c}) }} />
                        <input className={styles.covAmtInput} value={cv.amount ? Number(cv.amount).toLocaleString() : ''} onChange={e => { const c = [...parsed.contracts]; c[ctIdx].coverages[cvIdx].amount = e.target.value.replace(/,/g, ''); setParsed({...parsed, contracts: c}) }} />
                        <button className={styles.covDel} onClick={() => { const c = [...parsed.contracts]; c[ctIdx].coverages.splice(cvIdx, 1); setParsed({...parsed, contracts: c}) }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button className={styles.saveParsedBtn} onClick={handleParseSave} disabled={saving}>
                {saving ? '저장 중...' : '✅ 2단계: 확인 후 저장하기'}
              </button>
            </div>
          )}
        </div>
      )}

      {inputTab === 'scan' && (
        <ScanCardTab onComplete={() => { setDone(true); setTimeout(() => router.push('/customers'), 1500) }} />
      )}
    </div>
  )
}
