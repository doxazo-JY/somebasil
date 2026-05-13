import { createServerClient } from '../server'

// type:
//   'income'      = POS 수입 (월 매출 보정 — recalc.ts에서 monthly_summary.income에 반영)
//   'bank_income' = 통장 수입 (통장 입금 보정 — bank-income 쿼리에 반영)
//   'expense'     = 통장 지출 (recalc.ts에서 monthly_summary.total_expense에 반영)
export type AdjustmentType = 'income' | 'bank_income' | 'expense'

export interface ManualAdjustment {
  id: number
  date: string
  type: AdjustmentType
  direction: 'add' | 'subtract'
  amount: number
  memo: string | null
  created_at: string
}

// 전체 조정 내역 (최신순)
export async function getManualAdjustments(): Promise<ManualAdjustment[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('manual_adjustments')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error
  return data ?? []
}

// 특정 월의 조정 합계 → { incomeDelta, bankIncomeDelta, expenseDelta }
export async function getMonthlyAdjustmentDelta(
  year: number,
  month: number,
): Promise<{ incomeDelta: number; bankIncomeDelta: number; expenseDelta: number }> {
  const supabase = createServerClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('manual_adjustments')
    .select('type, direction, amount')
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw error

  let incomeDelta = 0
  let bankIncomeDelta = 0
  let expenseDelta = 0
  for (const row of data ?? []) {
    const signed = row.direction === 'add' ? row.amount : -row.amount
    if (row.type === 'income') incomeDelta += signed
    else if (row.type === 'bank_income') bankIncomeDelta += signed
    else if (row.type === 'expense') expenseDelta += signed
  }
  return { incomeDelta, bankIncomeDelta, expenseDelta }
}

// 날짜 범위 내 통장 수입 조정 합계 — 주간 등 임의 범위용
export async function getBankIncomeAdjustmentDelta(
  startDate: string,
  endDate: string,
): Promise<number> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('manual_adjustments')
    .select('direction, amount')
    .eq('type', 'bank_income')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  let delta = 0
  for (const row of data ?? []) {
    delta += row.direction === 'add' ? row.amount : -row.amount
  }
  return delta
}

// 전체 누적 통장 수입 조정 합계
export async function getAllTimeBankIncomeAdjustmentDelta(): Promise<number> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('manual_adjustments')
    .select('direction, amount')
    .eq('type', 'bank_income')

  if (error) throw error
  let delta = 0
  for (const row of data ?? []) {
    delta += row.direction === 'add' ? row.amount : -row.amount
  }
  return delta
}

// 연도별 월별 통장 수입 조정 합계 (1~12월)
export async function getYearlyBankIncomeAdjustmentByMonth(
  year: number,
): Promise<Record<number, number>> {
  const supabase = createServerClient()
  const startDate = `${year}-01-01`
  const endDate = `${year + 1}-01-01`
  const { data, error } = await supabase
    .from('manual_adjustments')
    .select('date, direction, amount')
    .eq('type', 'bank_income')
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw error
  const byMonth: Record<number, number> = {}
  for (const row of data ?? []) {
    const m = Number(row.date.slice(5, 7))
    const signed = row.direction === 'add' ? row.amount : -row.amount
    byMonth[m] = (byMonth[m] ?? 0) + signed
  }
  return byMonth
}
