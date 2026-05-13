import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'
import {
  getBankIncomeAdjustmentDelta,
  getAllTimeBankIncomeAdjustmentDelta,
  getYearlyBankIncomeAdjustmentByMonth,
} from './adjustments'

// 통장 입금 = 카페 통장에 실제 들어온 돈 (raw bank_income 테이블) + 수동 조정(bank_income 타입)
// POS '매출'과 별개 지표 (카드 정산 지연 / 선불카드 차감 때문에 갭이 정상)

type Row = { date: string; amount: number }

// 월별 통장 입금 합계 (조정 포함)
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
  const base = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  // 월 마지막 날짜까지 포함하려면 endDate exclusive이므로 startDate~(endDate-1) lte 변환
  const lastDateOfMonth = new Date(endYear, endMonth - 1, 0).getDate()
  const inclusiveEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDateOfMonth).padStart(2, '0')}`
  const adj = await getBankIncomeAdjustmentDelta(startDate, inclusiveEnd)
  return base + adj
}

// 전체 누적 통장 입금 (조정 포함)
export async function getAllTimeBankIncome(): Promise<number> {
  const supabase = createServerClient()
  const rows = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('bank_income')
      .select('amount')
      .range(from, to),
  )
  const base = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const adj = await getAllTimeBankIncomeAdjustmentDelta()
  return base + adj
}

// 연간 월별 통장 입금 (1~12월) — /profit 연간 표용. 조정 포함.
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
  const adjByMonth = await getYearlyBankIncomeAdjustmentByMonth(year)
  for (const [m, v] of Object.entries(adjByMonth)) {
    const mi = Number(m)
    byMonth[mi] = (byMonth[mi] ?? 0) + v
  }
  return byMonth
}

// 날짜 범위 합계 — 주간용 (조정 포함)
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
  const base = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const adj = await getBankIncomeAdjustmentDelta(startDate, endDate)
  return base + adj
}
