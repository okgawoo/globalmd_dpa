import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { Wallet, Users, FileText, CreditCard, ArrowRight, UserCheck, Star, UserPlus, CalendarPlus, MessageSquare, TrendingUp, ClipboardList, Bot } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAdmin } from '../lib/AdminContext'

interface Props {
  customers: any[]
  contracts: any[]
  meetings: any[]
  agentName: string
  agentRole?: string
  meetingStats: { done: number; scheduled: number; waiting: number; cancelled: number }
  smsStats: { total: number; success: number; failed: number }
  nearDoneCustomers: any[]
  birthdayCustomers: any[]
  gapCustomers: any[]
  expiryCustomers: any[]
  anniversaryCustomers: any[]
  noContactCustomers: any[]
  totalMonthly: number
  newThisMonth: number
}

/* ── Stat Card ── */
function StatCard({
  title, value, sub, icon: Icon, onClick,
}: {
  title: string
  value: string
  sub: string
  icon: any
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.1s',
        minWidth: 0,
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = '#C0C7D1'
          el.style.background = '#EFEFF1'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = '#E5E7EB'
          el.style.background = '#FFFFFF'
        }
      }}
    >
      {/* 상단 행: 아이콘 + 제목 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            height: 28,
            width: 28,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: '#ECEDF8',
            border: '1px solid rgba(94,106,210,0.2)',
          }}
        >
          <Icon style={{ width: 14, height: 14, color: '#5E6AD2' }} />
        </div>
        <p style={{ fontSize: 12, color: '#636B78', fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
      </div>
      {/* 하단 행: 값 + 서브 */}
      <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontVariantNumeric: 'tabular-nums', margin: '0 0 2px', whiteSpace: 'nowrap' }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: '#8892A0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sub}
      </p>
    </div>
  )
}

