import StatCard from '@/components/dashboard/StatCard'
import TrendChart from '@/components/dashboard/TrendChart'
import ExpenseDonut from '@/components/dashboard/ExpenseDonut'
import CategorySales from '@/components/dashboard/CategorySales'
import MemoCard from '@/components/dashboard/MemoCard'
import {
  getMonthlySummary,
  getYearlySummary,
  getMonthlyExpensesByCategory,
  getMonthlySalesByCategory,
  getMemo,
} from '@/lib/supabase/queries/dashboard'

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

  const [current, prev, yearlySummary, expenses, sales, memo] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlySummary(prevYear, prevMonth),
    getYearlySummary(year),
    getMonthlyExpensesByCategory(year, month),
    getMonthlySalesByCategory(year, month),
    getMemo(year, month),
  ])

  // 연간 누적
  const cumIncome = yearlySummary.reduce((s, d) => s + d.income, 0)
  const cumExpense = yearlySummary.reduce((s, d) => s + d.total_expense, 0)
  const cumProfit = yearlySummary.reduce((s, d) => s + d.profit, 0)

  return (
    <div className="px-16 py-8 w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-400 mt-0.5">카페 썸바실 재무 현황 요약</p>
      </div>

      {/* 이번 달 현황 카드 */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {month}월 현황
      </p>
      <div className="grid grid-cols-3 gap-4 mb-4">
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
      </div>

      {/* 연간 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex gap-8 text-sm">
        <span className="text-gray-400">누적</span>
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

      {/* 차트 영역 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <TrendChart data={yearlySummary} />
        </div>
        <ExpenseDonut data={expenses} />
      </div>

      {/* 카테고리별 매출 */}
      <div className="mb-4">
        <CategorySales data={sales} />
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
