import MonthFilter from '@/components/ui/MonthFilter'
import PageTabs from '@/components/ui/PageTabs'
import CostRatioCards from '@/components/expenses/CostRatioCards'
import ExpenseTrendChart from '@/components/expenses/ExpenseTrendChart'
import ExpenseItemList from '@/components/expenses/ExpenseItemList'
import SupplierTotals from '@/components/expenses/SupplierTotals'
import {
  getMonthlyExpensesByCategory,
  getYearlyExpenseTrend,
  getMonthlyExpenseItems,
  getSupplierTotals,
} from '@/lib/supabase/queries/expenses'
import { getMonthlySummary } from '@/lib/supabase/queries/dashboard'

export const dynamic = 'force-dynamic'

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

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const [summary, expensesByCategory, prevExpensesByCategory, trend, expenseItems, suppliers] = await Promise.all([
    getMonthlySummary(year, month),
    getMonthlyExpensesByCategory(year, month),
    getMonthlyExpensesByCategory(prevYear, prevMonth),
    getYearlyExpenseTrend(year),
    getMonthlyExpenseItems(year, month),
    getSupplierTotals(year, month),
  ])

  const income = summary?.income ?? 0
  const labor = expensesByCategory.labor ?? 0
  const ingredientsCash = expensesByCategory.ingredients_cash ?? 0
  const ingredientsCard = expensesByCategory.ingredients_card ?? 0
  const ingredients = ingredientsCash + ingredientsCard
  const fixed = expensesByCategory.fixed ?? 0
  const equipment = expensesByCategory.equipment ?? 0
  const card = expensesByCategory.card ?? 0
  // 헤드라인 합계는 monthly_summary.total_expense 사용 (대시보드와 일치).
  // - manual_adjustments(수동 조정) 반영됨
  // - 'excluded' 카테고리 항상 제외됨
  // 카테고리 합산(labor + ingredients + ...)과는 manual_adjustments 만큼 차이 날 수 있음.
  const categorySum = labor + ingredients + fixed + equipment + card
  const totalExpense = summary?.total_expense ?? categorySum
  const adjustmentDelta = totalExpense - categorySum

  // 연간 누적 지출 (설비투자 포함)
  const cumExpense = trend.reduce(
    (s, d) => s + d.ingredients_cash + d.ingredients_card + d.labor + d.fixed + d.equipment + d.card, 0
  )

  // 첫 줄 요약 — 전월比 변화 액션 인사이트
  // 1) 가장 큰 지출 (절대 1위)
  // 2) 전월比 가장 많이 증가한 카테고리 (액션 대상)
  const prevLabor = prevExpensesByCategory.labor ?? 0
  const prevIngredients =
    (prevExpensesByCategory.ingredients_cash ?? 0) +
    (prevExpensesByCategory.ingredients_card ?? 0)
  const prevFixed = prevExpensesByCategory.fixed ?? 0
  const prevCard = prevExpensesByCategory.card ?? 0
  const prevEquipment = prevExpensesByCategory.equipment ?? 0

  const cats = [
    { label: '인건비', amount: labor, prev: prevLabor },
    { label: '재료비', amount: ingredients, prev: prevIngredients },
    { label: '고정비', amount: fixed, prev: prevFixed },
    { label: '카드대금', amount: card, prev: prevCard },
    { label: '설비투자', amount: equipment, prev: prevEquipment },
  ].filter((c) => c.amount > 0)

  const topCat = [...cats].sort((a, b) => b.amount - a.amount)[0]

  // 전월比 증가량(원) 가장 큰 카테고리 — 단 의미 있는 변화만
  const MIN_DELTA_WON = 100000 // 10만원 미만 증가는 노이즈로 간주
  const biggestIncrease = [...cats]
    .map((c) => ({ ...c, delta: c.amount - c.prev }))
    .filter((c) => c.delta >= MIN_DELTA_WON && c.prev > 0)
    .sort((a, b) => b.delta - a.delta)[0]

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">지출 — 어디서 돈이 새고 있나?</h1>
          <p className="text-sm text-gray-400 mt-0.5">비용 구조 분석 · 매출 대비 비율</p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      {/* 첫 줄 요약 — 액션 인사이트 (전월比 가장 큰 증가) + 가장 큰 지출 */}
      {topCat && (
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 mb-4 grid grid-cols-1 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 text-sm [word-break:keep-all]">
          {biggestIncrease ? (
            <span className="text-amber-600 font-medium">
              ⚠ 전월比{' '}
              <span className="text-gray-800">
                {biggestIncrease.label} +{formatManwon(biggestIncrease.delta)}
              </span>
              <span className="text-gray-400 font-normal ml-1.5">
                ({formatManwon(biggestIncrease.prev)} → {formatManwon(biggestIncrease.amount)},{' '}
                +{((biggestIncrease.delta / biggestIncrease.prev) * 100).toFixed(0)}%)
              </span>
            </span>
          ) : (
            <span className="text-[#1a5c3a] font-medium">
              ✓ 전월比 안정적
            </span>
          )}
          <span className="hidden sm:inline text-gray-200" aria-hidden>
            |
          </span>
          <span className="text-gray-500">
            <span className="text-gray-400">💸</span> 가장 큰 지출{' '}
            <span className="text-gray-700 font-medium">
              {topCat.label} {formatManwon(topCat.amount)}
            </span>
            {income > 0 && (
              <span className="text-gray-400 ml-1.5">
                (매출의 {((topCat.amount / income) * 100).toFixed(0)}%)
              </span>
            )}
          </span>
        </div>
      )}

      {/* 비용 비율 카드 — 핵심 지표 */}
      {income > 0 ? (
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              매출 대비 비용 비율
            </p>
            <p className="text-[11px] text-gray-400">
              비율 = (카테고리 금액 ÷ {month}월 매출 {formatManwon(income)})
            </p>
          </div>
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
        {Math.abs(adjustmentDelta) > 0 && (
          <span className="text-[11px] text-gray-400 self-center [word-break:keep-all]">
            (카테고리 {formatManwon(categorySum)} {adjustmentDelta >= 0 ? '+' : '−'} 수동조정 {formatManwon(Math.abs(adjustmentDelta))})
          </span>
        )}
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

      {/* 거래처별 누적 (정기 공급처 — 사장 보고용) */}
      <div className="mb-6">
        <SupplierTotals
          data={suppliers}
          monthLabel={`${month}월`}
          yearLabel={`${year}년`}
        />
      </div>

      {/* 카테고리별 항목 상세 */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          항목 상세
        </p>
        <ExpenseItemList data={expenseItems} />
      </div>
    </div>
  )
}
