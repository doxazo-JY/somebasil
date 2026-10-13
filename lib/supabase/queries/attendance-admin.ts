import { createServerClient } from '../server'
import { isSunday } from '@/lib/attendance/format'

// 점장 관리 화면(/staff)용 출퇴근 쿼리

export type AdminLog = {
  id: number
  staff_id: number
  staff_name: string
  work_date: string
  clock_in: string
  clock_out: string | null
  qr_clock_in: string | null
  qr_clock_out: string | null
  minutes_worked: number | null
  edited_at: string | null
  edit_memo: string | null
}

export type StaffRow = {
  id: number
  name: string
  role: 'manager' | 'assistant' | 'part_time'
  is_active: boolean
  hire_date: string
  devices: { id: number; label: string | null; created_at: string; last_used_at: string | null }[]
}

export type PayRate = { effective_from: string; weekday_hourly: number; sunday_hourly: number }

export type PayrollItem = {
  id: number
  year: number
  month: number
  staff_id: number | null
  kind: 'fixed_salary' | 'weekly_holiday_pay' | 'other'
  label: string
  amount: number
}

export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, end }
}

// 해당 월 출퇴근 기록 (날짜 최신순)
export async function getMonthLogs(year: number, month: number): Promise<AdminLog[]> {
  const supabase = createServerClient()
  const { start, end } = monthRange(year, month)
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, staff_id, work_date, clock_in, clock_out, qr_clock_in, qr_clock_out, minutes_worked, edited_at, edit_memo, staff:staff_id (name)')
    .gte('work_date', start)
    .lt('work_date', end)
    .order('work_date', { ascending: false })
    .order('clock_in', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => {
    const { staff, ...rest } = r as typeof r & { staff: { name: string } | null }
    return { ...rest, staff_name: staff?.name ?? '(삭제된 직원)' } as AdminLog
  })
}

// 지금 근무 중인 기록 (이전 달에 퇴근 누락된 것까지)
export async function getOpenLogs(): Promise<AdminLog[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, staff_id, work_date, clock_in, clock_out, qr_clock_in, qr_clock_out, minutes_worked, edited_at, edit_memo, staff:staff_id (name)')
    .is('clock_out', null)
    .order('clock_in', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => {
    const { staff, ...rest } = r as typeof r & { staff: { name: string } | null }
    return { ...rest, staff_name: staff?.name ?? '(삭제된 직원)' } as AdminLog
  })
}

// 직원 + 사용 중인 폰
export async function getStaffWithDevices(): Promise<StaffRow[]> {
  const supabase = createServerClient()
  const [{ data: staff, error }, { data: devices }] = await Promise.all([
    supabase.from('staff').select('id, name, role, is_active, hire_date').order('is_active', { ascending: false }).order('hire_date'),
    supabase.from('staff_devices').select('id, staff_id, label, created_at, last_used_at').is('revoked_at', null).order('created_at'),
  ])
  if (error) throw error
  return (staff ?? []).map((s) => ({
    ...(s as Omit<StaffRow, 'devices'>),
    devices: (devices ?? []).filter((d) => d.staff_id === s.id),
  }))
}

export async function getQrSecret(): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'attendance_qr_secret').maybeSingle()
  return typeof data?.value === 'string' ? data.value : null
}

export async function getPayRates(): Promise<PayRate[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('pay_rates').select('*').order('effective_from', { ascending: false })
  if (error) throw error
  return (data ?? []) as PayRate[]
}

export async function getPayrollItems(year: number, month: number): Promise<PayrollItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('payroll_items')
    .select('id, year, month, staff_id, kind, label, amount')
    .eq('year', year)
    .eq('month', month)
    .order('kind')
    .order('id')
  if (error) throw error
  return (data ?? []) as PayrollItem[]
}

// 날짜에 적용되는 시급 (effective_from <= 날짜 중 최신). rates는 최신순 정렬 가정
export function rateFor(rates: PayRate[], workDate: string): PayRate | null {
  return rates.find((r) => r.effective_from <= workDate) ?? null
}

// ─────────────────────────────────────────────
// 근무일지 — 지금 쓰는 P.T. 근무일지 엑셀과 같은 구조
//   평일 근무 / 주일 근무 블록, 직원별 출근·퇴근·근무시간, 근무일수·근무시간·지급액
//   대상: 알바생(part_time) 중 그달 기록이 있는 직원
// ─────────────────────────────────────────────

