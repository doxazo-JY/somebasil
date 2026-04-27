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

// 비정상 낮은 매출 임계 — 영업일 평균 대비 60% 미만이면 빨간 점
const LOW_THRESHOLD = 0.6

// KST 오늘 날짜 (오늘은 부분일자라 비정상 판정 제외)
function getKSTTodayKey(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SalesCalendar({ data, year, month }: SalesCalendarProps) {
  const byDate = aggregateByDate(data)
  const max = Math.max(...Object.values(byDate), 1)

  // 영업일 평균(0원 제외) — 비정상 판정 기준
  const businessDays = Object.values(byDate).filter((v) => v > 0)
  const avg =
    businessDays.length > 0
      ? businessDays.reduce((s, v) => s + v, 0) / businessDays.length
      : 0
  const lowCutoff = avg * LOW_THRESHOLD
  const todayKey = getKSTTodayKey()

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

  // 비정상 낮은 날 카운트 (안내 문구용)
  const lowDays = Object.entries(byDate).filter(
    ([k, v]) => v > 0 && v < lowCutoff && k !== todayKey,
  ).length

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">{month}월 일별 매출</p>
        {avg > 0 && (
          <p className="text-[11px] text-gray-400 [word-break:keep-all]">
            영업일 평균 {Math.round(avg / 10000)}만
            {lowDays > 0 && (
              <span className="text-red-500 ml-2">● 평소比 60% 미만 {lowDays}일</span>
            )}
          </p>
        )}
      </div>
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

          // 비정상 낮음 — 영업일 평균 60% 미만 (오늘은 제외)
          const isAbnormalLow =
            amount > 0 && amount < lowCutoff && key !== todayKey

          return (
            <div
              key={key}
              className={`relative rounded-lg py-2 flex flex-col items-center gap-0.5 ${heatClass}`}
              title={
                isAbnormalLow
                  ? `평소比 ${Math.round((amount / avg) * 100)}% — 비정상 낮음`
                  : undefined
              }
            >
              {isAbnormalLow && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500"
                  aria-label="비정상 낮은 매출"
                />
              )}
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
