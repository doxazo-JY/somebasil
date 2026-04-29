import PageTabs from '@/components/ui/PageTabs'
import CostTable from '@/components/recipes/CostTable'
import IngredientRecoveryTable from '@/components/recipes/IngredientRecoveryTable'
import RecipesTabs from '@/components/recipes/RecipesTabs'
import {
  getAllMenuCosts,
  getIngredientRecovery,
  summarizeCosts,
} from '@/lib/supabase/queries/recipe-costs'
import { getYearlyMaterialMetrics } from '@/lib/supabase/queries/material-cost'
import { getYearlySummary } from '@/lib/supabase/queries/dashboard'

// 회수율 신뢰도 임계값 — 등록 메뉴 매출 비중이 이 값 미만이면 누적 마진 과소평가
// 마진 분해와 동일 (80%)
const RECOVERY_RELIABLE_THRESHOLD = 0.8

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const now = new Date()
  const year = now.getFullYear()

  const [costs, materialMetrics, yearlySummary] = await Promise.all([
    getAllMenuCosts(),
    getYearlyMaterialMetrics(year),
    getYearlySummary(year),
  ])
  const recovery = await getIngredientRecovery(costs)
  const summary = summarizeCosts(costs)

  // 등록 메뉴 매출 비중 (YTD)
  const ytdOkSales = [...materialMetrics.values()].reduce((s, m) => s + m.okSales, 0)
  const ytdIncome = yearlySummary.reduce((s, d) => s + d.income, 0)
  const okSalesRatio = ytdIncome > 0 ? ytdOkSales / ytdIncome : 0
  const isRecoveryReliable = okSalesRatio >= RECOVERY_RELIABLE_THRESHOLD

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">메뉴 원가</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          메뉴별 원가/마진/원가율 + 재료 봉지 회수율 — 부분 입력 시 등록된 메뉴만 계산
        </p>
      </div>

      {/* 첫 줄 요약 — 메뉴 등록 현황 */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 mb-6 grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 text-sm [word-break:keep-all]">
        <span className="text-gray-500">
          전체 메뉴 <span className="text-gray-700 font-medium">{summary.totalCount}개</span>
        </span>
        <span className="hidden sm:inline text-gray-200" aria-hidden>|</span>
        <span className="text-[#1a5c3a] font-medium">
          ✓ 원가 등록 {summary.okCount}개
        </span>
        {summary.missingPriceCount > 0 && (
          <>
            <span className="hidden sm:inline text-gray-200" aria-hidden>|</span>
            <span className="text-amber-600 font-medium">
              ⚠ 단가 누락 {summary.missingPriceCount}개
            </span>
          </>
        )}
        {summary.noRecipeCount > 0 && (
          <>
            <span className="hidden sm:inline text-gray-200" aria-hidden>|</span>
            <span className="text-gray-400">
              레시피 미등록 {summary.noRecipeCount}개
            </span>
          </>
        )}
        {summary.avgCostRatio != null && (
          <>
            <span className="hidden sm:inline text-gray-200" aria-hidden>|</span>
            <span className="text-gray-500">
              등록 메뉴 평균 원가율{' '}
              <span className="text-gray-700 font-medium">
                {(summary.avgCostRatio * 100).toFixed(1)}%
              </span>
            </span>
          </>
        )}
      </div>

      <RecipesTabs
        costView={<CostTable costs={costs} />}
        recoveryView={
          isRecoveryReliable ? (
            <IngredientRecoveryTable rows={recovery} />
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 text-sm text-gray-500 [word-break:keep-all]">
              <p className="font-semibold text-gray-700 mb-1">재료 회수율 (잠금)</p>
              <p className="text-xs text-gray-400 mt-1">
                메뉴 원가가 충분히 등록되면 회수율이 표시됩니다 — 현재 등록 메뉴 매출 비중{' '}
                <strong className="text-gray-700">{(okSalesRatio * 100).toFixed(1)}%</strong>
                {' / '}임계값 80%
              </p>
              <p className="text-[11px] text-gray-400 mt-2 [word-break:keep-all]">
                💡 누적 마진은 원가 등록된 메뉴들만 합산되므로, 등록률이 낮으면 회수율이 실제보다 낮게 표시됩니다.
                라떼·시럽 등 메인 메뉴 단가가 채워지면 자연스럽게 활성화됩니다.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}
