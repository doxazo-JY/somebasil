import StatCard from '@/components/ui/StatCard'

interface ExpenseStatCardsProps {
  income: number
  ingredients: number
  labor: number
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

export default function ExpenseStatCards({ income, ingredients, labor }: ExpenseStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        label="원가율"
        value={pct(ingredients, income)}
        subLabel="재료비 / 수입"
        highlight="neutral"
      />
      <StatCard
        label="인건비율"
        value={pct(labor, income)}
        subLabel="인건비 / 수입"
        highlight={income > 0 && labor / income > 0.3 ? 'negative' : 'neutral'}
      />
    </div>
  )
}
