import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// 월별 지출 카테고리별 합계 (excluded 제외)
export async function getMonthlyExpensesByCategory(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('category, amount')
    .eq('year', year)
    .eq('month', month)
    .neq('category', 'excluded')

  if (error) throw error

  const grouped = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + row.amount
    return acc
  }, {})

  // 재료비(현금)/재료비(카드) 합산을 `ingredients`로도 노출 (기존 호환)
  grouped.ingredients = (grouped.ingredients_cash ?? 0) + (grouped.ingredients_card ?? 0)
  return grouped
}

// 연도별 월별 카테고리별 지출 추이 (라인차트용, excluded 제외)
export async function getYearlyExpenseTrend(year: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('month, category, amount')
    .eq('year', year)
    .neq('category', 'excluded')
    .order('month', { ascending: true })

  if (error) throw error

  // 월별로 카테고리 합산
  const byMonth: Record<number, Record<string, number>> = {}
  for (const row of data ?? []) {
    if (!byMonth[row.month]) byMonth[row.month] = {}
    byMonth[row.month][row.category] = (byMonth[row.month][row.category] ?? 0) + row.amount
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const cash = byMonth[m]?.ingredients_cash ?? 0
    const card_ing = byMonth[m]?.ingredients_card ?? 0
    return {
      month: m,
      ingredients_cash: cash,
      ingredients_card: card_ing,
      ingredients: cash + card_ing, // 합계 (원가율 등 기존 소비처 호환)
      labor: byMonth[m]?.labor ?? 0,
      fixed: byMonth[m]?.fixed ?? 0,
      equipment: byMonth[m]?.equipment ?? 0,
    }
  }).filter((d) => Object.values(d).some((v, i) => i > 0 && v > 0)) // 데이터 있는 월만
}

// 거래처별 재료비 누적 (이번 달 + YTD)
// monthly_expenses.item(=memo)에서 알려진 공급처 이름으로 매칭
// (DB에 counterpart 컬럼 없어서 memo 기반 — 새 공급처는 SUPPLIERS 추가 필요)
export const SUPPLIERS = [
  { name: '홍인호', label: '홍인호 (원두)' },
  { name: '김인성', label: '김인성 (말차)' },
  { name: '한성욱', label: '한성욱 (우유)' },
  { name: '소금집', label: '주식회사 소금집 (햄)' },
] as const

export interface SupplierRow {
  label: string
  monthly: number
  ytd: number
}

export async function getSupplierTotals(year: number, month: number): Promise<SupplierRow[]> {
  const supabase = createServerClient()
  const rows = await fetchAllRows<{
    year: number
    month: number
    item: string
    counterpart: string | null
    amount: number
  }>((from, to) =>
    supabase
      .from('monthly_expenses')
      .select('year, month, item, counterpart, amount')
      .eq('year', year)
      .in('category', ['ingredients_cash', 'ingredients_card'])
      .range(from, to),
  )

  const byLabel = new Map<string, { monthly: number; ytd: number }>()
  for (const r of rows) {
    // counterpart 우선 매칭 (정확). 누락 시 item(memo) fallback (재업로드 전 legacy).
    const cp = r.counterpart ?? ''
    const item = r.item ?? ''
    const supplier = SUPPLIERS.find(
      (s) => cp.includes(s.name) || item.includes(s.name),
    )
    if (!supplier) continue
    const curr = byLabel.get(supplier.label) ?? { monthly: 0, ytd: 0 }
    curr.ytd += r.amount
    if (r.month === month) curr.monthly += r.amount
    byLabel.set(supplier.label, curr)
  }

  return [...byLabel.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.ytd - a.ytd)
}

// 월별 인건비 항목 목록 (monthly_expenses.labor) — 실제 지출 기준
export async function getMonthlyLaborDetail(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('id, item, amount')
    .eq('year', year)
    .eq('month', month)
    .eq('category', 'labor')
    .order('amount', { ascending: false })

  if (error) throw error
  return data ?? []
}

// 월별 전체 거래 목록 (재분류 UI용, excluded 포함)
export async function getMonthlyAllTransactions(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('id, date, category, item, amount')
    .eq('year', year)
    .eq('month', month)
    .order('amount', { ascending: false })

  if (error) throw error
  return data ?? []
}

// 월별 카테고리별 항목 상세 (고정비/재료비 breakdown용, excluded 제외)
export async function getMonthlyExpenseItems(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('id, category, item, amount')
    .eq('year', year)
    .eq('month', month)
    .neq('category', 'excluded')
    .order('amount', { ascending: false })

  if (error) throw error

  // 카테고리별로 그룹핑
  const grouped: Record<string, { id: string; item: string; amount: number }[]> = {}
  for (const row of data ?? []) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category].push({ id: row.id, item: row.item, amount: row.amount })
  }

  return grouped
}
