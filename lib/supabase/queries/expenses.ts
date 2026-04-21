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

  return grouped // { ingredients: 000, labor: 000, fixed: 000, card: 000 }
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
    return {
      month: m,
      ingredients: byMonth[m]?.ingredients ?? 0,
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
