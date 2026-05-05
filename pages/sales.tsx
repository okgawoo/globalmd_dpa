import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Sales.module.css'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts'

export default function Sales() {
  const [contracts, setContracts] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('dpa_agents').select('id').eq('user_id', data.user.id).single().then(({ data: agent }) => {
        if (agent) fetchData(agent.id)
      })
    })
    const saved = localStorage.getItem('monthly_goal')
    if (saved) setMonthlyGoal(parseInt(saved))
  }, [])

  async function fetchData(aId: string) {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
    const [{ data: contractData }, { data: msgData }, { data: custData }] = await Promise.all([
      supabase.from('dpa_contracts').select('*').eq('agent_id', aId),
      supabase.from('dpa_messages').select('id, sent_at, created_at, message_type').eq('agent_id', aId).gte('sent_at', sixMonthsAgo),
      supabase.from('dpa_customers').select('id, created_at').eq('agent_id', aId).gte('created_at', sixMonthsAgo),
    ])
    setContracts(contractData || [])
    setMessages(msgData || [])
    setCustomers(custData || [])
    setLoading(false)
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thisMonthContracts = contracts.filter(c => c.created_at >= thisMonthStart)
  const thisMonthFee = thisMonthContracts.reduce((sum, c) => sum + (c.monthly_fee || 0), 0)
  const totalFee = contracts.reduce((sum, c) => sum + (c.monthly_fee || 0), 0)
  const uniqueCustomers = new Set(contracts.map(c => c.customer_id)).size

  // 최근 6개월 공통 라벨 생성
  const last6MonthsMeta = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const nd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1)
    return { label: `${d.getMonth() + 1}월`, from: d.toISOString(), to: nd.toISOString() }
  })

  // 계약 차트 데이터
  const last6Months = last6MonthsMeta.map(({ label, from, to }) => ({
    label,
    count: contracts.filter(c => c.created_at >= from && c.created_at < to).length,
  }))

  // 발송 차트 데이터 (문자/카톡 구분)
  const last6MonthsMessages = last6MonthsMeta.map(({ label, from, to }) => {
    const inRange = messages.filter(m => {
      const t = m.sent_at || m.created_at
      return t >= from && t < to
    })
    const kakao = inRange.filter(m => m.message_type === 'kakao').length
    const sms = inRange.length - kakao
    return { label, sms, kakao, total: inRange.length }
  })

  // 신규 고객 차트 데이터
  const last6MonthsCustomers = last6MonthsMeta.map(({ label, from, to }) => ({
    label,
    count: customers.filter(c => c.created_at >= from && c.created_at < to).length,
  }))

  const typeBreakdown: Record<string, { count: number; fee: number }> = {}
  contracts.forEach(c => {
    const t = c.insurance_type || '기타'
    if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, fee: 0 }
    typeBreakdown[t].count++
    typeBreakdown[t].fee += c.monthly_fee || 0
  })
  const typeData = Object.entries(typeBreakdown)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.count - a.count)

  const goalProgress = monthlyGoal > 0 ? Math.min(Math.round((thisMonthContracts.length / monthlyGoal) * 100), 100) : 0

  function saveGoal() {
    const val = parseInt(goalInput)
    if (!isNaN(val) && val > 0) {
      setMonthlyGoal(val)
      localStorage.setItem('monthly_goal', val.toString())
    }
    setEditingGoal(false)
  }

  const card = (i: number, label: string, value: string, sub: string, color = '#5E6AD2') => (
    <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 12, color: '#636B78', fontWeight: 500, margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: '0 0 2px', whiteSpace: 'nowrap' }}>{value}</p>
      <p style={{ fontSize: 11, color: '#8892A0', margin: 0 }}>{sub}</p>
    </div>
  )

  // 공통 바차트 렌더러
  const miniBarChart = (
    data: { label: string; count: number }[],
    currentFill: string,
    otherFill: string,
    tooltipLabel: string,
    unit: string
  ) => (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip formatter={(v: any) => [`${v}${unit}`, tooltipLabel]} cursor={{ fill: 'rgba(94,106,210,0.06)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 5 ? currentFill : otherFill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  if (loading) return <div style={{ padding: 60, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>로딩 중...</div>

  const thisMonthMessages = messages.filter(m => {
    const t = m.sent_at || m.created_at
    return t >= thisMonthStart
  }).length
  const thisMonthCustomers = customers.filter(c => c.created_at >= thisMonthStart).length

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px', lineHeight: 1.3 }}>영업 관리</h1>
          <p style={{ fontSize: 14, color: '#636B78', margin: '2px 0 0' }}>
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 기준
          </p>
        </div>
      </div>

      {/* KPI 카드 4개 */}
      <div id="tour-sales-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {card(0, '이번달 계약', `${thisMonthContracts.length}건`, `전체 ${contracts.length}건`, '#5E6AD2')}
        {card(1, '이번달 월보험료', `${Math.round(thisMonthFee / 10000)}만원`, `전체 ${Math.round(totalFee / 10000)}만원`, '#0D9488')}
        {card(2, '계약 보유 고객', `${uniqueCustomers}명`, `전체 계약 ${contracts.length}건`, '#1A1A2E')}
        {card(3, '취급 보험 종류', `${typeData.length}종`, `월평균 ${Math.round(totalFee / 10000 / Math.max(last6Months.filter(m => m.count > 0).length, 1))}만원`, '#1A1A2E')}
      </div>

      {/* Row 1 — 계약 그래프 + 목표 */}
      <div id="tour-sales-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 월별 계약 그래프 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: '0 0 16px' }}>최근 6개월 계약 현황</p>
          {miniBarChart(last6Months, '#5E6AD2', '#C7C9F0', '계약 수', '건')}
        </div>

        {/* 목표 관리 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>이번달 목표</p>
            <button
              onClick={() => { setGoalInput(monthlyGoal.toString()); setEditingGoal(true) }}
              style={{ fontSize: 12, color: '#5E6AD2', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              {monthlyGoal > 0 ? '수정' : '+ 목표 설정'}
            </button>
          </div>

          {editingGoal ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="목표 계약 건수"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveGoal()}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={saveGoal} style={{ padding: '8px 14px', background: '#5E6AD2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
              <button onClick={() => setEditingGoal(false)} style={{ padding: '8px 10px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
            </div>
          ) : monthlyGoal > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#636B78' }}>{thisMonthContracts.length}건 / {monthlyGoal}건</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: goalProgress >= 100 ? '#10B981' : '#5E6AD2' }}>{goalProgress}%</span>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${goalProgress}%`, height: '100%', background: goalProgress >= 100 ? '#10B981' : '#5E6AD2', borderRadius: 999, transition: 'width 0.5s ease' }} />
              </div>
              <p style={{ fontSize: 12, color: '#8892A0', margin: '10px 0 0' }}>
                {goalProgress >= 100 ? '🎉 이번달 목표 달성!' : `목표까지 ${monthlyGoal - thisMonthContracts.length}건 남았어요`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 4px' }}>이번달 월보험료</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{Math.round(thisMonthFee / 10000)}만원</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 4px' }}>건당 평균</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
                    {thisMonthContracts.length > 0 ? `${Math.round(thisMonthFee / thisMonthContracts.length / 1000) / 10}만원` : '-'}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 4px' }}>달성률</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: goalProgress >= 100 ? '#10B981' : '#5E6AD2', margin: 0 }}>{goalProgress}%</p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#8892A0', margin: 0 }}>이번달 목표를 설정해보세요</p>
              <button
                onClick={() => { setGoalInput(''); setEditingGoal(true) }}
                style={{ fontSize: 13, color: '#5E6AD2', background: 'rgba(94,106,210,0.08)', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
              >
                + 목표 설정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — 발송 + 신규고객 차트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 문자/카톡 구분 발송 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>월별 발송 현황</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#636B78' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#5E6AD2', display: 'inline-block' }} />문자
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#636B78' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FACC15', display: 'inline-block' }} />카톡
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>이번달 합계</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{thisMonthMessages}건</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>문자</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#5E6AD2', margin: 0 }}>
                {messages.filter(m => { const t = m.sent_at || m.created_at; return t >= thisMonthStart && m.message_type !== 'kakao' }).length}건
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>카톡</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#CA8A04', margin: 0 }}>
                {messages.filter(m => { const t = m.sent_at || m.created_at; return t >= thisMonthStart && m.message_type === 'kakao' }).length}건
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={last6MonthsMessages} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: any, n: any) => [`${v}건`, n === 'sms' ? '문자' : '카톡']} cursor={{ fill: 'rgba(94,106,210,0.06)' }} />
              <Bar dataKey="sms" stackId="a" fill="#5E6AD2" radius={[0, 0, 0, 0]} />
              <Bar dataKey="kakao" stackId="a" fill="#FACC15" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 신규 고객 꺾은선 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>신규 고객 추이</p>
            <span style={{ fontSize: 12, color: '#8892A0' }}>최근 6개월</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>이번달 신규</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{thisMonthCustomers}명</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>6개월 합계</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{customers.length}명</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={last6MonthsCustomers} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.10)' : '#F3F4F6'} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8892A0' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [`${v}명`, '신규 고객']} cursor={{ stroke: '#E5E7EB' }} />
              <Line type="monotone" dataKey="count" stroke="#5E6AD2" strokeWidth={2} dot={{ fill: '#5E6AD2', r: 4 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 보험 종류별 현황 */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, minHeight: 160 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: '0 0 16px' }}>보험 종류별 계약 현황</p>
        {typeData.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8892A0', textAlign: 'center', padding: '24px 0' }}>계약 데이터가 없어요</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.min(typeData.length * 36 + 20, 280)}>
            <BarChart layout="vertical" data={typeData} margin={{ left: 80, right: 80, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#636B78' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={(v: any, n: any) => [n === 'count' ? `${v}건` : `${Math.round((v as number) / 10000)}만원`, n === 'count' ? '계약 수' : '월보험료']} />
              <Bar dataKey="count" fill="#5E6AD2" radius={[0, 4, 4, 0]}
                label={{ position: 'right', fontSize: 11, fill: '#636B78', formatter: (v: any) => `${v}건` }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
