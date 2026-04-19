import StatCard from '@/components/ui/StatCard'

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피류',
  matcha: '말차류',
  beverage: '음료류',
  dessert: '디저트',
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
}

export default function IncomeStatCards({ income, prevIncome, topCategory }: IncomeStatCardsProps) {
  const change = calcChange(income, prevIncome)

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        label="월 매출"
        value={income > 0 ? formatManwon(income) : '—'}
        highlight="neutral"
      />
      <StatCard
        label="전월 比"
        value={change !== undefined ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%` : '—'}
        subLabel={prevIncome > 0 ? `전월 ${formatManwon(prevIncome)}` : undefined}
        highlight={change === undefined ? 'neutral' : change >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="카테고리 1위"
        value={topCategory ? (CATEGORY_LABEL[topCategory] ?? topCategory) : '—'}
        highlight="neutral"
      />
    </div>
  )
}
