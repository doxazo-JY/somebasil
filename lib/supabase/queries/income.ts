import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'
import { normalizeProductName } from '@/lib/menu-utils'

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

// 단일 일자 매출 합계 (어제/전주同曜 비교용)
export async function getSalesTotalForDate(dateStr: string): Promise<number> {
  const supabase = createServerClient()
  const data = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('daily_sales')
      .select('amount')
      .eq('date', dateStr)
      .range(from, to),
  )
  return data.reduce((s, r) => s + (r.amount ?? 0), 0)
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
    // 핫/아이스 suffix 정규화 후 같은 메뉴끼리 합산
    const display = normalizeProductName(r.product_name, r.category)
    const key = `${r.category}|${display}`
    const curr = agg.get(key) ?? {
      product_name: display,
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
