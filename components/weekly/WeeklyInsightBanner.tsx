// /weekly 첫 줄 요약 — 대시보드 InsightBanner의 주간 버전
// - 주 라벨 + 일수 + 부분주 안내
// - 손익분기 갭 (지출 데이터 있을 때)
// - 가장 큰 전주比 악화 (KPI 5개 중)

interface WeeklyInsightBannerProps {
  weekStart: string
  weekEnd: string
  income: number
  expense: number
  profit: number
  hasExpenseData: boolean
  isPartial: boolean
  daysCount: number
  prev?: {
    income: number
    expense: number
    profit: number
    aov: number
    orderCount: number
    hasExpenseData: boolean
  }
  current: {
    aov: number
    orderCount: number
  }
}

const ALERT_THRESHOLD = 10 // 전주比 -10% 이하 = 빨강
const WARN_THRESHOLD = 5

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function pct(cur: number, prev: number): number | null {
  if (!prev || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

// MM/DD 포맷
function md(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

export default function WeeklyInsightBanner({
  weekStart,
  weekEnd,
  income,
  expense,
  profit,
  hasExpenseData,
  isPartial,
  daysCount,
  prev,
  current,
}: WeeklyInsightBannerProps) {
  // 가장 큰 악화 (전주比 음수가 큰 것) — 매출/손익/객단가/주문 중
  // 지출은 증가가 악화이므로 부호 반전
  const changes: { label: string; change: number; type: 'normal' | 'expense' }[] = []
  if (prev?.income !== undefined) {
    const c = pct(income, prev.income)
    if (c !== null) changes.push({ label: '매출', change: c, type: 'normal' })
  }
  if (prev?.aov !== undefined) {
    const c = pct(current.aov, prev.aov)
    if (c !== null) changes.push({ label: '객단가', change: c, type: 'normal' })
  }
  if (prev?.orderCount !== undefined) {
    const c = pct(current.orderCount, prev.orderCount)
    if (c !== null) changes.push({ label: '주문 건수', change: c, type: 'normal' })
  }
  if (prev?.hasExpenseData && hasExpenseData) {
    const c = pct(expense, prev.expense)
    // 지출은 증가가 악화 → 부호 반전해서 같은 비교 가능
    if (c !== null) changes.push({ label: '지출', change: -c, type: 'expense' })
  }

  // 가장 악화된 항목 (change가 가장 음수)
  const worst = changes
    .filter((c) => c.change <= -WARN_THRESHOLD)
    .sort((a, b) => a.change - b.change)[0]

  const isProfit = profit >= 0
  const gap = Math.abs(profit)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {/* 주 라벨 */}
      <span className="text-gray-500 [word-break:keep-all]">
        <span className="text-gray-700 font-medium">
          {md(weekStart)}–{md(weekEnd)}
        </span>
        <span className="text-gray-400 ml-1.5">
          · {daysCount}일치{isPartial && ' (부분주)'}
        </span>
      </span>

      {/* 손익분기 갭 */}
      {hasExpenseData && (
        <>
          <span className="text-gray-200" aria-hidden>
            |
          </span>
          {isProfit ? (
            <span className="text-[#1a5c3a] font-medium [word-break:keep-all]">
              ✓ 손익분기 <strong>+{fmt(profit)}</strong> 초과
            </span>
          ) : (
            <span className="text-red-500 font-medium [word-break:keep-all]">
              ⚠ 손익분기까지 <strong>{fmt(gap)}</strong> 부족
            </span>
          )}
        </>
      )}

      {/* 가장 악화된 변화 (전주比) */}
      {worst && (
        <>
          <span className="text-gray-200" aria-hidden>
            |
          </span>
          <span
            className={`font-medium [word-break:keep-all] ${
              worst.change <= -ALERT_THRESHOLD ? 'text-red-500' : 'text-amber-600'
            }`}
          >
            {worst.label}{' '}
            {worst.type === 'expense'
              ? `▲${Math.abs(worst.change).toFixed(1)}%`
              : `▼${Math.abs(worst.change).toFixed(1)}%`}{' '}
            <span className="text-gray-400 font-normal">전주比</span>
          </span>
        </>
      )}

      {/* 매출 데이터 없을 때 */}
      {!hasExpenseData && income === 0 && (
        <>
          <span className="text-gray-200" aria-hidden>
            |
          </span>
          <span className="text-gray-400">데이터 없음</span>
        </>
      )}
    </div>
  )
}
