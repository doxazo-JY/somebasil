import UploadSection from '@/components/upload/UploadSection'
import UploadHistory from '@/components/upload/UploadHistory'
import { getUploadHistory } from '@/lib/supabase/queries/upload'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const history = await getUploadHistory()

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
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
      <UploadHistory data={history} />
    </div>
  )
}
