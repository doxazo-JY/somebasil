import PageTabs from '@/components/ui/PageTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import UploadSection from '@/components/upload/UploadSection'
import UploadHistory from '@/components/upload/UploadHistory'
import FixTabs from '@/components/upload/FixTabs'
import ReclassifyTable from '@/components/expenses/ReclassifyTable'
import MasterManager from '@/components/menu/MasterManager'
import { getUploadHistory } from '@/lib/supabase/queries/upload'
import { getMonthlyAllTransactions } from '@/lib/supabase/queries/expenses'
import { getMasterProducts } from '@/lib/supabase/queries/menu'
import { getWeekCoverage } from '@/lib/upload/coverage'
import { pickAgentsAfterUpload } from '@/lib/ai/agents/after-upload'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

// 데이터 넣기 (파일 하나로 받기) + 데이터 고치기 (통장 분류 · 메뉴 목록)
export default async function UploadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const [history, allTransactions, masterProducts, coverage] = await Promise.all([
    getUploadHistory(),
    getMonthlyAllTransactions(year, month),
    getMasterProducts(),
    getWeekCoverage(),
  ])
  // 체크리스트 문구용 — 이번 주 자동 분석을 이미 했는지 (AI는 실행하지 않음)
  const { weeklyDone } = await pickAgentsAfterUpload(coverage, false).catch(() => ({ weeklyDone: false }))

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">데이터 넣기</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">받은 파일을 끌어다 놓으면 종류를 알아보고 바로 저장해요</p>
      </div>

      <div className="mb-10 max-w-3xl">
        <UploadSection coverage={coverage} weeklyDone={weeklyDone} />
      </div>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-900">데이터 고치기</h2>
        </div>
        <div className="hidden md:block">
          <FixTabs
            bank={
              <>
                <div className="flex justify-end mb-3">
                  <MonthFilter year={year} month={month} />
                </div>
                <ReclassifyTable items={allTransactions} />
              </>
            }
            menu={<MasterManager products={masterProducts} />}
          />
        </div>
        <p className="md:hidden text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg [word-break:keep-all]">
          💻 데이터 고치기는 PC에서 할 수 있어요
        </p>
      </div>

      {/* 업로드 히스토리 — 디폴트 접힘 (자주 안 봄) */}
      <details className="mb-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-700 select-none mb-2">
          업로드 히스토리 ({history.length}건) ▾
        </summary>
        <UploadHistory data={history} />
      </details>
    </div>
  )
}
