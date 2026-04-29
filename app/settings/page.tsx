import PageTabs from '@/components/ui/PageTabs'
import ManualAdjustments from '@/components/settings/ManualAdjustments'
import RecalcButton from '@/components/settings/RecalcButton'
import { getManualAdjustments } from '@/lib/supabase/queries/adjustments'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const adjustments = await getManualAdjustments()

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-400 mt-0.5">수동 조정과 운영 도구</p>
      </div>

      {/* 수동 조정 */}
      <div className="mb-6">
        <ManualAdjustments items={adjustments} />
      </div>

      {/* 월별 요약 재계산 (관리 도구) */}
      <RecalcButton />
    </div>
  )
}
