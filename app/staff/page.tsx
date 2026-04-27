import { getStaffList, getStaffSalaryGrid } from '@/lib/supabase/queries/staff'
import StaffTable from '@/components/staff/StaffTable'
import LaborGrid from '@/components/staff/LaborGrid'
import AddStaffButton from '@/components/staff/AddStaffButton'
import PageTabs from '@/components/ui/PageTabs'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const now = new Date()
  const year = now.getFullYear()

  const [staffList, salaries] = await Promise.all([
    getStaffList(true), // 퇴직자 포함
    getStaffSalaryGrid(year),
  ])

  const activeStaff = staffList.filter((s) => s.is_active)
  const inactiveStaff = staffList.filter((s) => !s.is_active)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full flex flex-col gap-6">
      <PageTabs group="admin" />
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">직원 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">출퇴근 기록 및 급여 관리</p>
        </div>
        <AddStaffButton />
      </div>

      {/* 재직 중 직원 */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          재직 중 · {activeStaff.length}명
        </p>
        <StaffTable data={activeStaff} />
      </div>

      {/* 퇴직 직원 */}
      {inactiveStaff.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            퇴직 · {inactiveStaff.length}명
          </p>
          <StaffTable data={inactiveStaff} />
        </div>
      )}

      {/* 인건비 그리드 */}
      <LaborGrid staffList={staffList} salaries={salaries} year={year} />
    </div>
  )
}
