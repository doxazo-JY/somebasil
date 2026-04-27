import PageTabs from '@/components/ui/PageTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import UploadSection from '@/components/upload/UploadSection'
import UploadHistory from '@/components/upload/UploadHistory'
import ReclassifyTable from '@/components/expenses/ReclassifyTable'
import MasterManager from '@/components/menu/MasterManager'
import { getUploadHistory } from '@/lib/supabase/queries/upload'
import { getMonthlyAllTransactions } from '@/lib/supabase/queries/expenses'
import { getMasterProducts } from '@/lib/supabase/queries/menu'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function UploadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const [history, allTransactions, masterProducts] = await Promise.all([
    getUploadHistory(),
    getMonthlyAllTransactions(year, month),
    getMasterProducts(),
  ])

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">데이터 업로드</h1>
        <p className="text-sm text-gray-400 mt-0.5">파일 업로드 + 자동 분류 결과 재분류</p>
      </div>

      {/* 업로드 영역 — 탭별로 추가 도구 노출 */}
      <div className="mb-8">
        <UploadSection
          bankExtras={
            <div className="mt-6">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  거래 재분류
                </p>
                <MonthFilter year={year} month={month} />
              </div>
              <ReclassifyTable items={allTransactions} />
            </div>
          }
          menuExtras={<MasterManager products={masterProducts} />}
        />
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
