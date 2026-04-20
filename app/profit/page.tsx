import MonthFilter from '@/components/ui/MonthFilter'
import ProfitStatCards from '@/components/profit/ProfitStatCards'
import ProfitTrendChart from '@/components/profit/ProfitTrendChart'
import MonthlyBreakdownTable from '@/components/profit/MonthlyBreakdownTable'
import { getMonthlySummary, getYearlySummary } from '@/lib/supabase/queries/dashboard'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

function formatManwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

export default async function ProfitPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [current, prev, yearlySummary] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlySummary(prevYear, prevMonth),
    getYearlySummary(year),
  ])

  const profit = current?.profit ?? 0
  const income = current?.income ?? 0
  const expense = current?.total_expense ?? 0

  // 연간 누적
  const cumIncome = yearlySummary.reduce((s, d) => s + d.income, 0)
  const cumExpense = yearlySummary.reduce((s, d) => s + d.total_expense, 0)
  const cumProfit = yearlySummary.reduce((s, d) => s + d.profit, 0)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">이익 분석</h1>
          <p className="text-sm text-gray-400 mt-0.5">월별 손익 현황 및 추이</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 이번 달 요약 카드 */}
      <div className="mb-4">
        <ProfitStatCards
          profit={profit}
          income={income}
          expense={expense}
          prevProfit={prev?.profit}
          prevIncome={prev?.income}
        />
      </div>

      {/* 연간 누적 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-6 flex gap-8 text-sm">
        <span className="text-gray-400">{year}년 누적</span>
        <span>매출 <strong className="text-gray-800">{formatManwon(cumIncome)}</strong></span>
        <span>지출 <strong className="text-gray-800">{formatManwon(cumExpense)}</strong></span>
        <span>
          이익{' '}
          <strong className={cumProfit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}>
            {formatManwon(cumProfit)}
          </strong>
        </span>
        {cumIncome > 0 && (
          <span className="text-gray-400 text-xs self-center">
            이익률 {((cumProfit / cumIncome) * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* 트렌드 차트 */}
      <div className="mb-6">
        <ProfitTrendChart data={yearlySummary} selectedMonth={month} />
      </div>

      {/* 월별 손익 테이블 */}
      <MonthlyBreakdownTable
        data={yearlySummary}
        selectedMonth={month}
        year={year}
      />
    </div>
  )
}
