interface DailySale {
  date: string
  category: string
  amount: number
}

interface SalesCalendarProps {
  data: DailySale[]
  year: number
  month: number
}

// 날짜별 합계 계산
function aggregateByDate(data: DailySale[]): Record<string, number> {
  return data.reduce<Record<string, number>>((acc, row) => {
    acc[row.date] = (acc[row.date] ?? 0) + row.amount
    return acc
  }, {})
}

// 매출 금액에 따른 배경색 (히트맵)
function getHeatColor(amount: number, max: number): string {
  if (amount === 0 || max === 0) return ''
  const ratio = amount / max
  if (ratio >= 0.8) return 'bg-[#1a5c3a] text-white'
  if (ratio >= 0.6) return 'bg-[#2d7a52] text-white'
  if (ratio >= 0.4) return 'bg-[#4a9e72] text-white'
  if (ratio >= 0.2) return 'bg-[#86c9a4] text-gray-800'
  return 'bg-[#d4eddf] text-gray-600'
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function SalesCalendar({ data, year, month }: SalesCalendarProps) {
  const byDate = aggregateByDate(data)
  const max = Math.max(...Object.values(byDate), 1)

  // 해당 월의 1일 요일과 마지막 날
  const firstDay = new Date(year, month - 1, 1).getDay()
  const lastDate = new Date(year, month, 0).getDate()

  // 달력 칸 생성 (앞 빈칸 + 날짜들)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ]

  // 7의 배수로 맞추기
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">{month}월 일별 매출</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-gray-400 font-medium">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />
          const key = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
          const amount = byDate[key] ?? 0
          const heatClass = amount > 0 ? getHeatColor(amount, max) : 'text-gray-300'

          return (
            <div
              key={key}
              className={`rounded-lg py-2 flex flex-col items-center gap-0.5 ${heatClass}`}
            >
              <span className="font-medium">{date}</span>
              {amount > 0 && (
                <span className="text-[10px] opacity-80">{Math.round(amount / 10000)}만</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
