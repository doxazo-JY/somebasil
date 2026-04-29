import PageTabs from '@/components/ui/PageTabs'
import CostTable from '@/components/recipes/CostTable'
import { getAllMenuCosts, summarizeCosts } from '@/lib/supabase/queries/recipe-costs'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const costs = await getAllMenuCosts()
  const summary = summarizeCosts(costs)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">메뉴 원가</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          메뉴별 원가/마진/원가율 — 부분 입력 시 등록된 메뉴만 계산됩니다
        </p>
      </div>

      {/* 첫 줄 요약 */}
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

      <CostTable costs={costs} />
    </div>
  )
}
