import WeekSelector from '@/components/weekly/WeekSelector'
import WeeklyKPICards from '@/components/weekly/WeeklyKPICards'
import DailyBreakdownChart from '@/components/weekly/DailyBreakdownChart'
import WeeklyCategoryMix from '@/components/weekly/WeeklyCategoryMix'
import WeeklyExpenseBreakdown from '@/components/weekly/WeeklyExpenseBreakdown'
import TopProductsCard from '@/components/income/TopProductsCard'
import {
  getWeekDetail,
  getRecentWeekOptions,
} from '@/lib/supabase/queries/weekly'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function prevWeekRange(weekStart: string, weekEnd: string): { start: string; end: string } {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  start.setDate(start.getDate() - 7)
  end.setDate(end.getDate() - 7)
  return { start: toStr(start), end: toStr(end) }
}

// 선택한 주가 부분주(데이터 없는 요일 존재)라면 전주도 같은 요일까지만 caps
function capPrevEndToSamePartial(
  selectedStart: string,
  selectedDaily: { date: string; income: number; orderCount: number }[],
  prevStart: string,
  prevEnd: string,
): string {
  // 선택 주에서 데이터가 있는 마지막 날짜
  const lastDataDate = [...selectedDaily]
    .filter((d) => d.income > 0 || d.orderCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop()?.date
  if (!lastDataDate) return prevEnd

  // selectedStart로부터 며칠째(0=월요일)
  const selStart = new Date(selectedStart)
  const lastD = new Date(lastDataDate)
  const daysIntoWeek = Math.floor(
    (lastD.getTime() - selStart.getTime()) / (1000 * 60 * 60 * 24),
  )

  // 주 전체 7일(0~6)이면 capping 불필요
  if (daysIntoWeek >= 6) return prevEnd

  // 전주 같은 요일까지로 제한
  const pStart = new Date(prevStart)
  const pCap = new Date(pStart)
  pCap.setDate(pCap.getDate() + daysIntoWeek)
  return toStr(pCap)
}

export default async function WeeklyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const weekOptions = getRecentWeekOptions(8)

  // 기본: 지난 주 (목요일 주간보고용)
  const defaultWeek = weekOptions.find((w) => w.isLast) ?? weekOptions[0]
  const targetWeekStart = params.week ?? defaultWeek.weekStart
  const targetWeekOption = weekOptions.find((w) => w.weekStart === targetWeekStart) ?? defaultWeek

  const prevRange = prevWeekRange(
    targetWeekOption.weekStart,
    targetWeekOption.weekEnd,
  )

  // 1차: 선택 주 먼저 조회해서 부분주 여부 파악
  const detail = await getWeekDetail(
    targetWeekOption.weekStart,
    targetWeekOption.weekEnd,
  )

  // 선택 주가 부분주면 전주도 같은 요일까지만 (공정 비교)
  const cappedPrevEnd = capPrevEndToSamePartial(
    targetWeekOption.weekStart,
    detail.daily,
    prevRange.start,
    prevRange.end,
  )
  const isPartial = cappedPrevEnd !== prevRange.end

  const prevDetail = await getWeekDetail(prevRange.start, cappedPrevEnd)


  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">주간 현황</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            매주 목요일 주간보고용 · 기본값 = 지난 주(월~일)
          </p>
        </div>
        <WeekSelector
          options={weekOptions}
          currentWeekStart={targetWeekOption.weekStart}
        />
      </div>

      {/* 주간 KPI 5개 */}
      <div className="mb-4">
        <WeeklyKPICards
          income={detail.income}
          expense={detail.expense}
          profit={detail.profit}
          aov={detail.aov}
          orderCount={detail.orderCount}
          hasExpenseData={detail.hasExpenseData}
          weekStart={detail.weekStart}
          weekEnd={detail.weekEnd}
          isPartial={isPartial}
          prev={{
            income: prevDetail.income,
            expense: prevDetail.expense,
            profit: prevDetail.profit,
            aov: prevDetail.aov,
            orderCount: prevDetail.orderCount,
            hasExpenseData: prevDetail.hasExpenseData,
          }}
        />
      </div>

      {/* 요일별 매출 + 지출 카테고리 비교 (매출/지출 쌍) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-start">
        <DailyBreakdownChart daily={detail.daily} prevDaily={prevDetail.daily} />
        <WeeklyExpenseBreakdown
          current={detail.expenseByCategory}
          prev={prevDetail.expenseByCategory}
          currentHasData={detail.hasExpenseData}
          prevHasData={prevDetail.hasExpenseData}
        />
      </div>

      {/* 카테고리 믹스 + BEST 10 메뉴 (2열) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <WeeklyCategoryMix current={detail.categoryMix} prev={prevDetail.categoryMix} />
        <TopProductsCard
          products={detail.topProducts}
          prevProducts={prevDetail.topProducts}
          limit={10}
        />
      </div>
    </div>
  )
}
