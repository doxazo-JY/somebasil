import PageTabs from '@/components/ui/PageTabs'

export const dynamic = 'force-dynamic'

// 직원/인건비 페이지 — 데이터 소스(회계사 데이터) 및 관리 방식 협의 중
// 기존 staff/work_logs/staff_salary 테이블 및 컴포넌트는 보존됨 (재개 시 복구)
export default function StaffPage() {
  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">직원 관리</h1>
      </div>

      {/* 미구현 안내 */}
      <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
        <p className="text-3xl mb-3">🛠️</p>
        <p className="text-sm font-semibold text-gray-700">추후 구현 예정입니다</p>
      </div>
    </div>
  )
}
