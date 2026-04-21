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

  // 일별 매출 (daily_sales) — source 포함해서 POS 우선 처리
  const { data: salesData } = await supabase
    .from('daily_sales')
    .select('date, amount, source')
    .gte('date', sinceStr)
    .order('date')

  // 지출 (monthly_expenses — date 컬럼 있는 것만, excluded 카테고리는 집계 제외)
  const { data: expenseData } = await supabase
    .from('monthly_expenses')
    .select('date, amount')
    .gte('date', sinceStr)
    .not('date', 'is', null)
    .neq('category', 'excluded')
    .order('date')

  // 날짜별로 pos/bank 분리 집계
  const incomeByDate: Record<string, { pos: number; bank: number }> = {}
  for (const row of salesData ?? []) {
    if (!incomeByDate[row.date]) incomeByDate[row.date] = { pos: 0, bank: 0 }
    if (row.source === 'pos') incomeByDate[row.date].pos += row.amount
    else incomeByDate[row.date].bank += row.amount
  }

  // 주별로 그룹핑 (POS 우선)
  const incomeByWeek: Record<string, number> = {}
  const expenseByWeek: Record<string, number> = {}

  for (const [date, amounts] of Object.entries(incomeByDate)) {
    const ws = toDateStr(getWeekStart(new Date(date)))
    const amount = amounts.pos > 0 ? amounts.pos : amounts.bank
    incomeByWeek[ws] = (incomeByWeek[ws] ?? 0) + amount
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
    const weekOfMonth = Math.ceil(d / 7)
    const ordinal = ['첫째', '둘째', '셋째', '넷째', '다섯째'][weekOfMonth - 1] ?? `${weekOfMonth}번째`

    result.push({
      weekStart: wsStr,
      weekEnd: toDateStr(weekEnd),
      label: `${m}월 ${ordinal} 주`,
      income,
      expense,
      profit: income - expense,
      hasExpenseData,
    })
  }

  return result
}
