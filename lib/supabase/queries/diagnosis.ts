import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// 수익 진단용 월별 데이터 — 매출 / 고객(주문) 수 / 영업일 / 비용 구조
// 고정비·변동비 분리 기준:
//   변동비 = 재료비(현금+카드) — 팔수록 늘어나는 돈
//   고정비 = 인건비 + 고정비 — 안 팔아도 나가는 돈
//   설비투자(equipment)는 일회성이라 손익분기 계산에서 제외

export interface DiagnosisMonth {
  year: number
  month: number
  /** POS 매출 (daily_sales 합계) */
  sales: number
  /** 주문(영수증) 건수 — 고객 수의 근사치 */
  orderCount: number
  /** 매출이 있었던 날 수 */
  operatingDays: number
  /** 변동비 = 재료비(현금+카드) */
  variableCost: number
  labor: number
  fixed: number
  equipment: number
}

function monthStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function nextMonthStart(year: number, month: number) {
  return month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1)
}

// 한 달치 POS 라인 → 매출 / 주문 수 / 영업일
async function getMonthSalesStats(year: number, month: number) {
  const supabase = createServerClient()
  const rows = await fetchAllRows<{ date: string; order_id: string | null; amount: number }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('date, order_id, amount')
        .gte('date', monthStart(year, month))
        .lt('date', nextMonthStart(year, month))
        .eq('source', 'pos')
        .range(from, to),
  )

  const orders = new Set<string>()
  const days = new Set<string>()
  let sales = 0
  for (const r of rows) {
    if (r.order_id) orders.add(`${r.date}|${r.order_id}`)
    if (r.amount > 0) days.add(r.date)
    sales += r.amount
  }
  return { sales, orderCount: orders.size, operatingDays: days.size }
}

// KST 기준 현재 연/월
function kstNowYearMonth() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1 }
}

// 마감된 월(이번 달 제외) 전체 — 오래된 순
export async function getDiagnosisMonths(): Promise<DiagnosisMonth[]> {
  const supabase = createServerClient()
  const now = kstNowYearMonth()
  const nowKey = now.year * 12 + now.month

  const [summaryRes, expenseRows] = await Promise.all([
    supabase.from('monthly_summary').select('year, month, income'),
    fetchAllRows<{ year: number; month: number; category: string; amount: number }>(
      (from, to) =>
        supabase
          .from('monthly_expenses')
          .select('year, month, category, amount')
          .neq('category', 'excluded')
          .range(from, to),
    ),
  ])
  if (summaryRes.error) throw summaryRes.error

  // 매출 있는 마감 월만
  const months = (summaryRes.data ?? [])
    .filter((r) => r.income > 0 && r.year * 12 + r.month < nowKey)
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // 월별 카테고리 합계
  const expByKey = new Map<string, Record<string, number>>()
  for (const r of expenseRows) {
    const key = `${r.year}-${r.month}`
    const acc = expByKey.get(key) ?? {}
    acc[r.category] = (acc[r.category] ?? 0) + r.amount
    expByKey.set(key, acc)
  }

  const stats = await Promise.all(months.map((m) => getMonthSalesStats(m.year, m.month)))

  return months.map((m, i) => {
    const exp = expByKey.get(`${m.year}-${m.month}`) ?? {}
    return {
      year: m.year,
      month: m.month,
      ...stats[i],
      variableCost: (exp.ingredients_cash ?? 0) + (exp.ingredients_card ?? 0),
      labor: exp.labor ?? 0,
      fixed: exp.fixed ?? 0,
      equipment: exp.equipment ?? 0,
    }
  })
}
