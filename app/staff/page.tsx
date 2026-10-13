import Link from 'next/link'
import PageTabs from '@/components/ui/PageTabs'
import StatCard from '@/components/ui/StatCard'
import MonthFilter from '@/components/ui/MonthFilter'
import StaffTable from '@/components/staff/StaffTable'
import StaffMonthlyGrid from '@/components/staff/StaffMonthlyGrid'
import StaffTabs from '@/components/staff/StaffTabs'
import AttendanceLogTable from '@/components/staff/AttendanceLogTable'
import TimesheetPanel from '@/components/staff/TimesheetPanel'
import StaffDeviceList from '@/components/staff/StaffDeviceList'
import AttendanceSettings from '@/components/staff/AttendanceSettings'
import { getStaffList, getStaffMonthlyGrid } from '@/lib/supabase/queries/staff'
import {
  buildTimesheet,
  getMonthLogs,
  getOpenLogs,
  getPayRates,
  getQrSecret,
  getStaffWithDevices,
} from '@/lib/supabase/queries/attendance-admin'
import { kstDate } from '@/lib/attendance/tokens'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

// 직원 페이지
// - 요약: 근무일지 업로드(관리 > 업로드 > 근무일지, work_logs) 기준 조회 — 현재 공식 기록
// - 출퇴근 탭들: QR 출퇴근(attendance_logs) — 종이 근무일지와 병행 시험 운영 중
//   병행 기간 후 QR 기록을 work_logs로 이어 요약·수익 진단도 QR 기준으로 갱신 예정
export default async function StaffPage({ searchParams }: PageProps) {
  const params = await searchParams
  const today = kstDate(new Date())
  const [ty, tm] = today.split('-').map(Number)
  const year = Number(params.year) || ty
  const month = Number(params.month) || tm

  const [staffList, cells, logs, openLogs, staffDevices, qrSecret, rates, timesheet] = await Promise.all([
    getStaffList(true),
    getStaffMonthlyGrid(),
    getMonthLogs(year, month),
    getOpenLogs(),
    getStaffWithDevices(),
    getQrSecret(),
    getPayRates(),
    buildTimesheet(year, month),
  ])

  // 요약 (근무일지 업로드 기준)
  const months = [...new Set(cells.map((c) => c.ym))].sort()
  const latest = months[months.length - 1]
  const prev = months[months.length - 2]
  const sumOf = (ym: string | undefined, key: 'hours' | 'amount') =>
    ym ? cells.filter((c) => c.ym === ym).reduce((s, c) => s + c[key], 0) : 0
  const latestAmount = sumOf(latest, 'amount')
  const prevAmount = sumOf(prev, 'amount')
  const activeCount = staffList.filter((s) => s.is_active).length
  const latestLabel = latest ? `${Number(latest.slice(5))}월` : ''

  // 출퇴근 (QR 기준)
  const staffOptions = staffDevices.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))
  const working = openLogs.filter((l) => l.work_date === today)

  const summary =
    staffList.length === 0 ? (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
        아직 직원 데이터가 없습니다. 업로드 &gt; 근무일지에서 엑셀을 올려주세요.
      </div>
    ) : (
      <>
        <p className="text-xs text-gray-400 mb-3 [word-break:keep-all]">
          알바 근무일지 기준 · 갱신은{' '}
          <Link href="/upload" className="text-[#1a5c3a] hover:underline">업로드 &gt; 근무일지</Link>
          에서
        </p>
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
    )

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />

      {/* 헤더 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">직원</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {working.length > 0 ? `지금 근무 중: ${working.map((l) => l.staff_name).join(', ')}` : '지금 근무 중인 직원 없음'}
          </p>
        </div>
        <MonthFilter year={year} month={month} />
      </div>

      <StaffTabs
        sections={{
          summary,
          logs: <AttendanceLogTable logs={logs} openLogs={openLogs} staffOptions={staffOptions} today={today} />,
          timesheet: <TimesheetPanel ts={timesheet} staffOptions={staffOptions} />,
          staff: <StaffDeviceList staff={staffDevices} />,
          settings: <AttendanceSettings qrSecret={qrSecret} rates={rates} />,
        }}
      />
    </div>
  )
}
