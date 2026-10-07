import type { DiagnosisMonth } from '@/lib/supabase/queries/diagnosis'

// 수익 진단 계산 — 순수 함수 (DB 의존 없음)
// 손익분기 매출 = 월 고정비 ÷ (1 − 변동비율)

export interface DiagnosisBaseline {
  /** 기준 기간에 포함된 월 (라벨용) */
  months: { year: number; month: number }[]
  /** 이하 전부 기준 기간 월평균 */
  sales: number
  /** POS 매출 그대로 — 객단가용 */
  posSales: number
  variableCost: number
  labor: number
  fixed: number
  equipment: number
  orderCount: number
  operatingDays: number
}

export interface DiagnosisResult {
  fixedCost: number
  /** 변동비율 (0~1) */
  variableRatio: number
  /** 영업이익 (설비투자 제외) */
  operatingProfit: number
  /** 손익분기 월매출 — 공헌이익률이 0 이하면 null (어떤 매출로도 흑자 불가) */
  breakEvenSales: number | null
  dailySales: number
  dailyCustomers: number
  aov: number
  breakEvenDailySales: number | null
  breakEvenDailyCustomers: number | null
  /** 고객 수 그대로일 때 필요한 객단가 */
  requiredAov: number | null
  /** 매출 그대로일 때 허용 가능한 최대 원가율 (음수면 원가 0이어도 불가) */
  requiredVariableRatio: number | null
  /** 매출 그대로일 때 고정비를 얼마까지 줄여야 하는지 */
  requiredFixedCost: number
}

export interface ProfitTarget {
  label: string
  profit: number
  monthlySales: number | null
  dailySales: number | null
  dailyCustomers: number | null
}

// 비용 데이터까지 올라온 최근 N개월 평균 (비용 0인 월 = 통장 미업로드로 간주, 제외)
export function buildBaseline(months: DiagnosisMonth[], count = 3): DiagnosisBaseline | null {
  const usable = months.filter(
    (m) => m.sales > 0 && m.variableCost + m.labor + m.fixed > 0 && m.operatingDays > 0,
  )
  const picked = usable.slice(-count)
  if (picked.length === 0) return null

  const avg = (f: (m: DiagnosisMonth) => number) =>
    picked.reduce((s, m) => s + f(m), 0) / picked.length

  return {
    months: picked.map(({ year, month }) => ({ year, month })),
    sales: avg((m) => m.sales),
    posSales: avg((m) => m.posSales),
    variableCost: avg((m) => m.variableCost),
    labor: avg((m) => m.labor),
    fixed: avg((m) => m.fixed),
    equipment: avg((m) => m.equipment),
    orderCount: avg((m) => m.orderCount),
    operatingDays: avg((m) => m.operatingDays),
  }
}

export function diagnose(b: DiagnosisBaseline): DiagnosisResult {
  const fixedCost = b.labor + b.fixed
  const variableRatio = b.sales > 0 ? b.variableCost / b.sales : 0
  const contribution = 1 - variableRatio
  const breakEvenSales = contribution > 0 ? fixedCost / contribution : null

  const days = b.operatingDays
  const dailySales = b.sales / days
  const dailyCustomers = b.orderCount / days
  const aov = b.orderCount > 0 ? b.posSales / b.orderCount : 0

  const breakEvenDailySales = breakEvenSales !== null ? breakEvenSales / days : null

  return {
    fixedCost,
    variableRatio,
    operatingProfit: b.sales - b.variableCost - fixedCost,
    breakEvenSales,
    dailySales,
    dailyCustomers,
    aov,
    breakEvenDailySales,
    breakEvenDailyCustomers:
      breakEvenDailySales !== null && aov > 0 ? breakEvenDailySales / aov : null,
    requiredAov:
      breakEvenSales !== null && b.orderCount > 0 ? breakEvenSales / b.orderCount : null,
    requiredVariableRatio: b.sales > 0 ? 1 - fixedCost / b.sales : null,
    requiredFixedCost: b.sales * contribution,
  }
}

// 목표 순이익별 필요 매출 — (고정비 + 목표이익) ÷ (1 − 변동비율)
export function profitTargets(
  b: DiagnosisBaseline,
  r: DiagnosisResult,
  targets: { label: string; profit: number }[],
): ProfitTarget[] {
  const contribution = 1 - r.variableRatio
  return targets.map(({ label, profit }) => {
    const monthlySales = contribution > 0 ? (r.fixedCost + profit) / contribution : null
    const dailySales = monthlySales !== null ? monthlySales / b.operatingDays : null
    return {
      label,
      profit,
      monthlySales,
      dailySales,
      dailyCustomers: dailySales !== null && r.aov > 0 ? dailySales / r.aov : null,
    }
  })
}
