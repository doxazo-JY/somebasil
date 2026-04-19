import UploadSection from '@/components/upload/UploadSection'
import UploadHistory from '@/components/upload/UploadHistory'
import DataEditor from '@/components/upload/DataEditor'
import MonthFilter from '@/components/ui/MonthFilter'
import { getUploadHistory, getEditableExpenses } from '@/lib/supabase/queries/upload'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function UploadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year ?? now.getFullYear())
  const month = Number(params.month ?? now.getMonth() + 1)

  const [history, expenses] = await Promise.all([
    getUploadHistory(),
    getEditableExpenses(year, month),
  ])

  return (
    <div className="px-16 py-8 w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">데이터 업로드</h1>
        <p className="text-sm text-gray-400 mt-0.5">파일을 업로드하여 자동 저장</p>
      </div>

      {/* 업로드 영역 */}
      <div className="mb-8">
        <UploadSection />
      </div>

      {/* 업로드 히스토리 */}
      <div className="mb-8">
        <UploadHistory data={history} />
      </div>

      {/* 저장된 데이터 수정 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            저장된 데이터 수정
          </p>
          <MonthFilter year={year} month={month} />
        </div>
        <DataEditor data={expenses} year={year} month={month} />
      </div>
    </div>
  )
}
