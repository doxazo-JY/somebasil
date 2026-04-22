import StatCard from '@/components/ui/StatCard'

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피&슈페너',
  drip_coffee: '드립커피',
  dutch_coffee: '더치커피',
  matcha: '말차',
  ade: '에이드',
  tea: '티',
  beverage: '음료',
  dessert: '디저트',
  season: '시즌',
  etc: '기타',
}

function formatManwon(amount: number) {
  return `${Math.round(amount / 10000)}만`
}

function calcChange(current: number, prev: number) {
  if (prev === 0) return undefined
  return ((current - prev) / Math.abs(prev)) * 100
}

interface IncomeStatCardsProps {
  income: number
  prevIncome: number
  topCategory: string | null
  aov: number
  prevAov: number
  orderCount: number
  isPartial?: boolean
  maxDay?: number
}

export default function IncomeStatCards({
  income,
  prevIncome,
  topCategory,
  aov,
  prevAov,
  orderCount,
  isPartial,
  maxDay,
}: IncomeStatCardsProps) {
  const change = calcChange(income, prevIncome)
  const aovChange = calcChange(aov, prevAov)

  const compareLabel = isPartial ? '전월 동기간比' : '전월 比'
  const compareSub = isPartial && maxDay
    ? `전월 1~${maxDay}일 ${prevIncome > 0 ? formatManwon(prevIncome) : '—'}`
    : prevIncome > 0 ? `전월 ${formatManwon(prevIncome)}` : undefined

  const incomeLabel = isPartial && maxDay ? `이번 달 매출 (1~${maxDay}일)` : '월 매출'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label={incomeLabel}
        value={income > 0 ? formatManwon(income) : '—'}
        highlight="neutral"
      />
      <StatCard
        label={compareLabel}
        value={change !== undefined ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%` : '—'}
        subLabel={compareSub}
        highlight={change === undefined ? 'neutral' : change >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="객단가"
        value={aov > 0 ? `${aov.toLocaleString()}원` : '—'}
        subLabel={
          orderCount > 0
            ? `주문 ${orderCount.toLocaleString()}건${
                aovChange !== undefined
                  ? ` · ${aovChange >= 0 ? '▲' : '▼'} ${Math.abs(aovChange).toFixed(1)}%`
                  : ''
              }`
            : undefined
        }
        highlight={aovChange === undefined ? 'neutral' : aovChange >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="카테고리 1위"
        value={topCategory ? (CATEGORY_LABEL[topCategory] ?? topCategory) : '—'}
        highlight="neutral"
      />
    </div>
  )
}
