import MonthFilter from '@/components/ui/MonthFilter'
import ExpenseStatCards from '@/components/expenses/ExpenseStatCards'
import ExpenseTrendChart from '@/components/expenses/ExpenseTrendChart'
import ExpenseItemList from '@/components/expenses/ExpenseItemList'
import {
  getMonthlyExpensesByCategory,
  getYearlyExpenseTrend,
  getMonthlyExpenseItems,
} from '@/lib/supabase/queries/expenses'
import { getMonthlySummary } from '@/lib/supabase/queries/dashboard'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const [summary, expensesByCategory, trend, expenseItems] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlyExpensesByCategory(year, month),
    getYearlyExpenseTrend(year),
    getMonthlyExpenseItems(year, month),
  ])

  const income = summary?.income ?? 0
  const ingredients = expensesByCategory.ingredients ?? 0
  const labor = expensesByCategory.labor ?? 0

  // 연간 누적 지출
  const cumExpense = trend.reduce(
    (s, d) => s + d.ingredients + d.labor + d.fixed + d.card,
    0
  )

  function formatManwon(v: number) {
    return `${Math.round(v / 10000)}만`
  }

  return (
    <div className="px-16 py-8 w-full">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">지출 상세</h1>
          <p className="text-sm text-gray-400 mt-0.5">항목별 지출 분석</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 원가율 / 인건비율 카드 */}
      <div className="mb-4">
        <ExpenseStatCards income={income} ingredients={ingredients} labor={labor} />
      </div>

      {/* 연간 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex gap-8 text-sm">
        <span className="text-gray-400">{year}년 누적</span>
        <span>
          지출 <strong className="text-gray-800">{formatManwon(cumExpense)}</strong>
        </span>
        <span className="text-gray-400 text-xs self-center">({year}년 1~12월 합계)</span>
      </div>

      {/* 항목별 지출 추이 라인차트 */}
      <div className="mb-6">
        <ExpenseTrendChart data={trend} selectedMonth={month} />
      </div>

      {/* 카테고리별 항목 breakdown */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          항목 상세
        </p>
        <ExpenseItemList data={expenseItems} />
      </div>
    </div>
  )
}
