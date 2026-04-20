import { createServerClient } from '../server'

// 월요일 기준 주 시작일 계산
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=일
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface WeekData {
  weekStart: string   // YYYY-MM-DD (월요일)
  weekEnd: string     // YYYY-MM-DD (일요일)
  label: string       // "4/14주"
  income: number
  expense: number
  profit: number
  hasExpenseData: boolean
}

// 최근 N주 데이터 집계
export async function getWeeklySummary(weeks: number = 6): Promise<WeekData[]> {
  const supabase = createServerClient()

  // 기준일: 오늘 기준 weeks주 전 월요일
  const today = new Date()
  const thisWeekStart = getWeekStart(today)
  const since = new Date(thisWeekStart)
  since.setDate(since.getDate() - (weeks - 1) * 7)

  const sinceStr = toDateStr(since)

  // 일별 매출 (daily_sales)
  const { data: salesData } = await supabase
    .from('daily_sales')
    .select('date, amount')
    .gte('date', sinceStr)
    .order('date')

  // 지출 (monthly_expenses — date 컬럼 있는 것만)
  const { data: expenseData } = await supabase
    .from('monthly_expenses')
    .select('date, amount')
    .gte('date', sinceStr)
    .not('date', 'is', null)
    .order('date')

  // 주별로 그룹핑
  const incomeByWeek: Record<string, number> = {}
  const expenseByWeek: Record<string, number> = {}

  for (const row of salesData ?? []) {
    const ws = toDateStr(getWeekStart(new Date(row.date)))
    incomeByWeek[ws] = (incomeByWeek[ws] ?? 0) + row.amount
  }

  for (const row of expenseData ?? []) {
    if (!row.date) continue
    const ws = toDateStr(getWeekStart(new Date(row.date)))
    expenseByWeek[ws] = (expenseByWeek[ws] ?? 0) + row.amount
  }

  // 최근 N주 배열 생성 (과거 → 현재 순)
  const result: WeekData[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(thisWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const wsStr = toDateStr(weekStart)
    const income = incomeByWeek[wsStr] ?? 0
    const expense = expenseByWeek[wsStr] ?? 0
    const hasExpenseData = wsStr in expenseByWeek

    const m = weekStart.getMonth() + 1
    const d = weekStart.getDate()

    result.push({
      weekStart: wsStr,
      weekEnd: toDateStr(weekEnd),
      label: `${m}/${d}주`,
      income,
      expense,
      profit: income - expense,
      hasExpenseData,
    })
  }

  return result
}
