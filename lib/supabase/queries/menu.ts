import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// ─────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────
type RawRow = {
  date: string
  order_id: string | null
  product_name: string | null
  category: string
  quantity: number | null
  amount: number
  order_time: string | null
}

// ─────────────────────────────────────────────
// 전체 POS 데이터 (기간 필터)
// ─────────────────────────────────────────────
async function fetchPosRows(sinceDate: string): Promise<RawRow[]> {
  const supabase = createServerClient()
  return fetchAllRows<RawRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, order_id, product_name, category, quantity, amount, order_time')
      .gte('date', sinceDate)
      .eq('source', 'pos')
      .order('date')
      .range(from, to),
  )
}

// ─────────────────────────────────────────────
// 요일 × 시간대 히트맵
// 요일: 0=일 ~ 6=토, 시간대: 0~23시
// ─────────────────────────────────────────────
export interface HeatmapCell {
  weekday: number
  hour: number
  amount: number
  orderCount: number
}

export async function getWeekdayHourHeatmap(sinceDate: string): Promise<HeatmapCell[]> {
  const rows = await fetchPosRows(sinceDate)

  // (weekday, hour, order_id) 단위로 집계
  const amountMap = new Map<string, number>()
  const orderMap = new Map<string, Set<string>>()

  for (const r of rows) {
    if (!r.order_time) continue
    const t = new Date(r.order_time)
    const weekday = t.getDay()
    const hour = t.getHours()
    const key = `${weekday}|${hour}`

    amountMap.set(key, (amountMap.get(key) ?? 0) + r.amount)

    const orderSet = orderMap.get(key) ?? new Set<string>()
    if (r.order_id) orderSet.add(`${r.date}|${r.order_id}`)
    orderMap.set(key, orderSet)
  }

  const result: HeatmapCell[] = []
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      const key = `${w}|${h}`
      result.push({
        weekday: w,
        hour: h,
        amount: amountMap.get(key) ?? 0,
        orderCount: orderMap.get(key)?.size ?? 0,
      })
    }
  }
  return result
}

// ─────────────────────────────────────────────
// 월별 카테고리 믹스 (stacked area chart용)
// ─────────────────────────────────────────────
export interface CategoryMixRow {
  yearMonth: string // "2026-03"
  [category: string]: number | string
}

export async function getMonthlyCategoryMix(sinceDate: string): Promise<{
  data: CategoryMixRow[]
  categories: string[]
}> {
  const rows = await fetchPosRows(sinceDate)

  // (yyyy-mm, category) → amount
  const agg = new Map<string, Map<string, number>>()
  const catSet = new Set<string>()

  for (const r of rows) {
    const ym = r.date.slice(0, 7)
    const cat = r.category
    catSet.add(cat)
    const inner = agg.get(ym) ?? new Map<string, number>()
    inner.set(cat, (inner.get(cat) ?? 0) + r.amount)
    agg.set(ym, inner)
  }

  const categories = [...catSet].sort()
  const data: CategoryMixRow[] = [...agg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, inner]) => {
      const row: CategoryMixRow = { yearMonth: ym }
      for (const cat of categories) {
        row[cat] = inner.get(cat) ?? 0
      }
      return row
    })

  return { data, categories }
}

// ─────────────────────────────────────────────
// Hot / Ice 비율 월별
// ─────────────────────────────────────────────
export interface HotIceRow {
  yearMonth: string
  hot: number
  ice: number
  other: number
}

export async function getMonthlyHotIceRatio(sinceDate: string): Promise<HotIceRow[]> {
  const rows = await fetchPosRows(sinceDate)

  const agg = new Map<string, HotIceRow>()

  for (const r of rows) {
    if (!r.product_name) continue
    const ym = r.date.slice(0, 7)
    const row = agg.get(ym) ?? { yearMonth: ym, hot: 0, ice: 0, other: 0 }
    const name = r.product_name
    // 음료 성격 상품만 (디저트/etc 제외)
    const isDrink =
      r.category === 'coffee' ||
      r.category === 'matcha' ||
      r.category === 'ade' ||
      r.category === 'tea' ||
      r.category === 'beverage' ||
      r.category === 'drip_coffee' ||
      r.category === 'dutch_coffee' ||
      r.category === 'season'
    if (!isDrink) continue

    if (/\(HOT\)|\bHOT\b/i.test(name)) row.hot += r.quantity ?? 0
    else if (/\(ICE\)|\bICE\b/i.test(name)) row.ice += r.quantity ?? 0
    else row.other += r.quantity ?? 0

    agg.set(ym, row)
  }

  return [...agg.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

// ─────────────────────────────────────────────
// 죽은 메뉴 리스트 (최근 기간 내 저조한 판매)
// sinceDate 이후 기간 동안 qty < threshold 인 상품
// ─────────────────────────────────────────────
export interface DeadMenu {
  product_name: string
  category: string
  quantity: number
  amount: number
  lastSoldDate: string | null
  daysSinceLastSold: number | null
}

export async function getDeadMenus(
  sinceDate: string,
  options: { qtyThreshold?: number; limit?: number } = {},
): Promise<DeadMenu[]> {
  const { qtyThreshold = 10, limit = 30 } = options
  const rows = await fetchPosRows(sinceDate)

  const agg = new Map<string, DeadMenu>()
  for (const r of rows) {
    if (!r.product_name) continue
    // 기타 / 조정 항목 제외
    if (r.category === 'etc') continue

    const key = r.product_name
    const curr = agg.get(key) ?? {
      product_name: r.product_name,
      category: r.category,
      quantity: 0,
      amount: 0,
      lastSoldDate: null as string | null,
      daysSinceLastSold: null as number | null,
    }
    curr.quantity += r.quantity ?? 0
    curr.amount += r.amount
    if (!curr.lastSoldDate || r.date > curr.lastSoldDate) {
      curr.lastSoldDate = r.date
    }
    agg.set(key, curr)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const m of agg.values()) {
    if (m.lastSoldDate) {
      const d = new Date(m.lastSoldDate)
      m.daysSinceLastSold = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  return [...agg.values()]
    .filter((m) => m.quantity < qtyThreshold)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, limit)
}
