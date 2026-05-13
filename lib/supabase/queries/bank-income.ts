import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// 통장 입금 = 카페 통장에 실제 들어온 돈
// POS '매출'과 별개 지표 (카드 정산 지연 / 선불카드 차감 때문에 갭이 정상)

type Row = { date: string; amount: number }

// 월별 통장 입금 합계
export async function getMonthlyBankIncome(year: number, month: number): Promise<number> {
  const supabase = createServerClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from('bank_income')
      .select('date, amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .range(from, to),
  )
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0)
}

// 전체 누적 통장 입금
export async function getAllTimeBankIncome(): Promise<number> {
  const supabase = createServerClient()
  const rows = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('bank_income')
      .select('amount')
      .range(from, to),
  )
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0)
}

// 연간 월별 통장 입금 (1~12월) — /profit 연간 표용
export async function getYearlyBankIncomeByMonth(year: number): Promise<Record<number, number>> {
  const supabase = createServerClient()
  const startDate = `${year}-01-01`
  const endDate = `${year + 1}-01-01`

  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from('bank_income')
      .select('date, amount')
      .gte('date', startDate)
      .lt('date', endDate)
      .range(from, to),
  )
  const byMonth: Record<number, number> = {}
  for (const r of rows) {
    const m = Number(r.date.slice(5, 7))
    byMonth[m] = (byMonth[m] ?? 0) + (r.amount ?? 0)
  }
  return byMonth
}

// 날짜 범위 합계 — 주간용
export async function getBankIncomeForRange(startDate: string, endDate: string): Promise<number> {
  const supabase = createServerClient()
  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from('bank_income')
      .select('date, amount')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(from, to),
  )
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0)
}
