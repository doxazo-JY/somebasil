import PageTabs from '@/components/ui/PageTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import StatCard from '@/components/ui/StatCard'
import TrendChart from '@/components/dashboard/TrendChart'
import CategorySales from '@/components/dashboard/CategorySales'
import DeficitSignals from '@/components/dashboard/DeficitSignals'
import InsightBanner from '@/components/dashboard/InsightBanner'
import TopProductsCard from '@/components/income/TopProductsCard'
import SalesCalendar from '@/components/income/SalesCalendar'
import MemoCard from '@/components/dashboard/MemoCard'
import {
  getMonthlySummary,
  getYearlySummary,
  getAllTimeSummary,
  getMonthlySalesByCategory,
  getMemo,
  getLatestUploadDate,
} from '@/lib/supabase/queries/dashboard'
import { getMonthlyExpensesByCategory } from '@/lib/supabase/queries/expenses'
import {
  getMonthlyAOV,
  getMonthlyProductSales,
  getDailySales,
} from '@/lib/supabase/queries/income'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

function formatManwon(amount: number) {
  const man = Math.round(Math.abs(amount) / 10000)
  return `${amount < 0 ? '-' : ''}${man}만`
}

function calcChange(current: number, prev: number | undefined) {
  if (!prev || prev === 0) return undefined
  return ((current - prev) / Math.abs(prev)) * 100
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [
    current,
    prev,
    lastYearSame,
    yearlySummary,
    allTime,
    expenses,
    prevExpenses,
    sales,
    memo,
    aovData,
    prevAovData,
    topProducts,
    prevTopProducts,
    dailySales,
    lastBankUploadAt,
  ] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlySummary(prevYear, prevMonth),
    getMonthlySummary(year - 1, month), // 작년 동월
    getYearlySummary(year),
    getAllTimeSummary(),
    getMonthlyExpensesByCategory(year, month),
    getMonthlyExpensesByCategory(prevYear, prevMonth),
    getMonthlySalesByCategory(year, month),
    getMemo(year, month),
    getMonthlyAOV(year, month),
    getMonthlyAOV(prevYear, prevMonth),
    getMonthlyProductSales(year, month),
    getMonthlyProductSales(prevYear, prevMonth),
    getDailySales(year, month),
    getLatestUploadDate('bank_transaction'),
  ])

  const cumIncome = allTime.reduce((s, d) => s + d.income, 0)
  const cumExpense = allTime.reduce((s, d) => s + d.total_expense, 0)
  const cumProfit = allTime.reduce((s, d) => s + d.profit, 0)

  const aovChange = calcChange(aovData.aov, prevAovData.aov)

  // 적자 신호용 카테고리 합계
  const ingredientsCurr = (expenses.ingredients_cash ?? 0) + (expenses.ingredients_card ?? 0)
  const ingredientsPrev = (prevExpenses.ingredients_cash ?? 0) + (prevExpenses.ingredients_card ?? 0)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="operations" />
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-400 mt-0.5">카페 썸바실 — 한눈에 보기</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 첫 인사이트 한 줄 — 부분월 / 손익분기 갭 / 가장 악화된 신호 */}
      <div className="mb-3">
        <InsightBanner
          year={year}
          month={month}
          income={current?.income ?? 0}
          expense={current?.total_expense ?? 0}
          profit={current?.profit ?? 0}
          prevIncome={prev?.income ?? 0}
          laborCurr={expenses.labor ?? 0}
          laborPrev={prevExpenses.labor ?? 0}
          fixedCurr={expenses.fixed ?? 0}
          fixedPrev={prevExpenses.fixed ?? 0}
          cardCurr={expenses.card ?? 0}
          cardPrev={prevExpenses.card ?? 0}
          lastBankUploadAt={lastBankUploadAt}
        />
      </div>

      {/* 전체 누적 — 시작 이후 역사적 맥락 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-2.5 mb-6 flex flex-wrap gap-4 sm:gap-8 text-sm">
        <span className="text-gray-400">전체 누적</span>
        <span>
          매출 <strong className="text-gray-800">{formatManwon(cumIncome)}</strong>
        </span>
        <span>
          지출 <strong className="text-gray-800">{formatManwon(cumExpense)}</strong>
        </span>
        <span>
          이익{' '}
          <strong className={cumProfit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}>
            {formatManwon(cumProfit)}
          </strong>
        </span>
      </div>

      {/* 이번 달 KPI 4개 */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {month}월 현황
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="월 매출"
          value={current ? formatManwon(current.income) : '—'}
          change={current && prev ? calcChange(current.income, prev.income) : undefined}
          yoyChange={current && lastYearSame ? calcChange(current.income, lastYearSame.income) : undefined}
          subLabel="전월比"
          href={`/menu?year=${year}&month=${month}`}
        />
        <StatCard
          label="월 지출"
          value={current ? formatManwon(current.total_expense) : '—'}
          change={current && prev ? calcChange(current.total_expense, prev.total_expense) : undefined}
          yoyChange={current && lastYearSame ? calcChange(current.total_expense, lastYearSame.total_expense) : undefined}
          subLabel="전월比"
          highlight="negative"
          href={`/expenses?year=${year}&month=${month}`}
        />
        <StatCard
          label="순이익"
          value={current ? formatManwon(current.profit) : '—'}
          change={current && prev ? calcChange(current.profit, prev.profit) : undefined}
          yoyChange={current && lastYearSame ? calcChange(current.profit, lastYearSame.profit) : undefined}
          subLabel="전월比"
          highlight={current && current.profit >= 0 ? 'positive' : 'negative'}
          href={`/profit?year=${year}`}
        />
        <StatCard
          label="객단가"
          value={aovData.aov > 0 ? `${aovData.aov.toLocaleString()}원` : '—'}
          subLabel={
            aovData.orderCount > 0
              ? `주문 ${aovData.orderCount.toLocaleString()}건${
                  aovChange !== undefined
                    ? ` · ${aovChange >= 0 ? '▲' : '▼'} ${Math.abs(aovChange).toFixed(1)}%`
                    : ''
                }`
              : undefined
          }
          highlight={aovChange === undefined ? 'neutral' : aovChange >= 0 ? 'positive' : 'negative'}
          href={`/menu?year=${year}&month=${month}`}
        />
      </div>

      {/* 적자 원인 신호 — 전월 대비 비율 변화 */}
      <div className="mb-6">
        <DeficitSignals
          income={current?.income ?? 0}
          laborCurr={expenses.labor ?? 0}
          ingredientsCurr={ingredientsCurr}
          fixedCurr={expenses.fixed ?? 0}
          cardCurr={expenses.card ?? 0}
          prevIncome={prev?.income ?? 0}
          laborPrev={prevExpenses.labor ?? 0}
          ingredientsPrev={ingredientsPrev}
          fixedPrev={prevExpenses.fixed ?? 0}
          cardPrev={prevExpenses.card ?? 0}
        />
      </div>

      {/* ─── 첫 화면 끝. 아래는 상세/맥락 ─── */}

      {/* 매출 달력 + 카테고리 매출 (2열) — 이번 달 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <SalesCalendar data={dailySales} year={year} month={month} />
        <CategorySales data={sales} />
      </div>

      {/* BEST 10 메뉴 */}
      <div className="mb-4">
        <TopProductsCard products={topProducts} prevProducts={prevTopProducts} limit={10} />
      </div>

      {/* 메모 */}
      <div className="mb-6">
        <MemoCard
          initialContent={memo?.content ?? ''}
          year={year}
          month={month}
        />
      </div>

      {/* 12개월 트렌드 — 역사적 맥락 */}
      <div>
        <TrendChart data={yearlySummary} />
      </div>
    </div>
  )
}
