const CATEGORY_LABEL: Record<string, string> = {
  ingredients: '재료비',
  fixed: '고정비',
  card: '카드대금',
  labor: '인건비',
}

const CATEGORY_COLOR: Record<string, string> = {
  ingredients: 'text-amber-600 bg-amber-50',
  fixed: 'text-gray-600 bg-gray-100',
  card: 'text-red-500 bg-red-50',
  labor: 'text-[#1a5c3a] bg-green-50',
}

interface ExpenseItem {
  id: string
  item: string
  amount: number
}

interface ExpenseItemListProps {
  data: Record<string, ExpenseItem[]>
}

const SHOW_CATEGORIES = ['ingredients', 'fixed', 'card', 'labor']

export default function ExpenseItemList({ data }: ExpenseItemListProps) {
  const hasData = SHOW_CATEGORIES.some((c) => (data[c]?.length ?? 0) > 0)

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
        지출 항목 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {SHOW_CATEGORIES.filter((c) => (data[c]?.length ?? 0) > 0).map((category) => {
        const items = data[category]
        const total = items.reduce((s, i) => s + i.amount, 0)

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[category]}`}>
                {CATEGORY_LABEL[category]}
              </span>
              <span className="text-xs font-medium text-gray-500">
                총 {Math.round(total / 10000)}만원
              </span>
            </div>
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
          </div>
        )
      })}
    </div>
  )
}
