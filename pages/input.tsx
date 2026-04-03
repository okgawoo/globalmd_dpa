import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Input.module.css'

type InputTab = 'manual' | 'paste' | 'capture'

const JOBS = ['직장인 (회사원)', '자영업자', '공무원', '교사 / 교직원', '의료인', '전문직', '주부', '학생', '농업 / 어업', '프리랜서', '은퇴 / 무직', '기타']
const COMPANIES = ['삼성생명', '한화생명', '교보생명', '신한라이프', 'DB생명', '흥국생명', '동양생명', '미래에셋생명', '푸본현대생명', '메트라이프', '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재', '흥국화재', '롯데손해보험', 'MG손해보험', '기타']

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

export default function InputPage() {
  const [inputTab, setInputTab] = useState<InputTab>('manual')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [jobCustom, setJobCustom] = useState('')
  const [companyCustom, setCompanyCustom] = useState('')

  const [form, setForm] = useState({
    name: '', rrn: '', age: '', gender: '여', job: '직장인 (회사원)', phone: '', grade: '일반',
    company: '삼성생명', product_name: '', monthly_fee: '', payment_status: '유지',
    payment_rate: '', payment_total: '', payment_done: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleRRN(v: string) {
    const formatted = formatRRN(v)
    const gender = getGenderFromRRN(formatted)
    const age = getAgeFromRRN(formatted)
    setForm(f => ({ ...f, rrn: formatted, gender, age }))
  }

  function handlePaymentDone(v: string) {
    const done = parseInt(v) || 0
    const total = parseInt(form.payment_total) || 0
    const rate = total > 0 ? Math.round((done / total) * 100) : 0
    setForm(f => ({ ...f, payment_done: v, payment_rate: String(rate) }))
  }

  function handlePaymentTotal(v: string) {
    const total = parseInt(v) || 0
    const done = parseInt(form.payment_done) || 0
    const rate = total > 0 ? Math.round((done / total) * 100) : 0
    setForm(f => ({ ...f, payment_total: v, payment_rate: String(rate) }))
  }

  const finalJob = form.job === '기타' ? jobCustom : form.job
  const finalCompany = form.company === '기타' ? companyCustom : form.company

  async function handleManualSave() {
    if (!form.name || !finalCompany) return alert('고객명과 보험사는 필수예요!')
    setSaving(true)
    try {
      const birthYear = form.rrn.length >= 7 ? (parseInt(form.rrn[6]) <= 2 ? 1900 : 2000) + parseInt(form.rrn.slice(0, 2)) : null
      const birthDate = birthYear ? `${birthYear}-${form.rrn.slice(2, 4)}-${form.rrn.slice(4, 6)}` : null

      const { data: cust } = await supabase.from('dpa_customers').insert({
        name: form.name,
        age: parseInt(form.age) || null,
        birth_date: birthDate,
        gender: form.gender,
        job: finalJob,
        phone: form.phone,
        grade: form.grade,
      }).select().single()

      if (cust) {
        await supabase.from('dpa_contracts').insert({
          customer_id: cust.id,
          company: finalCompany,
          product_name: form.product_name,
          monthly_fee: parseInt(form.monthly_fee) || 0,
          payment_status: form.payment_status,
          payment_rate: parseInt(form.payment_rate) || 0,
          payment_total: parseInt(form.payment_total) || 0,
          payment_done: parseInt(form.payment_done) || 0,
          input_method: 'manual',
        })
      }
      setDone(true)
    } catch (e) { alert('저장 중 오류가 발생했어요!') }
    setSaving(false)
  }

  async function handleParseSave() {
    if (!parsed) return
    setSaving(true)
    try {
      const { data: cust } = await supabase.from('dpa_customers').insert({
        name: parsed.name || '이름미상', age: parsed.age || null,
        gender: parsed.gender || '미상', grade: '일반',
      }).select().single()

      if (cust && parsed.contracts) {
        for (const ct of parsed.contracts) {
          const { data: contract } = await supabase.from('dpa_contracts').insert({
            customer_id: cust.id,
            company: ct.company || '', product_name: ct.product_name || '',
            monthly_fee: ct.monthly_fee || 0,
            payment_status: ct.payment_status || '유지',
            payment_rate: ct.payment_rate || 0,
            input_method: 'paste',
          }).select().single()

          if (contract && ct.coverages) {
            for (const cv of ct.coverages) {
              await supabase.from('dpa_coverages').insert({
                contract_id: contract.id,
                category: cv.category || '',
                coverage_name: cv.name || '',
                amount: cv.amount || 0,
                status: '정상',
                brain_coverage_type: cv.brain_type || null,
              })
            }
          }
        }
      }
      setDone(true)
    } catch (e) { alert('저장 중 오류가 발생했어요!') }
    setSaving(false)
  }

  async function handleParse() {
    if (!pasteText.trim()) return alert('텍스트를 붙여넣어 주세요!')
    setParsing(true)
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = await res.json()
      setParsed(data)
    } catch (e) { alert('파싱 중 오류가 발생했어요!') }
    setParsing(false)
  }

  const resetForm = () => {
    setDone(false)
    setForm({ name:'', rrn:'', age:'', gender:'여', job:'직장인 (회사원)', phone:'', grade:'일반', company:'삼성생명', product_name:'', monthly_fee:'', payment_status:'유지', payment_rate:'', payment_total:'', payment_done:'' })
    setParsed(null)
    setPasteText('')
    setJobCustom('')
    setCompanyCustom('')
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
        <button className={[styles.tab, inputTab === 'manual' ? styles.activeTab : ''].join(' ')} onClick={() => setInputTab('manual')}>✏️ 수동 입력</button>
        <button className={[styles.tab, inputTab === 'paste' ? styles.activeTab : ''].join(' ')} onClick={() => setInputTab('paste')}>📋 텍스트 붙여넣기</button>
        <button className={[styles.tab, inputTab === 'capture' ? styles.activeTab : ''].join(' ')} onClick={() => setInputTab('capture')}>📱 캡처 (준비중)</button>
      </div>

      {inputTab === 'manual' && (
        <div className={styles.formWrap}>
          <div className={styles.formSection}>고객 기본 정보</div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>고객명 *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" />
            </div>
            <div className={styles.field}>
              <label>주민등록번호</label>
              <input
                value={form.rrn}
                onChange={e => handleRRN(e.target.value)}
                placeholder="000000-0000000"
                maxLength={14}
              />
            </div>
            <div className={styles.field}>
              <label>성별 <span className={styles.autoTag}>자동</span></label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option>여</option><option>남</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>나이 <span className={styles.autoTag}>자동</span></label>
              <input value={form.age} onChange={e => set('age', e.target.value)} placeholder="45" />
            </div>
            <div className={styles.field}>
              <label>연락처</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div className={styles.field}>
              <label>등급</label>
              <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                <option>일반</option><option>VIP</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>직업</label>
              <select value={form.job} onChange={e => set('job', e.target.value)}>
                {JOBS.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            {form.job === '기타' && (
              <div className={styles.field}>
                <label>직업 직접 입력</label>
                <input value={jobCustom} onChange={e => setJobCustom(e.target.value)} placeholder="직업을 입력해주세요" />
              </div>
            )}
          </div>

          <div className={styles.formSection}>보험 계약 정보</div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>보험사 *</label>
              <select value={form.company} onChange={e => set('company', e.target.value)}>
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.company === '기타' && (
              <div className={styles.field}>
                <label>보험사 직접 입력</label>
                <input value={companyCustom} onChange={e => setCompanyCustom(e.target.value)} placeholder="보험사명을 입력해주세요" />
              </div>
            )}
            <div className={styles.field}>
              <label>상품명</label>
              <input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="무배당 건강보험" />
            </div>
            <div className={styles.field}>
              <label>월보험료 (원)</label>
              <input type="number" value={form.monthly_fee} onChange={e => set('monthly_fee', e.target.value)} placeholder="50000" />
            </div>
            <div className={styles.field}>
              <label>납입 상태</label>
              <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                <option>유지</option><option>완납</option><option>실효</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>총 납입 회차</label>
              <input type="number" value={form.payment_total} onChange={e => handlePaymentTotal(e.target.value)} placeholder="120" />
            </div>
            <div className={styles.field}>
              <label>완료 회차</label>
              <input type="number" value={form.payment_done} onChange={e => handlePaymentDone(e.target.value)} placeholder="109" />
            </div>
            <div className={styles.field}>
              <label>납입률 (%) <span className={styles.autoTag}>자동</span></label>
              <input value={form.payment_rate} readOnly placeholder="자동 계산" className={styles.readOnly} />
            </div>
          </div>

          <button className={styles.saveBtn} onClick={handleManualSave} disabled={saving}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}

      {inputTab === 'paste' && (
        <div className={styles.formWrap}>
          <div className={styles.pasteGuide}>
            보험사 프로그램에서 보장 내역 텍스트를 마우스로 긁어서 아래에 붙여넣으세요!
          </div>
          <textarea
            className={styles.pasteArea}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`예시:\n뇌혈관질환진단 뇌혈관질환진단비(건강고지형) 3,000만원 정상\n암진단 암진단비(유사암제외)(건강고지형) 5,000만원 정상\n...`}
            rows={10}
          />
          <button className={styles.parseBtn} onClick={handleParse} disabled={parsing}>
            {parsing ? 'AI 분석 중...' : '🤖 AI로 분석하기'}
          </button>

          {parsed && (
            <div className={styles.parsedResult}>
              <div className={styles.formSection}>분석 결과 확인</div>
              <div className={styles.parsedInfo}>
                <span>고객명: <b>{parsed.name || '미확인'}</b></span>
                <span>나이: <b>{parsed.age || '미확인'}</b></span>
                <span>보험사: <b>{parsed.contracts?.[0]?.company || '미확인'}</b></span>
                <span>보장 항목: <b>{parsed.contracts?.[0]?.coverages?.length || 0}개</b></span>
              </div>
              <button className={styles.saveBtn} onClick={handleParseSave} disabled={saving}>
                {saving ? '저장 중...' : '이대로 저장하기'}
              </button>
            </div>
          )}
        </div>
      )}

      {inputTab === 'capture' && (
        <div className={styles.captureWrap}>
          <div className={styles.captureIcon}>📱</div>
          <div className={styles.captureText}>캡처 런처 기능 준비 중이에요!</div>
        </div>
      )}
    </div>
  )
}
