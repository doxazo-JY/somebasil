import { createServerClient } from './server'
import { fetchAllRows } from './fetchAll'

// 월별 monthly_summary 재계산 유틸
// - income  = daily_sales (POS 우선) + 수동 수입 조정
// - expense = monthly_expenses (excluded는 항상 제외) + 수동 지출 조정
//
// monthly_expenses 변경 / manual_adjustments 변경 시 호출
// (대시보드와 /expenses 가 같은 total_expense를 보도록 단일 source-of-truth)
export async function recalcMonthlySummary(
  supabase: ReturnType<typeof createServerClient>,
  year: number,
  month: number,
): Promise<void> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  // 수입 — POS 우선 (날짜별 pos 있으면 pos만)
  const salesRows = await fetchAllRows<{ date: string; amount: number; source: string }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('date, amount, source')
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date')
        .range(from, to),
  )
  const byDate: Record<string, { pos: number; bank: number }> = {}
  for (const r of salesRows) {
    if (!byDate[r.date]) byDate[r.date] = { pos: 0, bank: 0 }
    if (r.source === 'pos') byDate[r.date].pos += r.amount
    else byDate[r.date].bank += r.amount
  }
  const baseIncome = Object.values(byDate).reduce(
    (sum, d) => sum + (d.pos > 0 ? d.pos : d.bank),
    0,
  )

  // 지출 — 'excluded' 카테고리는 항상 제외 (사용자 의도상 excluded = "지출 아님")
  // ※ 과거 include_owner_personal 토글로 분기했으나 사용자 혼란 야기로 제거.
  //    /expenses 페이지의 카테고리 직접 합산도 항상 excluded 제외로 동일.
  const expenseRows = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('monthly_expenses')
      .select('amount')
      .eq('year', year)
      .eq('month', month)
      .neq('category', 'excluded')
      .range(from, to),
  )
  const baseExpense = expenseRows.reduce((s, r) => s + (r.amount ?? 0), 0)

  // 수동 조정 합산
  const { data: adjRows } = await supabase
    .from('manual_adjustments')
    .select('type, direction, amount')
    .gte('date', startDate)
    .lt('date', endDate)

  let incomeDelta = 0
  let expenseDelta = 0
  for (const row of adjRows ?? []) {
    const signed = row.direction === 'add' ? row.amount : -row.amount
    if (row.type === 'income') incomeDelta += signed
    else expenseDelta += signed
  }

  const totalIncome = baseIncome + incomeDelta
  const totalExpense = baseExpense + expenseDelta

  // upsert
  const { data: existing } = await supabase
    .from('monthly_summary')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (existing) {
    await supabase
      .from('monthly_summary')
      .update({ income: totalIncome, total_expense: totalExpense })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('monthly_summary')
      .insert({ year, month, income: totalIncome, total_expense: totalExpense })
  }
}

// 데이터가 있는 모든 월 재계산 (대표 토글 변경 시 사용)
export async function recalcAllMonths(
  supabase: ReturnType<typeof createServerClient>,
): Promise<void> {
  const { data } = await supabase
    .from('monthly_summary')
    .select('year, month')
  for (const row of data ?? []) {
    await recalcMonthlySummary(supabase, row.year, row.month)
  }
}
