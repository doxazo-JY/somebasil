import { createServerClient } from '../server'

// 월별 요약 (monthly_summary)
export async function getMonthlySummary(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// 연도별 전체 월 요약 (트렌드 차트용)
export async function getYearlySummary(year: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true })

  if (error) throw error
  return data ?? []
}

// 월별 지출 카테고리 합계 (도넛 차트용)
export async function getMonthlyExpensesByCategory(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('category, amount')
    .eq('year', year)
    .eq('month', month)

  if (error) throw error
  return data ?? []
}

// 월별 카테고리별 매출 합계 (daily_sales 집계)
export async function getMonthlySalesByCategory(year: number, month: number) {
  const supabase = createServerClient()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('daily_sales')
    .select('category, amount')
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw error
  return data ?? []
}

// 전체 기간 누적 합계 (연도 무관)
export async function getAllTimeSummary() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_summary')
    .select('income, total_expense, profit')

  if (error) throw error
  return data ?? []
}

// 이번 달 메모
export async function getMemo(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// 메모 저장 (upsert)
export async function upsertMemo(year: number, month: number, content: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('memos')
    .upsert({ year, month, content }, { onConflict: 'year,month' })

  if (error) throw error
}
