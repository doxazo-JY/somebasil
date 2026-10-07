import Link from 'next/link'
import PageTabs from '@/components/ui/PageTabs'
import StatCard from '@/components/ui/StatCard'
import StaffTable from '@/components/staff/StaffTable'
import StaffMonthlyGrid from '@/components/staff/StaffMonthlyGrid'
import { getStaffList, getStaffMonthlyGrid } from '@/lib/supabase/queries/staff'

export const dynamic = 'force-dynamic'

// 직원 페이지 — 근무일지 업로드(관리 > 업로드 > 근무일지)로 채워지는 조회 전용 화면
// 수정/수동 출퇴근 입력은 업로드로 대체. 점장·매니저 등 근무일지 밖 인원은 아직 없음
export default async function StaffPage() {
  const [staffList, cells] = await Promise.all([getStaffList(true), getStaffMonthlyGrid()])

  const months = [...new Set(cells.map((c) => c.ym))].sort()
  const latest = months[months.length - 1]
  const prev = months[months.length - 2]
  const sumOf = (ym: string | undefined, key: 'hours' | 'amount') =>
    ym ? cells.filter((c) => c.ym === ym).reduce((s, c) => s + c[key], 0) : 0
  const latestAmount = sumOf(latest, 'amount')
  const prevAmount = sumOf(prev, 'amount')
  const activeCount = staffList.filter((s) => s.is_active).length
  const latestLabel = latest ? `${Number(latest.slice(5))}월` : ''

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">직원</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          알바 근무일지 기준 · 갱신은{' '}
          <Link href="/upload" className="text-[#1a5c3a] hover:underline">
            업로드 &gt; 근무일지
          </Link>
          에서
        </p>
      </div>

      {staffList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
          아직 직원 데이터가 없습니다. 업로드 &gt; 근무일지에서 엑셀을 올려주세요.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <StatCard label="재직 중 알바" value={`${activeCount}명`} subLabel={`전체 ${staffList.length}명`} />
            <StatCard
              label={`${latestLabel} 알바 지급액`}
              value={`${Math.round(latestAmount / 10000).toLocaleString()}만`}
              change={prevAmount > 0 ? ((latestAmount - prevAmount) / prevAmount) * 100 : undefined}
              subLabel="전월比"
            />
            <StatCard
              label={`${latestLabel} 근무시간`}
              value={`${Math.round(sumOf(latest, 'hours'))}시간`}
              className="col-span-2 lg:col-span-1"
            />
          </div>
          <div className="mb-4">
            <StaffMonthlyGrid staffList={staffList} cells={cells} />
          </div>
          <StaffTable data={staffList} />
        </>
      )}
    </div>
  )
}
