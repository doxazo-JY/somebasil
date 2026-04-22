import type { WeekDetail } from '@/lib/supabase/queries/weekly'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  daily: WeekDetail['daily']
  prevDaily?: WeekDetail['daily']
}

export default function DailyBreakdownChart({ daily, prevDaily }: Props) {
  // 전주 같은 요일 인덱스 맞추기 (0=월 기준 1주 시작)
  // daily는 weekStart 기준 7일. prevDaily도 weekStart 기준 7일이라 인덱스로 매칭 가능.
  const prevByIndex = new Map<number, number>()
  if (prevDaily) {
    prevDaily.forEach((d, i) => prevByIndex.set(i, d.income))
  }

  const allValues = [
    ...daily.map((d) => d.income),
    ...(prevDaily ? prevDaily.map((d) => d.income) : []),
  ]
  const max = Math.max(...allValues, 1)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">요일별 매출</p>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2 rounded-sm bg-[#1a5c3a]" />
            선택 주
          </span>
          {prevDaily && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2 rounded-sm bg-gray-300" />
              전주
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {daily.map((d, i) => {
          const prevIncome = prevByIndex.get(i) ?? 0
          const ratio = d.income / max
          const prevRatio = prevIncome / max
          const barColor =
            d.weekday === 0 ? 'bg-red-300' : d.weekday === 6 ? 'bg-blue-300' : 'bg-[#1a5c3a]'

          return (
            <li key={d.date} className="text-xs">
              <div className="flex items-center gap-3 mb-1">
                <span
                  className={`w-16 shrink-0 ${
                    d.weekday === 0
                      ? 'text-red-400'
                      : d.weekday === 6
                      ? 'text-blue-400'
                      : 'text-gray-500'
                  }`}
                >
                  {WEEKDAY_LABELS[d.weekday]} ({d.date.slice(5).replace('-', '/')})
                </span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-3 bg-gray-50 rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${barColor}`}
                      style={{
                        width: `${ratio * 100}%`,
                        opacity: d.income === 0 ? 0 : 1,
                      }}
                    />
                  </div>
                  {prevDaily && (
                    <div className="h-2 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded bg-gray-300"
                        style={{
                          width: `${prevRatio * 100}%`,
                          opacity: prevIncome === 0 ? 0 : 1,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 w-24">
                  <span className="text-gray-700 font-medium tabular-nums">
                    {d.income > 0 ? `${Math.round(d.income / 10000)}만` : '—'}
                  </span>
                  {prevDaily && (
                    <span className="text-gray-400 text-[10px] tabular-nums">
                      {prevIncome > 0 ? `전주 ${Math.round(prevIncome / 10000)}만` : '전주 —'}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
