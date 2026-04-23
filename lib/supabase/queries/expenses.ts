import { createServerClient } from '../server'

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
      card: byMonth[m]?.card ?? 0,
    }
  }).filter((d) => Object.values(d).some((v, i) => i > 0 && v > 0)) // 데이터 있는 월만
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
