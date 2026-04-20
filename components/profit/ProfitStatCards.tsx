import StatCard from '@/components/ui/StatCard'

function formatManwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function calcChange(cur: number, prev: number | undefined) {
  if (!prev || prev === 0) return undefined
  return ((cur - prev) / Math.abs(prev)) * 100
}

function profitMargin(profit: number, income: number) {
  if (income === 0) return '—'
  return `${((profit / income) * 100).toFixed(1)}%`
}

interface ProfitStatCardsProps {
  profit: number
  income: number
  expense: number
  prevProfit?: number
  prevIncome?: number
}

export default function ProfitStatCards({
  profit, income, expense, prevProfit, prevIncome,
}: ProfitStatCardsProps) {
  const change = calcChange(profit, prevProfit)
  const margin = profitMargin(profit, income)
  const prevMargin = prevProfit !== undefined && prevIncome
    ? profitMargin(prevProfit, prevIncome)
    : undefined

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        label="순이익"
        value={income > 0 || expense > 0 ? formatManwon(profit) : '—'}
        change={change}
        subLabel={prevProfit !== undefined ? `전월 ${formatManwon(prevProfit)}` : '전월比'}
        highlight={profit >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="이익률"
        value={margin}
        subLabel={prevMargin ? `전월 ${prevMargin}` : '순이익 / 매출'}
        highlight={profit >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="손익분기"
        value={income >= expense ? '흑자' : '적자'}
        subLabel={`매출 ${formatManwon(income)} · 지출 ${formatManwon(expense)}`}
        highlight={income >= expense ? 'positive' : 'negative'}
      />
    </div>
  )
}