export type TimesheetDay = {
  clock_in: string        // 그날 첫 출근
  clock_out: string | null // 그날 마지막 퇴근 (근무 중/누락이면 null)
  minutes: number          // 그날 근무 분 합계 (퇴근 기록된 것만)
  open: boolean            // 퇴근 기록 없는 근무가 있음
}

export type TimesheetBlock = {
  staff: { id: number; name: string }[]
  days: Record<number, Record<string, TimesheetDay>> // staff_id → work_date → day
  totals: Record<number, { days: number; minutes: number; pay: number }>
  pay: number
}

export type Timesheet = {
  year: number
  month: number
  dates: string[] // 그달 모든 날짜
  weekday: TimesheetBlock
  sunday: TimesheetBlock
  rates: { weekday: number | null; sunday: number | null } // 그달 말일 기준 (표시용)
  missingRateDates: string[] // 시급이 등록 안 된 근무 날짜
  openCount: number          // 퇴근 누락 건수
  payrollItems: PayrollItem[]
  total: number              // 평일 + 주일 + 수기 항목
}

export async function buildTimesheet(year: number, month: number): Promise<Timesheet> {
  const supabase = createServerClient()
  const { start, end } = monthRange(year, month)
  const [{ data: logs, error }, rates, payrollItems] = await Promise.all([
    supabase
      .from('attendance_logs')
      .select('staff_id, work_date, clock_in, clock_out, minutes_worked, staff:staff_id (id, name, role)')
      .gte('work_date', start)
      .lt('work_date', end)
      .order('clock_in'),
    getPayRates(),
    getPayrollItems(year, month),
  ])
  if (error) throw error

  const dates: string[] = []
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) < end; d = new Date(d.getTime() + 86400000)) {
    dates.push(d.toISOString().slice(0, 10))
  }

  const emptyBlock = (): TimesheetBlock => ({ staff: [], days: {}, totals: {}, pay: 0 })
  const weekday = emptyBlock()
  const sunday = emptyBlock()
  const missing = new Set<string>()
  let openCount = 0

  for (const row of logs ?? []) {
    const s = (row as unknown as { staff: { id: number; name: string; role: string } | null }).staff
    if (!s || s.role !== 'part_time') continue
    const block = isSunday(row.work_date) ? sunday : weekday
    if (!block.days[s.id]) {
      block.staff.push({ id: s.id, name: s.name })
      block.days[s.id] = {}
      block.totals[s.id] = { days: 0, minutes: 0, pay: 0 }
    }
    const open = row.clock_out == null
    if (open) openCount++
    const minutes = row.minutes_worked ?? 0
    const day = block.days[s.id][row.work_date]
    if (!day) {
      block.days[s.id][row.work_date] = { clock_in: row.clock_in, clock_out: row.clock_out, minutes, open }
      block.totals[s.id].days++
    } else {
      // 같은 날 여러 번 근무 → 첫 출근 ~ 마지막 퇴근, 근무 분은 합산
      day.minutes += minutes
      day.open = day.open || open
      if (row.clock_out && (!day.clock_out || row.clock_out > day.clock_out)) day.clock_out = row.clock_out
    }
    block.totals[s.id].minutes += minutes

    const rate = rateFor(rates, row.work_date)
    if (!rate) {
      missing.add(row.work_date)
      continue
    }
    const hourly = block === sunday ? rate.sunday_hourly : rate.weekday_hourly
    block.totals[s.id].pay += (minutes / 60) * hourly
  }

  for (const block of [weekday, sunday]) {
    for (const t of Object.values(block.totals)) t.pay = Math.round(t.pay)
    block.pay = Object.values(block.totals).reduce((sum, t) => sum + t.pay, 0)
  }

  const lastRate = rateFor(rates, dates[dates.length - 1])
  const itemsTotal = payrollItems.reduce((sum, i) => sum + i.amount, 0)

  return {
    year,
    month,
    dates,
    weekday,
    sunday,
    rates: { weekday: lastRate?.weekday_hourly ?? null, sunday: lastRate?.sunday_hourly ?? null },
    missingRateDates: [...missing].sort(),
    openCount,
    payrollItems,
    total: weekday.pay + sunday.pay + itemsTotal,
  }
}
