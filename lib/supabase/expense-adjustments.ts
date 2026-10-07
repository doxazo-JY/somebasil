import type { createServerClient } from './server'

type Supabase = ReturnType<typeof createServerClient>

// 수동 조정(manual_adjustments, type='expense')을 카테고리별 지출에도 반영
// - monthly_summary(월 합계)는 recalc에서 이미 반영하지만, 카테고리 분해는 monthly_expenses를 직접 합산해서 빠져 있었음
//   (예: 4/2 "장장로님 400만원 상환" 제외 → 4월 재료비(카드)에 그대로 남아 있던 문제)
// - 조정에는 카테고리가 없으므로 같은 날짜·같은 금액의 지출 건을 찾아 그 카테고리에서 가감
// - 짝이 없으면 고정비(fixed)로 가감 — 월 합계와 카테고리 합이 어긋나지 않게

export interface ExpenseRowLite {
  year: number
  month: number
  date: string | null
  category: string
  amount: number
}

interface ExpenseAdjustment {
  date: string
  direction: 'add' | 'subtract'
  amount: number
}

export async function fetchExpenseAdjustments(
  supabase: Supabase,
  startDate?: string,
  endDate?: string,
): Promise<ExpenseAdjustment[]> {
  let q = supabase.from('manual_adjustments').select('date, direction, amount').eq('type', 'expense')
  if (startDate) q = q.gte('date', startDate)
  if (endDate) q = q.lt('date', endDate)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ExpenseAdjustment[]
}

// 조정분을 보정 행(음수/양수)으로 덧붙여 반환 — 호출 측은 기존처럼 category별 합산만 하면 됨
export function applyExpenseAdjustments<T extends ExpenseRowLite>(
  rows: T[],
  adjustments: ExpenseAdjustment[],
): ExpenseRowLite[] {
  const used = new Set<T>()
  const extra: ExpenseRowLite[] = []

  for (const adj of adjustments) {
    const [y, m] = adj.date.split('-').map(Number)
    const signed = adj.direction === 'add' ? adj.amount : -adj.amount
    const match =
      adj.direction === 'subtract'
        ? rows.find((r) => !used.has(r) && r.date === adj.date && r.amount === adj.amount)
        : undefined
    if (match) used.add(match)
    extra.push({
      year: y,
      month: m,
      date: adj.date,
      category: match?.category ?? 'fixed',
      amount: signed,
    })
  }

  return [...rows, ...extra]
}
