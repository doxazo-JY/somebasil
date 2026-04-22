import IncomeStatCards from '@/components/income/IncomeStatCards'
import IncomeTrendChart from '@/components/income/IncomeTrendChart'
import SalesCalendar from '@/components/income/SalesCalendar'
import CategoryDonut from '@/components/income/CategoryDonut'
import TopProductsCard from '@/components/income/TopProductsCard'
import MonthFilter from '@/components/ui/MonthFilter'
import {
  getMonthlyIncome,
  getPartialMonthIncome,
  getYearlyIncomeTrend,
  getDailySales,
  getMonthlySalesByCategory,
  getMonthlyProductSales,
  getMonthlyAOV,
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

  // 1차 쿼리: 현재 월 데이터로 최대 데이터 일자 파악
  const dailySalesFull = await getDailySales(year, month)
  const maxDayInData = dailySalesFull.reduce((m, r) => {
    const d = Number(r.date.slice(8, 10))
    return d > m ? d : m
  }, 0)

  // 부분월 여부: 해당 월의 마지막 날보다 작으면 부분월
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const isPartial = maxDayInData > 0 && maxDayInData < lastDayOfMonth
  const prevMaxDay = isPartial ? maxDayInData : undefined

  // 전월 동기간比 계산용: 전월도 같은 일자까지만 (부분월일 때)
  const [
    income,
    prevIncome,
    trend,
    categorySales,
    productSales,
    prevProductSales,
    aovData,
    prevAovData,
  ] = await Promise.all([
    getMonthlyIncome(year, month),
    isPartial ? getPartialMonthIncome(prevYear, prevMonth, prevMaxDay!) : getMonthlyIncome(prevYear, prevMonth),
    getYearlyIncomeTrend(year),
    getMonthlySalesByCategory(year, month),
    getMonthlyProductSales(year, month),
    getMonthlyProductSales(prevYear, prevMonth, prevMaxDay),
    getMonthlyAOV(year, month),
    getMonthlyAOV(prevYear, prevMonth, prevMaxDay),
  ])

  const dailySales = dailySalesFull
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

      {/* 요약 카드 (객단가 포함). 부분월이면 전월 동기간比로 비교 */}
      <div className="mb-4">
        <IncomeStatCards
          income={income}
          prevIncome={prevIncome}
          topCategory={topCategory}
          aov={aovData.aov}
          prevAov={prevAovData.aov}
          orderCount={aovData.orderCount}
          isPartial={isPartial}
          maxDay={maxDayInData}
        />
      </div>

      {/* 연간 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex gap-8 text-sm">
        <span className="text-gray-400">{year}년 누적</span>
        <span>
          수입 <strong className="text-gray-800">{formatManwon(cumIncome)}</strong>
        </span>
      </div>

      {/* 월별 추이 라인차트 */}
      <div className="mb-4">
        <IncomeTrendChart data={trend} selectedMonth={month} />
      </div>

      {/* 달력 + 도넛차트 (드릴다운) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SalesCalendar data={dailySales} year={year} month={month} />
        <CategoryDonut data={categorySales} products={productSales} />
      </div>

      {/* BEST 10 메뉴 */}
      <TopProductsCard products={productSales} prevProducts={prevProductSales} />
    </div>
  )
}
