function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function calcChange(cur: number, prev: number) {
  if (!prev || prev === 0) return undefined
  return ((cur - prev) / Math.abs(prev)) * 100
}

// 2주 비교 카드
function ComparisonCard({
  label,
  current,
  prev,
  formatter,
  highlight = 'neutral',
}: {
  label: string
  current: string
  prev: string
  formatter?: { change?: number }
  highlight?: 'positive' | 'negative' | 'neutral'
}) {
  const change = formatter?.change
  const valueColor =
    highlight === 'positive'
      ? 'text-[#1a5c3a]'
      : highlight === 'negative'
      ? 'text-red-500'
      : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-xl font-bold tracking-tight ${valueColor}`}>{current}</p>
        {change !== undefined && (
          <span className={`text-xs font-medium ${change >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'}`}>
            {change >= 0 ? '▲' : '▼'}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400">전주 {prev}</p>
    </div>
  )
}

interface Props {
  income: number
  expense: number
  profit: number
  aov: number
  orderCount: number
  hasExpenseData: boolean
  weekStart: string
  weekEnd: string
  prev?: {
    income: number
    expense: number
    profit: number
    aov: number
    orderCount: number
    hasExpenseData: boolean
  }
  isPartial?: boolean
}

export default function WeeklyKPICards({
  income,
  expense,
  profit,
  aov,
  orderCount,
  hasExpenseData,
  prev,
  isPartial,
}: Props) {
  return (
    <>
      {/* 부분주 안내는 WeeklyInsightBanner로 끌어올렸음 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <ComparisonCard
          label="매출"
          current={income > 0 ? fmt(income) : '—'}
          prev={prev ? fmt(prev.income) : '—'}
          formatter={{ change: prev ? calcChange(income, prev.income) : undefined }}
        />
        <ComparisonCard
          label="지출"
          current={hasExpenseData ? fmt(expense) : '—'}
          prev={prev?.hasExpenseData ? fmt(prev.expense) : '—'}
          formatter={{
            change:
              prev?.hasExpenseData && hasExpenseData
                ? calcChange(expense, prev.expense)
                : undefined,
          }}
          highlight="negative"
        />
        <ComparisonCard
          label="손익"
          current={hasExpenseData ? fmt(profit) : '—'}
          prev={prev?.hasExpenseData ? fmt(prev.profit) : '—'}
          highlight={profit >= 0 ? 'positive' : 'negative'}
        />
        <ComparisonCard
          label="객단가"
          current={aov > 0 ? `${aov.toLocaleString()}원` : '—'}
          prev={prev && prev.aov > 0 ? `${prev.aov.toLocaleString()}원` : '—'}
          formatter={{ change: prev ? calcChange(aov, prev.aov) : undefined }}
        />
        <ComparisonCard
          label="주문 건수"
          current={orderCount > 0 ? `${orderCount.toLocaleString()}건` : '—'}
          prev={prev && prev.orderCount > 0 ? `${prev.orderCount.toLocaleString()}건` : '—'}
          formatter={{ change: prev ? calcChange(orderCount, prev.orderCount) : undefined }}
        />
      </div>
    </>
  )
}
