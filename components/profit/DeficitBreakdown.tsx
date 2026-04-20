// 적자 분해 — "이번 달 적자 어디서 왔나?"

interface DeficitBreakdownProps {
  income: number
  labor: number
  ingredients: number
  fixed: number
  card: number
}

const CATEGORY_INFO: Record<string, { label: string; color: string; bar: string; note: string }> = {
  labor:       { label: '인건비',  color: 'text-violet-600', bar: 'bg-violet-400', note: '구조적 고정비' },
  ingredients: { label: '재료비',  color: 'text-amber-600',  bar: 'bg-amber-400',  note: '프리미엄 원재료' },
  fixed:       { label: '고정비',  color: 'text-blue-600',   bar: 'bg-blue-400',   note: '임대료 등' },
  card:        { label: '기타',    color: 'text-gray-500',   bar: 'bg-gray-300',   note: '카드대금 등' },
}

function fmt(v: number) {
  return `${Math.round(Math.abs(v) / 10000)}만`
}

export default function DeficitBreakdown({ income, labor, ingredients, fixed, card }: DeficitBreakdownProps) {
  if (income === 0) return null

  const totalExpense = labor + ingredients + fixed + card
  const items = [
    { key: 'labor', amount: labor },
    { key: 'ingredients', amount: ingredients },
    { key: 'fixed', amount: fixed },
    { key: 'card', amount: card },
  ].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">이번 달 비용 구조</p>

      {/* 매출 기준선 */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">매출 (수입)</span>
          <span className="font-semibold text-[#1a5c3a]">{fmt(income)}원</span>
        </div>
        <div className="h-2.5 bg-[#1a5c3a]/15 rounded-full">
          <div className="h-full bg-[#1a5c3a] rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* 비용 항목별 바 */}
      <div className="flex flex-col gap-3">
        {items.map(({ key, amount }) => {
          const info = CATEGORY_INFO[key]
          const pctOfIncome = (amount / income) * 100
          const pctOfExpense = (amount / totalExpense) * 100
          const barWidth = Math.min((amount / income) * 100, 100)

          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${info.color}`}>{info.label}</span>
                  <span className="text-gray-400 text-[10px]">{info.note}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-[10px]">전체 지출의 {pctOfExpense.toFixed(0)}%</span>
                  <span className={`font-semibold ${info.color}`}>
                    {fmt(amount)}원 ({pctOfIncome.toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${info.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 합계 */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-500">총 지출</span>
        <div className="text-right">
          <span className="font-bold text-gray-800">{fmt(totalExpense)}원</span>
          <span className="text-xs text-gray-400 ml-2">
            (매출의 {((totalExpense / income) * 100).toFixed(0)}%)
          </span>
        </div>
      </div>
      {totalExpense > income && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-red-400">이번 달 적자</span>
          <span className="font-bold text-red-500">-{fmt(totalExpense - income)}원</span>
        </div>
      )}
    </div>
  )
}
