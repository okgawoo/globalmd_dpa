import { useRouter } from 'next/router'
import { Wallet, Users, FileText, CreditCard, ArrowRight, UserCheck, Star } from 'lucide-react'

interface Props {
  customers: any[]
  contracts: any[]
  meetings: any[]
  agentName: string
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
      className="rounded-lg p-5 transition-all duration-100"
      style={{
        background: 'hsl(var(--bg-panel))',
        border: '1px solid hsl(var(--border-default))',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'hsl(var(--border-hover))'
          el.style.background = 'hsl(var(--bg-elevated))'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'hsl(var(--border-default))'
          el.style.background = 'hsl(var(--bg-panel))'
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium mb-1" style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(var(--text-primary))' }}>
            {value}
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: 'hsl(var(--text-tertiary))' }}>
            {sub}
          </p>
        </div>
        <div
          className="ml-4 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          style={{
            background: 'hsl(var(--accent-bg))',
            border: '1px solid hsl(var(--accent) / 0.2)',
          }}
        >
          <Icon className="h-4 w-4" style={{ color: 'hsl(var(--accent))' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Section Card wrapper ── */
function SectionCard({
  title, sub, onViewAll, children,
}: {
  title: string
  sub?: string
  onViewAll?: () => void
  children: ReactNode
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'hsl(var(--bg-panel))',
        border: '1px solid hsl(var(--border-default))',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid hsl(var(--border-default))' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>
            {title}
          </h2>
          {sub && (
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
              {sub}
            </p>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs transition-all duration-100"
            style={{ color: 'hsl(var(--text-tertiary))' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--accent))' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--text-tertiary))' }}
          >
            전체보기 <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

import { ReactNode } from 'react'

export default function AdminDashboard({
  customers, contracts, meetings, agentName,
  meetingStats, smsStats,
  nearDoneCustomers, birthdayCustomers, gapCustomers,
  expiryCustomers, anniversaryCustomers, noContactCustomers,
  totalMonthly, newThisMonth,
}: Props) {
  const router = useRouter()

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
    { label: '생일 임박', count: birthdayCustomers.length, sort: '생일임박' },
    { label: '완납 임박', count: nearDoneCustomers.length, sort: '완납임박' },
    { label: '보장 공백', count: gapCustomers.length, sort: '보장공백' },
    { label: '만기 임박', count: expiryCustomers.length, sort: '만기임박' },
    { label: '계약 기념일', count: anniversaryCustomers.length, sort: '계약기념일' },
    { label: '장기 미연락', count: noContactCustomers.length, sort: '장기미연락' },
  ]

  const recentCustomers = [...customers]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  const meetingCols = [
    { label: '예정', value: meetingStats.scheduled },
    { label: '대기', value: meetingStats.waiting },
    { label: '완료', value: meetingStats.done },
    { label: '취소', value: meetingStats.cancelled },
  ]

  return (
    <div className="px-6 pb-8 pt-5" style={{ background: 'hsl(var(--bg-app))' }}>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
          대시보드
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
          안녕하세요, {agentName}님
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <StatCard
          title="총 고객"
          value={String(customers.length)}
          sub={`마이 ${myCustomers}명 · 관심 ${prospectCustomers}명`}
          icon={Users}
          onClick={() => router.push('/customers')}
        />
        <StatCard
          title="마이고객"
          value={String(myCustomers)}
          sub="계약 완료 고객"
          icon={UserCheck}
          onClick={() => router.push('/customers?type=existing')}
        />
        <StatCard
          title="관심고객"
          value={String(prospectCustomers)}
          sub="예비 가입 고객"
          icon={Star}
          onClick={() => router.push('/customers?type=prospect')}
        />
        <StatCard
          title="이번달 신규"
          value={String(newThisMonth)}
          sub="신규 등록 고객"
          icon={Wallet}
          onClick={() => router.push('/customers')}
        />
        <StatCard
          title="보험 계약"
          value={String(contracts.length)}
          sub="전체 계약 건수"
          icon={FileText}
          onClick={() => router.push('/customers')}
        />
        <StatCard
          title="월납입 합계"
          value={fmt(totalMonthly)}
          sub="전체 고객 기준"
          icon={CreditCard}
        />
      </div>

      {/* Middle */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">

        {/* 오늘의 할일 */}
        <SectionCard
          title="오늘의 할일"
          sub="액션이 필요한 고객"
          onViewAll={() => router.push('/customers')}
        >
          {issues.map(({ label, count, sort }, i) => (
            <div
              key={sort}
              onClick={count > 0 ? () => router.push(`/customers?sort=${sort}`) : undefined}
              className="flex items-center justify-between px-5 py-3 text-sm transition-all duration-100"
              style={{
                borderBottom: i < issues.length - 1 ? '1px solid hsl(var(--border-default))' : undefined,
                cursor: count > 0 ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (count > 0) {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.background = 'hsl(var(--bg-elevated))'
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.background = 'transparent'
              }}
            >
              <span
                style={{
                  color: count === 0 ? 'hsl(var(--text-tertiary))' : 'hsl(var(--text-primary))',
                  fontWeight: count > 0 ? 510 : 400,
                }}
              >
                {label}
              </span>
              <span
                className="tabular-nums text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  background: count > 0 ? 'hsl(var(--accent-bg))' : 'hsl(var(--bg-elevated))',
                  color: count > 0 ? 'hsl(var(--accent))' : 'hsl(var(--text-tertiary))',
                  border: count > 0 ? '1px solid hsl(var(--accent) / 0.2)' : '1px solid hsl(var(--border-default))',
                }}
              >
                {count}명
              </span>
            </div>
          ))}
        </SectionCard>

        {/* Right col */}
        <div className="flex flex-col gap-4">

          {/* 이번달 미팅 */}
          <SectionCard
            title="이번달 미팅"
            onViewAll={() => router.push('/sales?tab=meeting')}
          >
            <div className="grid grid-cols-4">
              {meetingCols.map(({ label, value }, i) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-4"
                  style={{
                    borderRight: i < meetingCols.length - 1 ? '1px solid hsl(var(--border-default))' : undefined,
                  }}
                >
                  <p className="text-xl font-bold tabular-nums" style={{ color: 'hsl(var(--text-primary))' }}>
                    {value}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 오늘 영업일정 */}
          <SectionCard
            title="오늘 영업일정"
            onViewAll={() => router.push('/sales?tab=meeting&sub=today')}
          >
            {todayMeetings.length === 0 ? (
              <p className="px-5 py-4 text-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>
                오늘 미팅 없음
              </p>
            ) : (
              todayMeetings.slice(0, 4).map((m: any, i: number) => {
                const cust = customers.find((c: any) => c.id === m.customer_id)
                const badge = cust?.customer_type === 'prospect' ? '관심' : '마이'
                return (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/sales?tab=meeting&sub=today&meetingId=${m.id}`)}
                    className="flex items-center justify-between px-5 py-3 text-sm cursor-pointer transition-all duration-100"
                    style={{
                      borderBottom: i < todayMeetings.length - 1 ? '1px solid hsl(var(--border-default))' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.background = 'hsl(var(--bg-elevated))'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.background = 'transparent'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 510 }}>
                        {cust?.name ?? '이름 없음'}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{
                          background: 'hsl(var(--bg-elevated))',
                          color: 'hsl(var(--text-tertiary))',
                          border: '1px solid hsl(var(--border-default))',
                        }}
                      >
                        {badge}
                      </span>
                    </div>
                    <span className="tabular-nums text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      {m.meeting_time ?? '시간 미정'}
                    </span>
                  </div>
                )
              })
            )}
          </SectionCard>
        </div>
      </div>

      {/* 최근 등록 고객 */}
      <div className="mt-4">
        <SectionCard
          title="최근 등록 고객"
          sub={`총 ${customers.length}명`}
          onViewAll={() => router.push('/customers')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border-default))' }}>
                  {['이름', '구분', '성별', '계약수', '등록일'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'hsl(var(--text-tertiary))' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((c: any, i: number) => {
                  const custContracts = contracts.filter((ct: any) => ct.customer_id === c.id)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers?id=${c.id}`)}
                      className="cursor-pointer transition-all duration-100"
                      style={{
                        borderBottom: i < recentCustomers.length - 1 ? '1px solid hsl(var(--border-default))' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLTableRowElement
                        el.style.background = 'hsl(var(--bg-elevated))'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLTableRowElement
                        el.style.background = 'transparent'
                      }}
                    >
                      <td className="px-5 py-3" style={{ color: 'hsl(var(--text-primary))', fontWeight: 510 }}>
                        {c.name}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{
                            background: 'hsl(var(--bg-elevated))',
                            color: 'hsl(var(--text-secondary))',
                            border: '1px solid hsl(var(--border-default))',
                          }}
                        >
                          {c.customer_type === 'prospect' ? '관심고객' : '마이고객'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>
                        {c.gender ?? '-'}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>
                        {custContracts.length}건
                      </td>
                      <td className="px-5 py-3 tabular-nums text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
                        {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
