import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

type SalesRow = { date: string; amount: number; source: string }
type ExpenseRow = { date: string; amount: number }

// ─────────────────────────────────────────────
// 한 주의 상세 분석 (주간보고용)
// ─────────────────────────────────────────────
export interface WeekDetail {
  weekStart: string
  weekEnd: string
  label: string
  income: number
  expense: number
  profit: number
  orderCount: number
  aov: number
  hasExpenseData: boolean
  /** 월~일 요일별 매출/주문 */
  daily: { date: string; weekday: number; income: number; orderCount: number }[]
  /** 상품별 집계 */
  topProducts: {
    product_name: string
    category: string
    quantity: number
    amount: number
  }[]
  /** 카테고리별 집계 */
  categoryMix: { category: string; amount: number; pct: number }[]
  /** 카테고리별 지출 */
  expenseByCategory: { category: string; amount: number }[]
}

export async function getWeekDetail(
  weekStart: string,
  weekEnd: string,
): Promise<WeekDetail> {
  const supabase = createServerClient()

  // 매출 상세 (POS만)
  type SalesDetail = {
    date: string
    order_id: string | null
    product_name: string | null
    category: string
    quantity: number | null
    amount: number
  }
  const salesRows = await fetchAllRows<SalesDetail>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, order_id, product_name, category, quantity, amount')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .eq('source', 'pos')
      .range(from, to),
  )

  // 지출 (excluded 제외)
  const expenseRows = await fetchAllRows<{ date: string; category: string; amount: number }>(
    (from, to) =>
      supabase
        .from('monthly_expenses')
        .select('date, category, amount')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .neq('category', 'excluded')
        .not('date', 'is', null)
        .range(from, to),
  )

  // 수입 집계
  const income = salesRows.reduce((s, r) => s + r.amount, 0)
  const orderSet = new Set<string>()
  for (const r of salesRows) {
    if (r.order_id) orderSet.add(`${r.date}|${r.order_id}`)
  }
  const orderCount = orderSet.size
  const aov = orderCount > 0 ? Math.round(income / orderCount) : 0

  // 요일별 집계 (월-일)
  const dailyMap = new Map<string, { income: number; orders: Set<string> }>()
  for (const r of salesRows) {
    const entry = dailyMap.get(r.date) ?? { income: 0, orders: new Set<string>() }
    entry.income += r.amount
    if (r.order_id) entry.orders.add(r.order_id)
    dailyMap.set(r.date, entry)
  }
  const daily: WeekDetail['daily'] = []
  const start = new Date(weekStart)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const weekday = d.getDay()
    const entry = dailyMap.get(dateStr)
    daily.push({
      date: dateStr,
      weekday,
      income: entry?.income ?? 0,
      orderCount: entry?.orders.size ?? 0,
    })
  }

  // 상품별 집계
  const productMap = new Map<string, { category: string; quantity: number; amount: number }>()
  for (const r of salesRows) {
    if (!r.product_name) continue
    const curr = productMap.get(r.product_name) ?? {
      category: r.category,
      quantity: 0,
      amount: 0,
    }
    curr.quantity += r.quantity ?? 0
    curr.amount += r.amount
    productMap.set(r.product_name, curr)
  }
  const topProducts = [...productMap.entries()]
    .map(([product_name, v]) => ({ product_name, ...v }))
    .sort((a, b) => b.amount - a.amount)

  // 카테고리별 매출 집계
  const catMap = new Map<string, number>()
  for (const r of salesRows) {
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount)
  }
  const categoryMix = [...catMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      pct: income > 0 ? (amount / income) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // 지출 집계
  const expense = expenseRows.reduce((s, r) => s + r.amount, 0)
  const expenseCatMap = new Map<string, number>()
  for (const r of expenseRows) {
    expenseCatMap.set(r.category, (expenseCatMap.get(r.category) ?? 0) + r.amount)
  }
  const expenseByCategory = [...expenseCatMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  // 레이블
  const startDate = new Date(weekStart)
  const m = startDate.getMonth() + 1
  const d = startDate.getDate()
  const weekOfMonth = Math.ceil(d / 7)
  const ordinal = ['첫째', '둘째', '셋째', '넷째', '다섯째'][weekOfMonth - 1] ?? `${weekOfMonth}번째`

  return {
    weekStart,
    weekEnd,
    label: `${m}월 ${ordinal} 주`,
    income,
    expense,
    profit: income - expense,
    orderCount,
    aov,
    hasExpenseData: expenseRows.length > 0,
    daily,
    topProducts,
    categoryMix,
    expenseByCategory,
  }
}

// ─────────────────────────────────────────────
// 주 선택용 최근 N주 리스트 (시작-끝 날짜)
// ─────────────────────────────────────────────
export interface WeekOption {
  weekStart: string
  weekEnd: string
  label: string
  isCurrent: boolean
  isLast: boolean
}

export function getRecentWeekOptions(count: number = 8): WeekOption[] {
  const today = new Date()
  // 월요일 기준 이번 주 시작
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() + diff)
  thisWeekStart.setHours(0, 0, 0, 0)

  const options: WeekOption[] = []
  for (let i = 0; i < count; i++) {
    const ws = new Date(thisWeekStart)
    ws.setDate(ws.getDate() - i * 7)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)

    const wsStr = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`
    const weStr = `${we.getFullYear()}-${String(we.getMonth() + 1).padStart(2, '0')}-${String(we.getDate()).padStart(2, '0')}`

    const m = ws.getMonth() + 1
    const d = ws.getDate()
    const weekOfMonth = Math.ceil(d / 7)
    const ordinal = ['첫째', '둘째', '셋째', '넷째', '다섯째'][weekOfMonth - 1] ?? `${weekOfMonth}번째`

    options.push({
      weekStart: wsStr,
      weekEnd: weStr,
      label: `${m}월 ${ordinal} 주`,
      isCurrent: i === 0,
      isLast: i === 1,
    })
  }
  return options
}

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

  // 일별 매출 (daily_sales) — source 포함해서 POS 우선 처리 (pagination)
  const salesData = await fetchAllRows<SalesRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, amount, source')
      .gte('date', sinceStr)
      .order('date')
      .range(from, to)
  )

  // 지출 (monthly_expenses — date 컬럼 있는 것만, excluded 카테고리는 집계 제외)
  const expenseData = await fetchAllRows<ExpenseRow>((from, to) =>
    supabase
      .from('monthly_expenses')
      .select('date, amount')
      .gte('date', sinceStr)
      .not('date', 'is', null)
      .neq('category', 'excluded')
      .order('date')
      .range(from, to)
  )

  // 날짜별로 pos/bank 분리 집계
  const incomeByDate: Record<string, { pos: number; bank: number }> = {}
  for (const row of salesData) {
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

  for (const row of expenseData) {
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
