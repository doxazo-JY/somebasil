import LoanSection from '@/components/settings/LoanSection'
import {
  getLoans,
  getLoanBalance,
  getLoanBalanceByCounterpart,
} from '@/lib/supabase/queries/loans'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [loans, balance, byCounterpart] = await Promise.all([
    getLoans(),
    getLoanBalance(),
    getLoanBalanceByCounterpart(),
  ])

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-400 mt-0.5">대여금 관리 및 기본 설정</p>
      </div>

      {/* 대여금 관리 */}
      <div className="mb-8">
        <LoanSection loans={loans} balance={balance} byCounterpart={byCounterpart} />
      </div>
    </div>
  )
}
