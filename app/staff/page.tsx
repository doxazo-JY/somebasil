import Link from 'next/link'
import PageTabs from '@/components/ui/PageTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import StaffMonthlyGrid from '@/components/staff/StaffMonthlyGrid'
import StaffTabs from '@/components/staff/StaffTabs'
import AttendanceLogTable from '@/components/staff/AttendanceLogTable'
import TimesheetPanel, { MonthOverview } from '@/components/staff/TimesheetPanel'
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

// 직원 페이지 — 탭 2개
// - 근무: QR 출퇴근 기준 월 정리(숫자·엑셀) → 출퇴근 기록 → 직원별 합계·수기 항목
//         맨 아래 종이 근무일지(업로드, work_logs) 기준 표 — 병행 기간 동안만, 끝나면 제거
// - 직원·설정: 직원 목록(폰·연결 QR·퇴사·삭제) + 카운터 QR·시급
export default async function StaffPage({ searchParams }: PageProps) {
  const params = await searchParams
  const today = kstDate(new Date())
  const [ty, tm] = today.split('-').map(Number)
  const year = Number(params.year) || ty
  const month = Number(params.month) || tm

  const [paperStaff, paperCells, logs, openLogs, staff, qrSecret, rates, timesheet] = await Promise.all([
    getStaffList(true),
    getStaffMonthlyGrid(),
    getMonthLogs(year, month),
    getOpenLogs(),
    getStaffWithDevices(),
    getQrSecret(),
    getPayRates(),
    buildTimesheet(year, month),
  ])

  const staffOptions = staff.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))
  const working = openLogs.filter((l) => l.work_date === today)

  const work = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MonthFilter year={year} month={month} />
      </div>
      <MonthOverview ts={timesheet} />
      <AttendanceLogTable logs={logs} openLogs={openLogs} staffOptions={staffOptions} today={today} />
      <TimesheetPanel ts={timesheet} staffOptions={staffOptions} />

      {/* 병행 기간 동안만 — 종이 근무일지 업로드 기준 (현재 공식 기록) */}
      {paperCells.length > 0 && (
        <div className="pt-4 space-y-2">
          <p className="text-xs text-gray-400 [word-break:keep-all]">
            종이 근무일지 기준 (QR과 병행하는 동안 공식 기록) · 갱신은{' '}
            <Link href="/upload" className="text-[#1a5c3a] hover:underline">업로드 &gt; 근무일지</Link>
          </p>
          <StaffMonthlyGrid staffList={paperStaff} cells={paperCells} />
        </div>
      )}
    </div>
  )

  const settings = (
    <div className="space-y-4">
      <StaffDeviceList staff={staff} />
      <AttendanceSettings qrSecret={qrSecret} rates={rates} />
    </div>
  )

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="admin" />

      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">직원</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {working.length > 0 ? `지금 근무 중: ${working.map((l) => l.staff_name).join(', ')}` : '지금 근무 중인 직원 없음'}
        </p>
      </div>

      <StaffTabs sections={{ work, settings }} />
    </div>
  )
}
