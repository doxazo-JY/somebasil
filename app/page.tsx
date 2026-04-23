import PageTabs from '@/components/ui/PageTabs'
import StatCard from '@/components/ui/StatCard'
import TrendChart from '@/components/dashboard/TrendChart'
import ExpenseDonut from '@/components/dashboard/ExpenseDonut'
import CategorySales from '@/components/dashboard/CategorySales'
import TopMenusCompact from '@/components/dashboard/TopMenusCompact'
import MemoCard from '@/components/dashboard/MemoCard'
import {
  getMonthlySummary,
  getYearlySummary,
  getAllTimeSummary,
  getMonthlyExpensesByCategory,
  getMonthlySalesByCategory,
  getMemo,
} from '@/lib/supabase/queries/dashboard'
import {
  getMonthlyAOV,
  getMonthlyProductSales,
} from '@/lib/supabase/queries/income'

export const dynamic = 'force-dynamic'

function formatManwon(amount: number) {
  const man = Math.round(Math.abs(amount) / 10000)
  return `${amount < 0 ? '-' : ''}${man}만`
}

function calcChange(current: number, prev: number | undefined) {
  if (!prev || prev === 0) return undefined
  return ((current - prev) / Math.abs(prev)) * 100
}

export default async function DashboardPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [
    current,
    prev,
    yearlySummary,
    allTime,
    expenses,
    sales,
    memo,
    aovData,
    prevAovData,
    topProducts,
  ] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlySummary(prevYear, prevMonth),
    getYearlySummary(year),
    getAllTimeSummary(),
    getMonthlyExpensesByCategory(year, month),
    getMonthlySalesByCategory(year, month),
    getMemo(year, month),
    getMonthlyAOV(year, month),
    getMonthlyAOV(prevYear, prevMonth),
    getMonthlyProductSales(year, month),
  ])

  const cumIncome = allTime.reduce((s, d) => s + d.income, 0)
  const cumExpense = allTime.reduce((s, d) => s + d.total_expense, 0)
  const cumProfit = allTime.reduce((s, d) => s + d.profit, 0)

  const aovChange = calcChange(aovData.aov, prevAovData.aov)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="overview" />
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-400 mt-0.5">카페 썸바실 재무 현황 요약</p>
      </div>

      {/* 이번 달 현황 카드 4개 */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {month}월 현황
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="월 매출"
          value={current ? formatManwon(current.income) : '—'}
          change={current && prev ? calcChange(current.income, prev.income) : undefined}
          subLabel="전월比"
        />
        <StatCard
          label="월 지출"
          value={current ? formatManwon(current.total_expense) : '—'}
          change={current && prev ? calcChange(current.total_expense, prev.total_expense) : undefined}
          subLabel="전월比"
          highlight="negative"
        />
        <StatCard
          label="순이익"
          value={current ? formatManwon(current.profit) : '—'}
          change={current && prev ? calcChange(current.profit, prev.profit) : undefined}
          subLabel="전월比"
          highlight={current && current.profit >= 0 ? 'positive' : 'negative'}
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
        />
      </div>

      {/* 전체 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex flex-wrap gap-4 sm:gap-8 text-sm">
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

      {/* 트렌드 + 지출 도넛 (3열: 2 + 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <TrendChart data={yearlySummary} />
        </div>
        <ExpenseDonut data={expenses} />
      </div>

      {/* 카테고리별 매출 + BEST 5 메뉴 (2열) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <CategorySales data={sales} />
        <TopMenusCompact products={topProducts} limit={5} />
      </div>

      {/* 메모 */}
      <MemoCard
        initialContent={memo?.content ?? ''}
        year={year}
        month={month}
      />
    </div>
  )
}
