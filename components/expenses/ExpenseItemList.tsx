const CATEGORY_LABEL: Record<string, string> = {
  ingredients_cash: '재료비(현금)',
  ingredients_card: '재료비(카드)',
  fixed: '고정비',
  equipment: '설비투자',
  card: '카드대금',
  labor: '인건비',
}

const CATEGORY_COLOR: Record<string, string> = {
  ingredients_cash: 'text-amber-600 bg-amber-50',
  ingredients_card: 'text-amber-500 bg-amber-50/60',
  fixed: 'text-gray-600 bg-gray-100',
  equipment: 'text-sky-600 bg-sky-50',
  card: 'text-red-500 bg-red-50',
  labor: 'text-violet-600 bg-violet-50',
}

interface ExpenseItem {
  id: string
  item: string
  amount: number
}

interface ExpenseItemListProps {
  data: Record<string, ExpenseItem[]>
}

const SHOW_CATEGORIES = ['ingredients_cash', 'ingredients_card', 'labor', 'fixed', 'equipment', 'card']

export default function ExpenseItemList({ data }: ExpenseItemListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {SHOW_CATEGORIES.map((category) => {
        const items = data[category] ?? []
        const total = items.reduce((s, i) => s + i.amount, 0)

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-100 flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[category]}`}>
                {CATEGORY_LABEL[category]}
              </span>
              <span className="text-xs font-medium text-gray-500">
                총 {Math.round(total / 10000)}만원
              </span>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-300">
                — 거래 없음 —
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center px-5 py-2.5 gap-3">
                    <span className="text-xs text-gray-600 flex-1 truncate">{item.item || '—'}</span>
                    <span className="text-xs font-medium text-gray-700 shrink-0">
                      {item.amount.toLocaleString()}원
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
