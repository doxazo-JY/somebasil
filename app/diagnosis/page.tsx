import PageTabs from '@/components/ui/PageTabs'
import BreakEvenCards from '@/components/diagnosis/BreakEvenCards'
import LeverTable from '@/components/diagnosis/LeverTable'
import ProfitTargetTable from '@/components/diagnosis/ProfitTargetTable'
import CustomerAovChart from '@/components/diagnosis/CustomerAovChart'
import CalcBasisNote from '@/components/diagnosis/CalcBasisNote'
import UnavailableList from '@/components/diagnosis/UnavailableList'
import { getDiagnosisMonths } from '@/lib/supabase/queries/diagnosis'
import { buildBaseline, diagnose, profitTargets } from '@/lib/diagnosis-calc'

export const dynamic = 'force-dynamic'

// 기준 기간 — 최근 3개월 평균 (한 달 튀는 값에 덜 흔들리게)
const BASELINE_MONTHS = 3

const TARGETS = [
  { label: '손익분기', profit: 0 },
  { label: '월 300만 이익', profit: 3_000_000 },
  { label: '월 500만 이익', profit: 5_000_000 },
]

export default async function DiagnosisPage() {
  const months = await getDiagnosisMonths()
  const baseline = buildBaseline(months, BASELINE_MONTHS)
  const result = baseline ? diagnose(baseline) : null

  const trend = months
    .filter((m) => m.operatingDays > 0 && m.orderCount > 0)
    .map((m) => ({
      year: m.year,
      month: m.month,
      dailyCustomers: m.orderCount / m.operatingDays,
      aov: m.sales / m.orderCount,
    }))

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">수익 진단 — 흑자가 되려면 하루 몇 명?</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          운영 {months.length}개월 데이터 기준 손익분기 · 고객 수 × 객단가 · 목표 이익
        </p>
      </div>

      {baseline && result ? (
        <>
          <BreakEvenCards baseline={baseline} result={result} />
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

      <UnavailableList />
    </div>
  )
}
