import PageTabs from '@/components/ui/PageTabs'
import YearFilter from '@/components/ui/YearFilter'
import ProfitStatCards from '@/components/profit/ProfitStatCards'
import ProfitTrendChart from '@/components/profit/ProfitTrendChart'
import MonthlyBreakdownTable from '@/components/profit/MonthlyBreakdownTable'
import BreakEvenSection from '@/components/profit/BreakEvenSection'
import { getYearlySummary, getMemosForYear } from '@/lib/supabase/queries/dashboard'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string }>
}

function formatManwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

export default async function ProfitPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())

  const [yearlySummary, memos] = await Promise.all([
    getYearlySummary(year),
    getMemosForYear(year),
  ])

  // YTD 누적
  const ytdIncome = yearlySummary.reduce((s, d) => s + d.income, 0)
  const ytdExpense = yearlySummary.reduce((s, d) => s + d.total_expense, 0)
  const ytdProfit = yearlySummary.reduce((s, d) => s + d.profit, 0)

  // 데이터 있는 월 수 (월평균 계산용)
  const monthsWithData = yearlySummary.filter(
    (d) => d.income > 0 || d.total_expense > 0,
  ).length

  // 월평균 — BreakEvenSection 입력
  const avgIncome = monthsWithData > 0 ? ytdIncome / monthsWithData : 0
  const avgExpense = monthsWithData > 0 ? ytdExpense / monthsWithData : 0
  const avgProfit = monthsWithData > 0 ? ytdProfit / monthsWithData : 0

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">이익 — 흑자가 되려면?</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {year}년 연간 손익 · 적자 원인 · 흑자 전환 전략
          </p>
        </div>
        <YearFilter year={year} />
      </div>

      {/* 상단: YTD KPI 3 + 월평균 손익분기 분석 (모바일 2열, sm 3열, lg 6열) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4 items-stretch">
        <ProfitStatCards
          ytdIncome={ytdIncome}
          ytdExpense={ytdExpense}
          ytdProfit={ytdProfit}
          monthsWithData={monthsWithData}
        />
        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <BreakEvenSection
            income={avgIncome}
            expense={avgExpense}
            profit={avgProfit}
            periodLabel="월평균"
          />
        </div>
      </div>

      {/* 연간 누적 요약 바 */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-3 mb-4 flex flex-wrap gap-4 sm:gap-8 text-sm">
        <span className="text-gray-400">{year}년 누적 ({monthsWithData}개월)</span>
        <span>
          매출 <strong className="text-gray-800">{formatManwon(ytdIncome)}</strong>
        </span>
        <span>
          지출 <strong className="text-gray-800">{formatManwon(ytdExpense)}</strong>
        </span>
        <span>
          이익{' '}
          <strong className={ytdProfit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}>
            {formatManwon(ytdProfit)}
          </strong>
        </span>
        {ytdIncome > 0 && (
          <span className="text-gray-400 text-xs self-center">
            이익률 {((ytdProfit / ytdIncome) * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* 수입·지출·이익 추이 + 월별 손익 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ProfitTrendChart data={yearlySummary} />
        <MonthlyBreakdownTable data={yearlySummary} year={year} memos={memos} />
      </div>
    </div>
  )
}
