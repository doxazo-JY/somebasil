import PageTabs from '@/components/ui/PageTabs'
import OwnerToggle from '@/components/settings/OwnerToggle'
import ManualAdjustments from '@/components/settings/ManualAdjustments'
import { getIncludeOwnerPersonal } from '@/lib/supabase/queries/settings'
import { getManualAdjustments } from '@/lib/supabase/queries/adjustments'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getOwnerExpenseStats() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('monthly_expenses')
    .select('amount')
    .eq('category', 'excluded')

  const count = data?.length ?? 0
  const total = (data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  return { count, total }
}

export default async function SettingsPage() {
  const [includeOwner, adjustments, ownerStats] = await Promise.all([
    getIncludeOwnerPersonal(),
    getManualAdjustments(),
    getOwnerExpenseStats(),
  ])

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-400 mt-0.5">집계 예외 처리와 수동 조정</p>
      </div>

      {/* 대표 토글 */}
      <div className="mb-6">
        <OwnerToggle
          initialValue={includeOwner}
          ownerExpenseCount={ownerStats.count}
          ownerExpenseTotal={ownerStats.total}
        />
      </div>

      {/* 수동 조정 */}
      <ManualAdjustments items={adjustments} />
    </div>
  )
}