/* ── Section Card wrapper ── */
function SectionCard({
  title, sub, onViewAll, children, scrollable,
  style: extraStyle,
}: {
  title: string
  sub?: string
  onViewAll?: () => void
  children: ReactNode
  scrollable?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...extraStyle,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          flexShrink: 0,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', margin: 0 }}>
            {title}
          </h2>
          {sub && (
            <p style={{ fontSize: 12, marginTop: 2, color: '#8892A0', margin: '2px 0 0' }}>
              {sub}
            </p>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: '#8892A0',
              transition: 'color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#5E6AD2' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8892A0' }}
          >
            전체보기 <ArrowRight style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>
      {scrollable ? (
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      ) : children}
    </div>
  )
}

export default function AdminDashboard({
  customers, contracts, meetings, agentName,
  meetingStats, smsStats,
  nearDoneCustomers, birthdayCustomers, gapCustomers,
  expiryCustomers, anniversaryCustomers, noContactCustomers,
  totalMonthly, newThisMonth,
}: Props) {
  const router = useRouter()
  const { isAdmin } = useAdmin()
  const [narrowTable, setNarrowTable] = useState(false)
  useEffect(() => {
    const check = () => setNarrowTable(window.innerWidth <= 1300)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const myCustomers = customers.filter((c: any) => c.customer_type === 'existing').length
  const prospectCustomers = customers.filter((c: any) => c.customer_type === 'prospect').length
  const todayStr = new Date().toISOString().split('T')[0]
  const todayMeetings = meetings.filter((m: any) => (m.meeting_date ?? '').split('T')[0] === todayStr)

  const fmt = (val: number) => {
    if (val >= 100000000) return `${(val / 100000000).toFixed(1)}억원`
    if (val >= 10000) return `${Math.floor(val / 10000).toLocaleString()}만원`
    return `${val.toLocaleString()}원`
  }

  const issues = [
    { label: '완납 임박', count: nearDoneCustomers.length, sort: '완납임박' },
    { label: '보장 공백', count: gapCustomers.length, sort: '보장공백' },
    { label: '생일 임박', count: birthdayCustomers.length, sort: '생일임박' },
    { label: '만기 임박', count: expiryCustomers.length, sort: '만기임박' },
    { label: '장기 미연락', count: noContactCustomers.length, sort: '장기미연락' },
    { label: '계약 기념일', count: anniversaryCustomers.length, sort: '계약기념일' },
  ]

  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const count = customers.filter((c: any) => {
        const cd = new Date(c.created_at)
        return cd.getFullYear() === y && cd.getMonth() === m
      }).length
      return { label: `${m + 1}월`, count }
    })
  }, [customers])

  const recentCustomers = [...customers]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const meetingCols = [
    { label: '예정', value: meetingStats.scheduled },
    { label: '대기', value: meetingStats.waiting },
    { label: '완료', value: meetingStats.done },
    { label: '취소', value: meetingStats.cancelled },
  ]

  return (
    <div style={{ padding: '20px 24px 32px', background: '#F7F8FA', minHeight: '100%' }}>

      {/* Page title */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
            대시보드
          </h1>
          <p style={{ marginTop: 2, fontSize: 14, color: '#636B78', margin: '2px 0 0' }}>
            안녕하세요, {agentName} {isAdmin ? '대표님' : '설계사님'}
          </p>
        </div>
        <span style={{ fontSize: 14, color: '#1A1A2E' }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        <StatCard title="총 고객" value={String(customers.length)} sub={`마이 ${myCustomers}명 · 관심 ${prospectCustomers}명`} icon={Users} />
        <StatCard title="마이고객" value={String(myCustomers)} sub="계약 완료 고객" icon={UserCheck} onClick={() => router.push('/customers?tab=existing')} />
        <StatCard title="관심고객" value={String(prospectCustomers)} sub="예비 가입 고객" icon={Star} onClick={() => router.push('/customers?tab=prospect')} />
        <StatCard title="이번달 신규" value={String(newThisMonth)} sub="신규 등록 고객" icon={Wallet} onClick={() => router.push('/customers?sort=이번달신규')} />
        <StatCard title="보험 계약" value={String(contracts.length)} sub="전체 계약 건수" icon={FileText} />
        <StatCard title="월납입 합계" value={fmt(totalMonthly)} sub="전체 고객 기준" icon={CreditCard} />
      </div>

      {/* Middle row */}
      <div style={{ marginTop: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>

        {/* 오늘의 할일 */}
        <SectionCard title="오늘의 할일" sub="액션이 필요한 고객">
          <div style={{ paddingTop: 4, paddingBottom: 4 }}>
            {issues.map(({ label, count, sort }, i) => (
              <div key={sort}>
                {i > 0 && <div style={{ height: 1, background: '#E5E7EB', margin: '0 12px' }} />}
                <div
                  onClick={count > 0 ? () => router.push(`/customers?sort=${sort}`) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '0 8px',
                    padding: '10px 12px',
                    fontSize: 14,
                    transition: 'all 0.15s',
                    borderRadius: 6,
                    cursor: count > 0 ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (count > 0) (e.currentTarget as HTMLDivElement).style.background = '#EFEFF1'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ color: count === 0 ? '#8892A0' : '#1A1A2E', fontWeight: count > 0 ? 510 : 400 }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: count > 0 ? '#ECEDF8' : '#EFEFF1',
                      color: count > 0 ? '#5E6AD2' : '#8892A0',
                      border: count > 0 ? '1px solid rgba(94,106,210,0.2)' : '1px solid #E5E7EB',
                    }}
                  >
                    {count}명
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Middle right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

          {/* 이번달 고객 상담 */}
          <SectionCard title={`${new Date().getMonth() + 1}월 고객 상담`} sub="이번 달 상담 현황" onViewAll={() => router.push('/consultations')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {meetingCols.map(({ label, value }, i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 0',
                    borderRight: i < meetingCols.length - 1 ? '1px solid #E5E7EB' : undefined,
                  }}
                >
                  <p style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1A1A2E', margin: 0 }}>{value}</p>
                  <p style={{ marginTop: 4, fontSize: 12, color: '#8892A0', margin: '4px 0 0' }}>{label}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 영업일정 */}
          <SectionCard title="영업일정" scrollable style={{ flex: 1 }}>
            {todayMeetings.length === 0 ? (
              <p style={{ padding: '16px 20px', fontSize: 14, color: '#8892A0' }}>오늘 미팅 없음</p>
            ) : (
              todayMeetings.map((m: any) => {
                const cust = customers.find((c: any) => c.id === m.customer_id)
                const badge = cust?.customer_type === 'prospect' ? '관심' : '마이'
                return (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/sales?tab=meeting&sub=today&meetingId=${m.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '0 8px',
                      padding: '10px 12px',
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      borderRadius: 6,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#EFEFF1' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#1A1A2E', fontWeight: 510 }}>{cust?.name ?? '이름 없음'}</span>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#EFEFF1', color: '#8892A0', border: '1px solid #E5E7EB' }}>
                        {badge}
                      </span>
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#8892A0' }}>{m.meeting_time ?? '시간 미정'}</span>
                  </div>
                )
              })
            )}
          </SectionCard>
        </div>

        {/* 월별 신규 고객 */}
        <SectionCard title="월별 신규 고객" sub="최근 6개월 등록 현황">
          <div style={{ padding: '16px 16px 8px', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barSize={22} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8892A0' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#8892A0' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#EFEFF1' }}
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, color: '#1A1A2E' }}
                  formatter={(v: any) => [String(v), '명']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell key={i} fill={i === monthlyData.length - 1 ? '#5E6AD2' : 'rgba(94,106,210,0.35)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '0 20px 16px' }}>
            <p style={{ fontSize: 12, color: '#8892A0', margin: 0 }}>
              이번 달 신규 <span style={{ color: '#5E6AD2', fontWeight: 600 }}>{monthlyData[monthlyData.length - 1]?.count ?? 0}명</span>
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div style={{ marginTop: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>

        {/* 최근 등록 고객 */}
        <div style={{ gridColumn: 'span 2' }}>
          <SectionCard title="최근 등록 고객" sub={`총 ${customers.length}명`} onViewAll={() => router.push('/customers')}>
            <div className="thin-scroll" style={{ maxHeight: 300, overflowY: 'auto', padding: '0 8px' }}>
              <table style={{ width: '100%', fontSize: 14, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: narrowTable ? '22%' : '16%' }} />
                  <col style={{ width: narrowTable ? '16%' : '13%' }} />
                  <col style={{ width: narrowTable ? '10%' : '9%' }} />
                  <col style={{ width: narrowTable ? '26%' : '18%' }} />
                  <col style={{ width: narrowTable ? '14%' : '10%' }} />
                  {!narrowTable && <><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /></>}
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--admin-header-bg, #FFFFFF)' }}>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['이름', '구분', '성별', '연락처', '나이'].map((h) => (
                      <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8892A0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    {!narrowTable && ['계약수', '등록일'].map((h) => (
                      <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8892A0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCustomers.map((c: any) => {
                    const custContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/customers?id=${c.id}`)}
                        style={{ borderBottom: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#EFEFF1' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 8px', color: '#1A1A2E', fontWeight: 510 }}>{c.name}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#EFEFF1', color: '#636B78', border: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                            {c.customer_type === 'prospect' ? '관심고객' : '마이고객'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: 14, color: '#636B78' }}>{c.gender ?? '-'}</td>
                        <td style={{ padding: '12px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#636B78' }}>{c.phone ?? '-'}</td>
                        <td style={{ padding: '12px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#636B78' }}>
                          {(() => {
                            if (c.birth_date) {
                              const today = new Date(); const birth = new Date(c.birth_date)
                              let age = today.getFullYear() - birth.getFullYear()
                              const mo = today.getMonth() - birth.getMonth()
                              if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--
                              return `${age}세`
                            }
                            return c.age ? `${c.age}세` : '-'
                          })()}
                        </td>
                        {!narrowTable && <>
                          <td style={{ padding: '12px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#636B78' }}>{custContracts.length}건</td>
                          <td style={{ padding: '12px 8px', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: '#8892A0' }}>
                            {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </td>
                        </>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* 빠른 액션 */}
        <SectionCard title="퀵 액션" sub="자주 쓰는 메뉴" style={{ height: '100%' }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 10, gridAutoRows: '1fr' }}>
            {[
              { label: '새 고객 등록', icon: UserPlus, href: '/input' },
              { label: '상담 일정', icon: CalendarPlus, href: '/consultations' },
              { label: '문자 발송', icon: MessageSquare, href: '/notifications' },
              { label: '영업 관리', icon: TrendingUp, href: '/sales' },
              { label: '데이터 입력', icon: ClipboardList, href: '/input' },
              { label: 'AI 고객리포트', icon: Bot, href: '/report' },
            ].map(({ label, icon: Icon, href }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  borderRadius: 8,
                  padding: '8px 4px',
                  background: '#F7F8FA',
                  border: '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ECEDF8'; e.currentTarget.style.borderColor = 'rgba(94,106,210,0.3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.borderColor = '#E5E7EB' }}
              >
                <div style={{ display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#ECEDF8', border: '1px solid rgba(94,106,210,0.2)' }}>
                  <Icon style={{ width: 22, height: 22, color: '#5E6AD2' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.3, color: '#1A1A2E' }}>{label}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 72 }}>
        <span style={{ fontSize: 12, color: '#636B78' }}>
          © 2026 iPlanner · GlobalMD Inc. All rights reserved.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {['이용약관', '개인정보처리방침', '고객센터'].map((item) => (
            <button
              key={item}
              style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#636B78', padding: 0, transition: 'color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#1A1A2E' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#636B78' }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
