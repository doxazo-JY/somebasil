import { createServerClient } from '@/lib/supabase/server'
import { recalcMonthlySummary } from '@/lib/supabase/recalc'
import type { DailySalesRow } from './daily-sales'
import type { BankRow } from './bank'
import type { MenuRow } from './menu'

// 통합 업로드 저장 — 같은 파일을 다시 넣어도 중복되지 않음
//   매출: (date, order_id, line_no, source) 기준 덮어쓰기 (POS가 기준)
//   통장 입금: (tx_time, balance_after) 기준 덮어쓰기
//   통장 출금: 이미 있는 거래는 건드리지 않음 → 점장이 재분류한 카테고리가 다시 올려도 유지됨

type Supabase = ReturnType<typeof createServerClient>
const CHUNK = 500

async function recalcMonths(supabase: Supabase, dates: string[]) {
  const months = new Set(dates.map((d) => d.slice(0, 7)))
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number)
    await recalcMonthlySummary(supabase, y, m)
  }
}

export async function saveDailySales(rows: DailySalesRow[]) {
  const supabase = createServerClient()
  const withSource = rows.map((r) => ({ ...r, source: 'pos' }))
  for (let i = 0; i < withSource.length; i += CHUNK) {
    const { error } = await supabase.from('daily_sales').upsert(withSource.slice(i, i + CHUNK), { onConflict: 'date,order_id,line_no,source' })
    if (error) throw new Error(`매출 저장 실패: ${error.message}`)
  }
  await recalcMonths(supabase, rows.map((r) => r.date))
}

export type UncertainTx = { id: number; date: string; memo: string; counterpart: string; amount: number; category: string }

// 반환: 새로 들어간 출금 건수 + 그중 자동 분류가 애매한 것 (업로드 후 확인 목록)
export async function saveBank(rows: BankRow[]): Promise<{ newExpenses: number; incomes: number; uncertain: UncertainTx[] }> {
  const supabase = createServerClient()

  const incomes = rows
    .filter((r) => r.type === 'income')
    .map((r) => ({ date: r.date, tx_time: r.tx_time, balance_after: r.balance_after, memo: r.memo, counterpart: r.counterpart, amount: r.income ?? 0 }))
  for (let i = 0; i < incomes.length; i += CHUNK) {
    const { error } = await supabase.from('bank_income').upsert(incomes.slice(i, i + CHUNK), { onConflict: 'tx_time,balance_after' })
    if (error) throw new Error(`통장 입금 저장 실패: ${error.message}`)
  }

  const expenseRows = rows.filter((r) => r.type === 'expense')
  const expenses = expenseRows.map((r) => {
    const [year, month] = r.date.split('-').map(Number)
    return { year, month, date: r.date, tx_time: r.tx_time, balance_after: r.balance_after, category: r.category, item: r.memo, counterpart: r.counterpart, amount: r.expense ?? 0 }
  })
  const inserted: { id: number; tx_time: string; balance_after: number }[] = []
  for (let i = 0; i < expenses.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('monthly_expenses')
      .upsert(expenses.slice(i, i + CHUNK), { onConflict: 'tx_time,balance_after', ignoreDuplicates: true })
      .select('id, tx_time, balance_after')
    if (error) throw new Error(`통장 출금 저장 실패: ${error.message}`)
    inserted.push(...(data ?? []))
  }
  await recalcMonths(supabase, expenseRows.map((r) => r.date))

  // 새로 들어간 출금 중 애매한 것 (tx_time 표기가 달라도 같은 시각이면 같은 거래)
  const key = (t: string, b: number) => `${new Date(t).getTime()}|${b}`
  const newIds = new Map(inserted.map((r) => [key(r.tx_time, r.balance_after), r.id]))
  const uncertain: UncertainTx[] = []
  for (const r of expenseRows) {
    const id = newIds.get(key(r.tx_time, r.balance_after))
    if (id != null && r.uncertain) uncertain.push({ id, date: r.date, memo: r.memo, counterpart: r.counterpart, amount: r.expense ?? 0, category: r.category })
  }
  return { newExpenses: inserted.length, incomes: incomes.length, uncertain }
}

export async function saveMenu(rows: MenuRow[]) {
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const payload = rows.map((r) => ({ id: r.id, name: r.name, price: r.price, is_active: r.is_active, updated_at: now }))
  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabase.from('products').upsert(payload.slice(i, i + CHUNK), { onConflict: 'id' })
    if (error) throw new Error(`메뉴 저장 실패: ${error.message}`)
  }
}
