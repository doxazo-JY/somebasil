import IncomeStatCards from '@/components/income/IncomeStatCards'
import IncomeTrendChart from '@/components/income/IncomeTrendChart'
import SalesCalendar from '@/components/income/SalesCalendar'
import CategoryDonut from '@/components/income/CategoryDonut'
import MonthFilter from '@/components/ui/MonthFilter'
import {
  getMonthlyIncome,
  getYearlyIncomeTrend,
  getDailySales,
  getMonthlySalesByCategory,
} from '@/lib/supabase/queries/income'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function IncomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [income, prevIncome, trend, dailySales, categorySales] = await Promise.all([
    getMonthlyIncome(year, month),
    getMonthlyIncome(prevYear, prevMonth),
    getYearlyIncomeTrend(year),
    getDailySales(year, month),
    getMonthlySalesByCategory(year, month),
  ])

  const topCategory = categorySales[0]?.category ?? null

  // 연간 누적 수입
  const cumIncome = trend.reduce((s, d) => s + d.income, 0)

  function formatManwon(v: number) {
    return `${Math.round(v / 10000)}만`
  }

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">수입 상세</h1>
          <p className="text-sm text-gray-400 mt-0.5">월별 · 일별 매출 분석</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 요약 카드 */}
      <div className="mb-4">
        <IncomeStatCards
          income={income}
          prevIncome={prevIncome}
          topCategory={topCategory}
        />
      </div>

      {/* 연간 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex gap-8 text-sm">
        <span className="text-gray-400">{year}년 누적</span>
        <span>
          수입 <strong className="text-gray-800">{formatManwon(cumIncome)}</strong>
        </span>
        <span className="text-gray-400 text-xs self-center">({year}년 1~12월 합계)</span>
      </div>

      {/* 월별 추이 라인차트 */}
      <div className="mb-4">
        <IncomeTrendChart data={trend} selectedMonth={month} />
      </div>

      {/* 달력 + 도넛차트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SalesCalendar data={dailySales} year={year} month={month} />
        <CategoryDonut data={categorySales} />
      </div>
    </div>
  )
}
