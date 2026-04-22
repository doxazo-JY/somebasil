interface SalesItem {
  category: string
  amount: number
}

interface CategorySalesProps {
  data: SalesItem[]
}

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

const CATEGORY_HEX: Record<string, string> = {
  coffee: '#1a5c3a',
  drip_coffee: '#6ba088',
  dutch_coffee: '#9ec8b2',
  matcha: '#7cc4a7',
  ade: '#e8c787',
  tea: '#e8a98a',
  beverage: '#8fb9d4',
  dessert: '#d99aa8',
  season: '#b8a0d0',
  etc: '#c4c7cc',
}

export default function CategorySales({ data }: CategorySalesProps) {
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.amount
    return acc
  }, {})

  const total = Object.values(grouped).reduce((s, v) => s + v, 0)
  const sorted = Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      amount,
      color: CATEGORY_HEX[category] ?? '#c4c7cc',
    }))
    .sort((a, b) => b.amount - a.amount)

  const max = sorted[0]?.amount ?? 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">카테고리별 매출</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">데이터 없음</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map(({ category, label, amount, color }) => {
            const pct = total > 0 ? (amount / total) * 100 : 0
            return (
              <li key={category} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-600 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(amount / max) * 100}%`, background: color }}
                  />
                </div>
                <span className="w-10 text-[11px] text-gray-400 text-right tabular-nums">
                  {pct.toFixed(1)}%
                </span>
                <span className="w-16 text-xs text-gray-700 text-right font-medium tabular-nums">
                  {Math.round(amount / 10000)}만
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
