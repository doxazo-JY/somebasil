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
  const baseline = buildBaseline(months, BASELINE_MONTHS)
  const result = baseline ? diagnose(baseline) : null

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
        <h1 className="text-xl font-bold text-gray-900">흑자 조건 — 하루 몇 명이 와야 할까?</h1>
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

      {hourlyLabor && (
        <div className="mb-4">
          <HourlyLaborSection data={hourlyLabor} />
        </div>
      )}

      <UnavailableList />
    </div>
  )
}
