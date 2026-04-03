import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Input.module.css'

type InputTab = 'manual' | 'paste' | 'capture'

export default function InputPage() {
  const [inputTab, setInputTab] = useState<InputTab>('manual')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)

  const [form, setForm] = useState({
    name: '', age: '', gender: '여', job: '', phone: '', grade: '일반',
    company: '', product_name: '', monthly_fee: '', payment_status: '유지',
    payment_rate: '', payment_total: '', payment_done: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleManualSave() {
    if (!form.name || !form.company) return alert('고객명과 보험사는 필수예요!')
    setSaving(true)
    try {
      const { data: cust } = await supabase.from('dpa_customers').insert({
        name: form.name, age: parseInt(form.age) || null,
        gender: form.gender, job: form.job, phone: form.phone, grade: form.grade,
      }).select().single()

      if (cust) {
        await supabase.from('dpa_contracts').insert({
          customer_id: cust.id,
          company: form.company, product_name: form.product_name,
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

  if (done) return (
    <div className={styles.doneWrap}>
      <div className={styles.doneIcon}>✅</div>
      <div className={styles.doneText}>저장 완료!</div>
      <div className={styles.doneActions}>
        <a href="/customers" className={styles.btnPrimary}>고객 목록 보기</a>
        <button className={styles.btnSecondary} onClick={() => { setDone(false); setForm({ name:'',age:'',gender:'여',job:'',phone:'',grade:'일반',company:'',product_name:'',monthly_fee:'',payment_status:'유지',payment_rate:'',payment_total:'',payment_done:'' }); setParsed(null); setPasteText('') }}>
          추가 입력
        </button>
      </div>
    </div>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        {(['manual', 'paste', 'capture'] as InputTab[]).map(t => (
          <button key={t} className={[styles.tab, inputTab === t ? styles.activeTab : ''].join(' ')} onClick={() => setInputTab(t)}>
            {t === 'manual' ? '✏️ 수동 입력' : t === 'paste' ? '📋 텍스트 붙여넣기' : '📱 캡처 (준비중)'}
          </button>
        ))}
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
              <label>나이</label>
              <input type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="45" />
            </div>
            <div className={styles.field}>
              <label>성별</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option>여</option><option>남</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>직업</label>
              <input value={form.job} onChange={e => set('job', e.target.value)} placeholder="직장인" />
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
          </div>

          <div className={styles.formSection}>보험 계약 정보</div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>보험사 *</label>
              <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="한화생명" />
            </div>
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
              <label>납입률 (%)</label>
              <input type="number" value={form.payment_rate} onChange={e => set('payment_rate', e.target.value)} placeholder="91" />
            </div>
            <div className={styles.field}>
              <label>총 납입 회차</label>
              <input type="number" value={form.payment_total} onChange={e => set('payment_total', e.target.value)} placeholder="120" />
            </div>
            <div className={styles.field}>
              <label>완료 회차</label>
              <input type="number" value={form.payment_done} onChange={e => set('payment_done', e.target.value)} placeholder="109" />
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
            보험사 앱에서 보장 내역 텍스트를 마우스로 긁어서 아래에 붙여넣으세요!
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
          <div className={styles.captureSub}>Alt+Q로 실행되는 스캔 런처가 곧 추가됩니다</div>
        </div>
      )}
    </div>
  )
}
