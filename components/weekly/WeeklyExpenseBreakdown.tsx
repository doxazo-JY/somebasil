import type { WeekDetail } from '@/lib/supabase/queries/weekly'

const CATEGORY_LABEL: Record<string, string> = {
  labor: '인건비',
  ingredients_cash: '재료비(현금)',
  ingredients_card: '재료비(카드)',
  fixed: '고정비',
  equipment: '설비투자',
  card: '카드대금',
}

const CATEGORY_HINT: Record<string, string> = {
  labor: '급여',
  ingredients_cash: '정기 공급처 (원두·말차·우유·소금집)',
  ingredients_card: '비정기 구매 (마트·편의점·포장재)',
  fixed: '전기·임대료·세금·보험',
  equipment: '테이블·반죽기 등 일회성',
  card: '기타 카드 결제',
}

const CATEGORY_HEX: Record<string, string> = {
  labor: '#a78bfa', // violet-400
  ingredients_cash: '#fbbf24', // amber-400
  ingredients_card: '#fcd34d', // amber-300
  fixed: '#60a5fa', // blue-400
  equipment: '#7dd3fc', // sky-300
  card: '#9ca3af', // gray-400
}

// 모든 카테고리 고정 순서 (0원 항목도 보여주기 위해)
const CATEGORY_ORDER = ['labor', 'ingredients_cash', 'ingredients_card', 'fixed', 'equipment', 'card']

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

interface Props {
  current: WeekDetail['expenseByCategory']
  prev?: WeekDetail['expenseByCategory']
  currentHasData: boolean
  prevHasData?: boolean
}

export default function WeeklyExpenseBreakdown({
  current,
  prev,
  currentHasData,
  prevHasData,
}: Props) {
  const currMap = new Map<string, number>()
  for (const c of current) currMap.set(c.category, c.amount)
  const prevMap = new Map<string, number>()
  if (prev) for (const c of prev) prevMap.set(c.category, c.amount)

  const maxValue = Math.max(
    ...[...currMap.values(), ...prevMap.values(), 1],
  )

  const totalCurr = [...currMap.values()].reduce((s, v) => s + v, 0)
  const totalPrev = [...prevMap.values()].reduce((s, v) => s + v, 0)

  if (!currentHasData && !prevHasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">지출 카테고리 비교</p>
        <p className="text-sm text-gray-400 py-8 text-center">지출 데이터 없음</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">지출 카테고리 비교</p>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-1.5 rounded-sm bg-red-300" />
            선택 주
          </span>
          {prev && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-1.5 rounded-sm bg-gray-300" />
              전주
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {CATEGORY_ORDER.map((category) => {
          const label = CATEGORY_LABEL[category] ?? category
          const color = CATEGORY_HEX[category] ?? '#9ca3af'
          const curr = currMap.get(category) ?? 0
          const prevAmt = prevMap.get(category) ?? 0
          const delta =
            prev !== undefined && prevAmt > 0 ? ((curr - prevAmt) / prevAmt) * 100 : null

          return (
            <li key={category} className="text-xs">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-28 shrink-0 flex flex-col gap-0">
                  <span className="text-gray-600">{label}</span>
                  <span className="text-[9px] text-gray-400 leading-tight">
                    {CATEGORY_HINT[category] ?? ''}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-2.5 bg-gray-50 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(curr / maxValue) * 100}%`,
                        background: color,
                        opacity: curr === 0 ? 0 : 1,
                      }}
                    />
                  </div>
                  {prev && (
                    <div className="h-1.5 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-gray-300"
                        style={{
                          width: `${(prevAmt / maxValue) * 100}%`,
                          opacity: prevAmt === 0 ? 0 : 1,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0 shrink-0 w-16">
                  <span className="text-gray-700 font-medium tabular-nums">
                    {curr > 0 ? fmt(curr) : '—'}
                  </span>
                  {prev && (
                    <span className="text-gray-400 text-[10px] tabular-nums">
                      {prevAmt > 0 ? fmt(prevAmt) : '—'}
                    </span>
                  )}
                </div>
                <span className="w-14 text-right shrink-0 text-[11px] tabular-nums">
                  {delta === null ? (
                    <span className="text-gray-300">—</span>
                  ) : Math.abs(delta) < 0.5 ? (
                    <span className="text-gray-300">=</span>
                  ) : delta > 0 ? (
                    <span className="text-red-400">▲{delta.toFixed(0)}%</span>
                  ) : (
                    <span className="text-[#1a5c3a]">▼{Math.abs(delta).toFixed(0)}%</span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {/* 합계 */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500">총 지출</span>
        <div className="text-right">
          <span className="font-semibold text-gray-800">{fmt(totalCurr)}</span>
          {prev && totalPrev > 0 && (
            <span className="text-gray-400 text-[10px] ml-2">전주 {fmt(totalPrev)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
