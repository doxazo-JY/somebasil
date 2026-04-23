import { createServerClient } from '../server'

export interface ManualAdjustment {
  id: number
  date: string
  type: 'income' | 'expense'
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

// 특정 월의 조정 합계 → { incomeDelta, expenseDelta }
export async function getMonthlyAdjustmentDelta(
  year: number,
  month: number,
): Promise<{ incomeDelta: number; expenseDelta: number }> {
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
  let expenseDelta = 0
  for (const row of data ?? []) {
    const signed = row.direction === 'add' ? row.amount : -row.amount
    if (row.type === 'income') incomeDelta += signed
    else expenseDelta += signed
  }
  return { incomeDelta, expenseDelta }
}
