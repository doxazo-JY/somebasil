import GuideLink from '@/components/ui/GuideLink'
import BreakEvenCards from '@/components/diagnosis/BreakEvenCards'
import LeverTable from '@/components/diagnosis/LeverTable'
import ProfitTargetTable from '@/components/diagnosis/ProfitTargetTable'
import CustomerAovChart from '@/components/diagnosis/CustomerAovChart'
import CalcBasisNote from '@/components/diagnosis/CalcBasisNote'
import UnavailableList from '@/components/diagnosis/UnavailableList'
import HourlyLaborSection from '@/components/diagnosis/HourlyLaborSection'
import { getDiagnosisMonths } from '@/lib/supabase/queries/diagnosis'
import { getHourlyLaborEfficiency } from '@/lib/supabase/queries/labor'
import { buildBaseline, diagnose, profitTargets } from '@/lib/diagnosis-calc'
import { buildTimesheet, getPayRates, getSourcePriority } from '@/lib/supabase/queries/attendance-admin'
import LaborBasisNote, { type LaborSource } from '@/components/diagnosis/LaborBasisNote'

// 기준 기간 — 최근 3개월 평균 (한 달 튀는 값에 덜 흔들리게)
const BASELINE_MONTHS = 3

const TARGETS = [
  { label: '손익분기', profit: 0 },
  { label: '월 300만 이익', profit: 3_000_000 },
  { label: '월 500만 이익', profit: 5_000_000 },
]

// 손익 > 흑자 조건 (예전 /diagnosis) — 손익분기 · 하루 필요 고객 · 목표 이익 · 고객수×객단가 · 시간대별 알바
export default async function DiagnosisView() {
  const [months, hourlyLabor] = await Promise.all([
    getDiagnosisMonths(),
    getHourlyLaborEfficiency(BASELINE_MONTHS),
  ])
  // 인건비는 "그 달에 일한 만큼" — 직원 화면 계산(근무 기록 + 고정급·주휴)이 있는 달은 그 값,
  // 근무 기록이 없는 달만 통장 급여 (통장 급여는 보통 다음 달 10일쯤 나가서 한 달씩 밀림)
  const bankBaseline = buildBaseline(months, BASELINE_MONTHS)
  const [rates, priority] = await Promise.all([getPayRates(), getSourcePriority()])
  const laborSources: LaborSource[] = await Promise.all(
    (bankBaseline?.months ?? []).map(async ({ year, month }) => {
      const bank = months.find((m) => m.year === year && m.month === month)?.labor ?? 0
      const ts = await buildTimesheet(year, month, { rates, priority })
      return ts.shifts.length > 0 ? { year, month, amount: ts.total, source: 'work' as const, bank } : { year, month, amount: bank, source: 'bank' as const, bank }
    })
  )
  const adjusted = months.map((m) => {
    const l = laborSources.find((x) => x.year === m.year && x.month === m.month)
    return l ? { ...m, labor: l.amount } : m
  })
  const baseline = buildBaseline(adjusted, BASELINE_MONTHS)
  const result = baseline ? diagnose(baseline) : null
  const bankResult = bankBaseline ? diagnose(bankBaseline) : null

  const trend = months
    .filter((m) => m.operatingDays > 0 && m.orderCount > 0)
    .map((m) => ({
      year: m.year,
      month: m.month,
      dailyCustomers: m.orderCount / m.operatingDays,
      aov: m.posSales / m.orderCount, // 객단가는 POS 매출 그대로 (수동 조정 제외)
    }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">흑자 조건 — 하루 몇 명이 와야 할까?<GuideLink id="profit" /></h1>
        <p className="text-sm text-gray-400 mt-0.5">
          운영 {months.length}개월 데이터 기준 손익분기 · 고객 수 × 객단가 · 목표 이익
        </p>
      </div>

      {baseline && result ? (
        <>
          <BreakEvenCards baseline={baseline} result={result} />
          <LaborBasisNote sources={laborSources} breakEven={result.breakEvenSales} bankBreakEven={bankResult?.breakEvenSales ?? null} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
            <LeverTable baseline={baseline} result={result} />
            <ProfitTargetTable
              targets={profitTargets(baseline, result, TARGETS)}
              currentDailySales={result.dailySales}
            />
          </div>
        </>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-5 mb-4 text-sm text-gray-500">
          매출과 통장 지출이 모두 올라온 마감 월이 없어 손익분기를 계산할 수 없습니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        {trend.length > 0 && <CustomerAovChart data={trend} />}
        {baseline && <CalcBasisNote baseline={baseline} />}
      </div>

      {hourlyLabor && (
        <div className="mb-4">
          <HourlyLaborSection data={hourlyLabor} />
        </div>
      )}

      <UnavailableList />
    </div>
  )
}
