import { createServerClient } from '../server'

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
export async function getDailySales(year: number, month: number) {
  const supabase = createServerClient()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('daily_sales')
    .select('date, category, amount')
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: true })

  if (error) throw error
  return data ?? []
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
