// 손익분기 분석 — "흑자가 되려면 뭐가 바뀌어야 하나?"

interface BreakEvenSectionProps {
  income: number
  expense: number
  profit: number
}

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

export default function BreakEvenSection({ income, expense, profit }: BreakEvenSectionProps) {
  if (income === 0 && expense === 0) return null

  const isProfit = profit >= 0
  const gap = Math.abs(profit) // 흑자/적자 금액

  // 흑자가 되려면
  const revenueIncreaseNeeded = income > 0 ? ((expense - income) / income) * 100 : 0
  const expenseDecreaseNeeded = expense > 0 ? ((expense - income) / expense) * 100 : 0

  // 매출 대비 지출 비율
  const costCoverageRatio = income > 0 ? (expense / income) * 100 : 0

  return (
    <div className={`rounded-xl border px-5 py-5 ${isProfit ? 'border-[#1a5c3a]/20 bg-green-50/50' : 'border-red-100 bg-red-50/30'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        {/* 왼쪽: 핵심 메시지 */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            이번 달 손익분기 분석
          </p>
          {isProfit ? (
            <p className="text-lg font-bold text-[#1a5c3a]">
              {fmt(profit)} 흑자 달성 ✓
            </p>
          ) : (
            <p className="text-lg font-bold text-red-500">
              흑자까지 <span className="text-2xl">{fmt(gap)}</span> 부족
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            매출 {fmt(income)} · 지출 {fmt(expense)} · 비율 {costCoverageRatio.toFixed(0)}%
          </p>
        </div>

        {/* 오른쪽: 시나리오 */}
        {!isProfit && income > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white rounded-lg px-4 py-3 border border-red-100 text-center min-w-[120px]">
              <p className="text-[10px] text-gray-400 mb-1">매출을 늘리면</p>
              <p className="text-xl font-bold text-gray-800">+{revenueIncreaseNeeded.toFixed(0)}%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">↑ {fmt(expense - income)} 더 필요</p>
            </div>
            <div className="bg-white rounded-lg px-4 py-3 border border-red-100 text-center min-w-[120px]">
              <p className="text-[10px] text-gray-400 mb-1">지출을 줄이면</p>
              <p className="text-xl font-bold text-gray-800">-{expenseDecreaseNeeded.toFixed(0)}%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">↓ {fmt(expense - income)} 절감 필요</p>
            </div>
          </div>
        )}
      </div>

      {/* 진행 바: 매출이 지출을 얼마나 커버하는지 */}
      {income > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>매출로 지출 커버 비율</span>
            <span>{Math.min(costCoverageRatio, 100).toFixed(1)}% / 100%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isProfit ? 'bg-[#1a5c3a]' : 'bg-red-400'}`}
              style={{ width: `${Math.min((income / expense) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {isProfit
              ? `지출의 ${costCoverageRatio.toFixed(0)}%를 매출로 커버 (흑자)`
              : `지출의 ${((income / expense) * 100).toFixed(0)}%만 매출로 커버`
            }
          </p>
        </div>
      )}
    </div>
  )
}
