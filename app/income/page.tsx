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

  return (
    <div className="px-16 py-8 w-full">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">수입 상세</h1>
          <p className="text-sm text-gray-400 mt-0.5">월별 · 일별 매출 분석</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 요약 카드 */}
      <div className="mb-6">
        <IncomeStatCards
          income={income}
          prevIncome={prevIncome}
          topCategory={topCategory}
        />
      </div>

      {/* 월별 추이 라인차트 */}
      <div className="mb-4">
        <IncomeTrendChart data={trend} selectedMonth={month} />
      </div>

      {/* 달력 + 도넛차트 */}
      <div className="grid grid-cols-2 gap-4">
        <SalesCalendar data={dailySales} year={year} month={month} />
        <CategoryDonut data={categorySales} />
      </div>
    </div>
  )
}
