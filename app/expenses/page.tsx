import MonthFilter from '@/components/ui/MonthFilter'
import CostRatioCards from '@/components/expenses/CostRatioCards'
import ExpenseTrendChart from '@/components/expenses/ExpenseTrendChart'
import ExpenseItemList from '@/components/expenses/ExpenseItemList'
import ReclassifyTable from '@/components/expenses/ReclassifyTable'
import {
  getMonthlyExpensesByCategory,
  getYearlyExpenseTrend,
  getMonthlyExpenseItems,
  getMonthlyAllTransactions,
} from '@/lib/supabase/queries/expenses'
import { getMonthlySummary } from '@/lib/supabase/queries/dashboard'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

function formatManwon(v: number) {
  return `${Math.round(v / 10000)}만`
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const [summary, expensesByCategory, trend, expenseItems, allTransactions] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlyExpensesByCategory(year, month),
    getYearlyExpenseTrend(year),
    getMonthlyExpenseItems(year, month),
    getMonthlyAllTransactions(year, month),
  ])

  const income = summary?.income ?? 0
  const labor = expensesByCategory.labor ?? 0
  const ingredients = expensesByCategory.ingredients ?? 0
  const fixed = expensesByCategory.fixed ?? 0
  const equipment = expensesByCategory.equipment ?? 0
  const card = expensesByCategory.card ?? 0
  const totalExpense = labor + ingredients + fixed + equipment + card

  // 연간 누적 지출 (설비투자 포함)
  const cumExpense = trend.reduce(
    (s, d) => s + d.ingredients + d.labor + d.fixed + d.equipment + d.card, 0
  )

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">지출 — 어디서 돈이 새고 있나?</h1>
          <p className="text-sm text-gray-400 mt-0.5">비용 구조 분석 · 매출 대비 비율</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 비용 비율 카드 — 핵심 지표 */}
      {income > 0 ? (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            매출 대비 비용 비율
          </p>
          <CostRatioCards
            income={income}
            labor={labor}
            ingredients={ingredients}
            fixed={fixed}
            card={card}
          />
        </div>
      ) : (
        <div className="mb-6 bg-gray-50 rounded-xl border border-gray-100 px-5 py-4 text-sm text-gray-400">
          이번 달 매출 데이터가 없어 비율을 계산할 수 없습니다.
        </div>
      )}

      {/* 이번 달 지출 요약 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex flex-wrap gap-4 sm:gap-8 text-sm">
        <span className="text-gray-400">{month}월 지출</span>
        <span>합계 <strong className="text-gray-800">{formatManwon(totalExpense)}</strong></span>
        {income > 0 && (
          <span className={`text-xs self-center font-medium ${totalExpense > income ? 'text-red-500' : 'text-[#1a5c3a]'}`}>
            매출 대비 {((totalExpense / income) * 100).toFixed(0)}%
            {totalExpense > income ? ' (적자)' : ' (흑자)'}
          </span>
        )}
        <span className="text-gray-400 text-xs self-center ml-auto">
          연간 누적 {formatManwon(cumExpense)}
        </span>
      </div>

      {/* 항목별 지출 추이 */}
      <div className="mb-6">
        <ExpenseTrendChart data={trend} selectedMonth={month} />
      </div>

      {/* 카테고리별 항목 상세 */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          항목 상세
        </p>
        <ExpenseItemList data={expenseItems} />
      </div>

      {/* 전체 거래 재분류 */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          거래 재분류
        </p>
        <ReclassifyTable items={allTransactions} />
      </div>
    </div>
  )
}
