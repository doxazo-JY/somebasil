import GuideLink from '@/components/ui/GuideLink'
import PageTabs from '@/components/ui/PageTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import UploadSection from '@/components/upload/UploadSection'
import UploadHistory from '@/components/upload/UploadHistory'
import SubTabs from '@/components/ui/SubTabs'
import ReclassifyTable from '@/components/expenses/ReclassifyTable'
import MasterManager from '@/components/menu/MasterManager'
import { getUploadHistory } from '@/lib/supabase/queries/upload'
import { getMonthlyAllTransactions } from '@/lib/supabase/queries/expenses'
import { getMasterProducts } from '@/lib/supabase/queries/menu'
import { getWeekCoverage } from '@/lib/upload/coverage'
import { pickAgentsAfterUpload } from '@/lib/ai/agents/after-upload'
import ManualAdjustments from '@/components/settings/ManualAdjustments'
import IncomeBasisToggle from '@/components/settings/IncomeBasisToggle'
import RecalcButton from '@/components/settings/RecalcButton'
import { getManualAdjustments } from '@/lib/supabase/queries/adjustments'
import { getIncomeBasis } from '@/lib/supabase/queries/settings'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string; fix?: string }>
}

// 데이터 넣기 (파일 하나로 받기) + 데이터 고치기 (?fix= 통장 분류 · 메뉴 목록 · 수동 조정 · 계산 기준 — 고른 것만 불러옴)
const FIXES = [
  { key: 'bank', label: '통장 거래 분류' },
  { key: 'menu', label: '메뉴 목록' },
  { key: 'adjust', label: '수동 조정' },
  { key: 'basis', label: '계산 기준' },
]
export default async function UploadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const fix = FIXES.some((f) => f.key === params.fix) ? params.fix! : 'bank'
  const [history, coverage] = await Promise.all([getUploadHistory(), getWeekCoverage()])

  let fixView: React.ReactNode
  if (fix === 'menu') fixView = <MasterManager products={await getMasterProducts()} />
  else if (fix === 'adjust') fixView = <ManualAdjustments items={await getManualAdjustments()} />
  else if (fix === 'basis')
    fixView = (
      <div className="space-y-6">
        <IncomeBasisToggle initialValue={await getIncomeBasis()} />
        <RecalcButton />
      </div>
    )
  else
    fixView = (
      <>
        <div className="flex justify-end mb-3">
          <MonthFilter year={year} month={month} />
        </div>
        <ReclassifyTable items={await getMonthlyAllTransactions(year, month)} />
      </>
    )
  // 체크리스트 문구용 — 이번 주 자동 분석을 이미 했는지 (AI는 실행하지 않음)
  const { weeklyDone } = await pickAgentsAfterUpload(coverage, false).catch(() => ({ weeklyDone: false }))

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="data" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">데이터 넣기<GuideLink id="data" /></h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">받은 파일을 끌어다 놓으면 종류를 알아보고 바로 저장해요</p>
      </div>

      <div className="mb-10">
        <UploadSection coverage={coverage} weeklyDone={weeklyDone} />
      </div>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-900">데이터 고치기</h2>
        </div>
        <div className="hidden md:block">
          <SubTabs items={FIXES} param="fix" />
          {fixView}
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
