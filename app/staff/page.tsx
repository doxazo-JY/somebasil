import PageTabs from '@/components/ui/PageTabs'
import SubTabs from '@/components/ui/SubTabs'
import MonthFilter from '@/components/ui/MonthFilter'
import MonthOverview from '@/components/staff/MonthOverview'
import StaffMonthTable from '@/components/staff/StaffMonthTable'
import StaffMonthlyGrid from '@/components/staff/StaffMonthlyGrid'
import StaffDeviceList from '@/components/staff/StaffDeviceList'
import AttendanceSettings from '@/components/staff/AttendanceSettings'
import {
  buildTimesheet,
  getAllMonthlyTotals,
  getMonthLogs,
  getOpenLogs,
  getPayRates,
  getQrSecret,
  getSourcePriority,
  getStaffWithDevices,
} from '@/lib/supabase/queries/attendance-admin'
import { kstDate } from '@/lib/attendance/tokens'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string; view?: string }>
}

// 직원 (운영 그룹) — 보기 2개 (?view=)
// - 근무(기본): 기준 기록 한 줄 + 이번 달 숫자·엑셀 → 직원별 이번 달 (누르면 날짜별 출퇴근·고정급/주휴) → 전체 근무일지(접힘)
// - 직원·설정(settings): 직원 목록(이름·폰·연결 QR·퇴사·삭제) + 기준 기록 · 카운터 QR · 시급
const VIEWS = [
  { key: 'work', label: '근무' },
  { key: 'settings', label: '직원·설정' },
]

export default async function StaffPage({ searchParams }: PageProps) {
  const params = await searchParams
  const today = kstDate(new Date())
  const [ty, tm] = today.split('-').map(Number)
  const year = Number(params.year) || ty
  const month = Number(params.month) || tm
  const view = params.view === 'settings' ? 'settings' : 'work'

  const [openLogs, staff] = await Promise.all([getOpenLogs(), getStaffWithDevices()])
  const working = openLogs.filter((l) => l.work_date === today)

  let body: React.ReactNode
  if (view === 'settings') {
    const [qrSecret, rates, priority] = await Promise.all([getQrSecret(), getPayRates(), getSourcePriority()])
    body = (
      <div className="space-y-4">
        <StaffDeviceList staff={staff} />
        <AttendanceSettings qrSecret={qrSecret} rates={rates} priority={priority} />
      </div>
    )
  } else {
    const [timesheet, logs, all] = await Promise.all([buildTimesheet(year, month), getMonthLogs(year, month), getAllMonthlyTotals()])
    const staffOptions = staff.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))
    body = (
      <div className="space-y-4">
        <div className="flex justify-end">
          <MonthFilter year={year} month={month} />
        </div>
        <MonthOverview ts={timesheet} />
        <StaffMonthTable ts={timesheet} logs={logs} openLogs={openLogs} staffOptions={staffOptions} today={today} />
        <StaffMonthlyGrid staffList={all.staff} cells={all.cells} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="operations" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">직원</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {working.length > 0 ? `지금 근무 중: ${working.map((l) => l.staff_name).join(', ')}` : '지금 근무 중인 직원 없음'}
        </p>
      </div>
      <SubTabs items={VIEWS} />
      {body}
    </div>
  )
}
