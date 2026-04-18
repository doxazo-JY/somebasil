interface SalesItem {
  category: string
  amount: number
}

interface CategorySalesProps {
  data: SalesItem[]
}

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피류',
  matcha: '말차류',
  beverage: '음료류',
  dessert: '디저트',
}

export default function CategorySales({ data }: CategorySalesProps) {
  // 카테고리별 합산
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.amount
    return acc
  }, {})

  const sorted = Object.entries(grouped)
    .map(([category, amount]) => ({
      label: CATEGORY_LABEL[category] ?? category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  const max = sorted[0]?.amount ?? 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">카테고리별 매출</p>
      <ul className="flex flex-col gap-3">
        {sorted.map(({ label, amount }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="w-14 text-xs text-gray-500 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a5c3a] rounded-full"
                style={{ width: `${(amount / max) * 100}%` }}
              />
            </div>
            <span className="w-14 text-xs text-gray-700 text-right font-medium">
              {Math.round(amount / 10000)}만
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
