import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStaffById, getWorkLogs, getStaffSalaryHistory } from '@/lib/supabase/queries/staff'
import WorkLogSection from '@/components/staff/WorkLogSection'
import WorkCalendar from '@/components/staff/WorkCalendar'
import EditStaffButton from '@/components/staff/EditStaffButton'
import PastSalarySection from '@/components/staff/PastSalarySection'
import MonthFilter from '@/components/ui/MonthFilter'

const ROLE_LABEL: Record<string, string> = {
  manager: '점장',
  assistant: '매니저',
  part_time: '알바생',
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function StaffDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { year: yearStr, month: monthStr } = await searchParams

  const staffId = Number(id)
  if (isNaN(staffId)) notFound()

  const now = new Date()
  const year = yearStr ? Number(yearStr) : now.getFullYear()
  const month = monthStr ? Number(monthStr) : now.getMonth() + 1

  const [staff, logs, salaryHistory] = await Promise.all([
    getStaffById(staffId),
    getWorkLogs(staffId, year, month),
    getStaffSalaryHistory(staffId),
  ])

  if (!staff) notFound()

  return (
    <div className="px-16 py-8 w-full flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 직원 목록
          </Link>
          <span className="text-gray-200">|</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">{staff.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {ROLE_LABEL[staff.role] ?? staff.role}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                staff.is_active ? 'bg-green-50 text-[#1a5c3a]' : 'bg-gray-100 text-gray-400'
              }`}>
                {staff.is_active ? '재직중' : '퇴직'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              입사일 {staff.hire_date} · 시급 {staff.hourly_pay.toLocaleString()}원
              {staff.sunday_hourly_pay
                ? ` · 일요일 ${staff.sunday_hourly_pay.toLocaleString()}원`
                : ''}
              {' '}· 세금 {staff.tax_rate}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditStaffButton staff={staff} />
          <MonthFilter year={year} month={month} />
        </div>
      </div>

      {/* 이번 달 급여 요약 */}
      <WorkLogSection
        hourlyPay={staff.hourly_pay}
        sundayHourlyPay={staff.sunday_hourly_pay ?? null}
        taxRate={staff.tax_rate}
        logs={logs}
      />

      {/* 출퇴근 달력 */}
      <WorkCalendar
        staffId={staffId}
        logs={logs}
        year={year}
        month={month}
      />

      {/* 인건비 이력 (과거 직접 입력 포함) */}
      <PastSalarySection staffId={staffId} salaries={salaryHistory} />
    </div>
  )
}
