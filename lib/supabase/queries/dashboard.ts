import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

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

// 월별 지출 카테고리 합계 (도넛 차트용, excluded 제외)
export async function getMonthlyExpensesByCategory(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('category, amount')
    .eq('year', year)
    .eq('month', month)
    .neq('category', 'excluded')

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

  const data = await fetchAllRows<{ category: string; amount: number }>((from, to) =>
    supabase
      .from('daily_sales')
      .select('category, amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date')
      .range(from, to)
  )
  return data
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

// 가장 최근 업로드 일자 (file_type별)
// 데이터 신선도 알림용 — 통장 거래내역 며칠 전 업로드인지 등
export async function getLatestUploadDate(fileType: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('upload_history')
    .select('uploaded_at')
    .eq('file_type', fileType)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.uploaded_at ?? null
}

// 연간 월별 메모 일괄 조회 — /profit 월별 표 코멘트용
export async function getMemosForYear(year: number): Promise<Record<number, string>> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('memos')
    .select('month, content')
    .eq('year', year)

  if (error) throw error
  const result: Record<number, string> = {}
  for (const row of data ?? []) {
    if (row.content) result[row.month] = row.content
  }
  return result
}

// 메모 저장 (upsert)
export async function upsertMemo(year: number, month: number, content: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('memos')
    .upsert({ year, month, content }, { onConflict: 'year,month' })

  if (error) throw error
}
