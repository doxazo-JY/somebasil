import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

type DailySaleRow = { date: string; category: string; amount: number }
type ProductRow = {
  date: string
  order_id: string | null
  product_name: string | null
  category: string
  quantity: number | null
  amount: number
}

export type ProductAgg = {
  product_name: string
  category: string
  quantity: number
  amount: number
}

function monthRange(year: number, month: number, maxDay?: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  if (maxDay) {
    // maxDay까지 포함 → 다음 날을 exclusive endDate로
    const d = new Date(year, month - 1, maxDay + 1)
    const endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
    return { startDate, endDate }
  }
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  return { startDate, endDate }
}

// 부분월 매출 합계 (1일 ~ maxDay까지 daily_sales 직접 집계)
// 전월 동기간比 비교용 — 예: 이번달이 4/16까지라면 전월도 3/1~3/16만
export async function getPartialMonthIncome(year: number, month: number, maxDay: number) {
  const supabase = createServerClient()
  const { startDate, endDate } = monthRange(year, month, maxDay)

  const rows = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('daily_sales')
      .select('amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('source', 'pos')
      .range(from, to)
  )
  return rows.reduce((s, r) => s + r.amount, 0)
}

// 월별 매출 합계 (monthly_summary)
export async function getMonthlyIncome(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('income')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.income ?? 0
}

// 연도별 월별 매출 추이 (라인차트용)
export async function getYearlyIncomeTrend(year: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('month, income')
    .eq('year', year)
    .order('month', { ascending: true })

  if (error) throw error
  return data ?? []
}

// 선택한 월 일별 매출 (달력 히트맵용)
export async function getDailySales(year: number, month: number, maxDay?: number) {
  const supabase = createServerClient()

  const { startDate, endDate } = monthRange(year, month, maxDay)

  const data = await fetchAllRows<DailySaleRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, category, amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true })
      .range(from, to)
  )
  return data
}

// 선택한 월 카테고리별 매출 합계 (도넛차트용)
export async function getMonthlySalesByCategory(year: number, month: number) {
  const data = await getDailySales(year, month)

  // 카테고리별 합산
  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + row.amount
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

// 상품 단위 월별 집계 (BEST 10, 드릴다운용)
export async function getMonthlyProductSales(
  year: number,
  month: number,
  maxDay?: number,
): Promise<ProductAgg[]> {
  const supabase = createServerClient()
  const { startDate, endDate } = monthRange(year, month, maxDay)

  const rows = await fetchAllRows<ProductRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, order_id, product_name, category, quantity, amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .eq('source', 'pos')
      .range(from, to)
  )

  const agg = new Map<string, ProductAgg>()
  for (const r of rows) {
    if (!r.product_name) continue
    const key = r.product_name
    const curr = agg.get(key) ?? {
      product_name: r.product_name,
      category: r.category,
      quantity: 0,
      amount: 0,
    }
    curr.quantity += r.quantity ?? 0
    curr.amount += r.amount
    agg.set(key, curr)
  }
  return [...agg.values()].sort((a, b) => b.amount - a.amount)
}

// 연간 월별 객단가 추이 (이익 페이지 차트용)
export interface MonthlyAOVPoint {
  month: number
  aov: number
  orderCount: number
  total: number
}

export async function getYearlyAOVTrend(year: number): Promise<MonthlyAOVPoint[]> {
  const supabase = createServerClient()
  const startDate = `${year}-01-01`
  const endDate = `${year + 1}-01-01`

  const rows = await fetchAllRows<{ date: string; order_id: string | null; amount: number }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('date, order_id, amount')
        .gte('date', startDate)
        .lt('date', endDate)
        .eq('source', 'pos')
        .range(from, to)
  )

  // 월별 집계
  const byMonth = new Map<number, { orders: Set<string>; total: number }>()
  for (const r of rows) {
    const m = Number(r.date.slice(5, 7))
    const entry = byMonth.get(m) ?? { orders: new Set<string>(), total: 0 }
    if (r.order_id) entry.orders.add(`${r.date}|${r.order_id}`)
    entry.total += r.amount
    byMonth.set(m, entry)
  }

  const result: MonthlyAOVPoint[] = []
  for (let m = 1; m <= 12; m++) {
    const entry = byMonth.get(m)
    const orderCount = entry?.orders.size ?? 0
    const total = entry?.total ?? 0
    result.push({
      month: m,
      orderCount,
      total,
      aov: orderCount > 0 ? Math.round(total / orderCount) : 0,
    })
  }
  return result
}

// 월별 객단가 (AOV = 총매출 / 주문 건수)
// maxDay가 주어지면 해당 일까지만 포함 (전월 동기간比 용)
export async function getMonthlyAOV(year: number, month: number, maxDay?: number) {
  const supabase = createServerClient()
  const { startDate, endDate } = monthRange(year, month, maxDay)

  const rows = await fetchAllRows<{ date: string; order_id: string | null; amount: number }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('date, order_id, amount')
        .gte('date', startDate)
        .lt('date', endDate)
        .eq('source', 'pos')
        .range(from, to)
  )

  const orders = new Set<string>()
  let total = 0
  for (const r of rows) {
    if (r.order_id) orders.add(`${r.date}|${r.order_id}`)
    total += r.amount
  }
  return {
    total,
    orderCount: orders.size,
    aov: orders.size > 0 ? Math.round(total / orders.size) : 0,
  }
}
