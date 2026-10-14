import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'
import { isSunday, kstIso } from '@/lib/attendance/format'

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
  hourly_pay: number // 근무일지 업로드가 갱신하는 직원별 평일 시급
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
    supabase.from('staff').select('id, name, role, is_active, hire_date, hourly_pay').order('is_active', { ascending: false }).order('hire_date'),
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

// 매달 고정급 (점장 등) — system_settings.monthly_fixed_salary = [{ from: 'YYYY-MM', label, amount }] (바뀐 기록)
//   그 달에 적용되는 것 = from <= 그 달 중 가장 최근. 금액을 바꾸면 그 달부터 새 금액, 지난달은 예전 금액 그대로
//   그 달에 손으로 넣은 고정급(payroll_items kind=fixed_salary)이 있으면 자동 금액은 넣지 않음 (이중 계산 방지)
export type FixedSalaryEntry = { from: string; label: string; amount: number }

export async function getFixedSalaryHistory(): Promise<FixedSalaryEntry[]> {
  const supabase = createServerClient()
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'monthly_fixed_salary').maybeSingle()
  const list = Array.isArray(data?.value) ? (data.value as FixedSalaryEntry[]) : []
  return list.filter((e) => /^\d{4}-\d{2}$/.test(e.from) && typeof e.amount === 'number').sort((a, b) => a.from.localeCompare(b.from))
}

export function fixedSalaryFor(history: FixedSalaryEntry[], ym: string): FixedSalaryEntry | null {
  const e = [...history].reverse().find((h) => h.from <= ym)
  return e && e.amount > 0 ? e : null
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


// 기준 기록 — 같은 직원·같은 날 종이 근무일지(work_logs)와 QR(attendance_logs)이 둘 다 있으면 어느 쪽을 쓸지
//   paper(기본, QR과 병행하는 동안) / qr(QR로 넘어갈 때). 한쪽에만 있는 날은 있는 쪽을 씀
export type SourcePriority = 'paper' | 'qr'

export async function getSourcePriority(): Promise<SourcePriority> {
  const supabase = createServerClient()
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'attendance_source_priority').maybeSingle()
  return data?.value === 'qr' ? 'qr' : 'paper'
}

// ─────────────────────────────────────────────
// 근무일지 — 지금 쓰는 P.T. 근무일지 엑셀과 같은 구조
//   평일 근무 / 주일 근무 블록, 직원별 출근·퇴근·근무시간, 근무일수·근무시간·지급액
//   대상: 알바생(part_time)
//   날짜별 출처: 기준 기록 우선, 그날 그 기록이 없으면 다른 쪽 (mergeShifts)
// ─────────────────────────────────────────────

export type TimesheetDay = {
  clock_in: string        // 그날 첫 출근 (ISO)
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
  rates: { weekday: number | null; sunday: number | null } // 표시용 (그달 기록의 시급, 없으면 시급 이력)
  priority: SourcePriority   // 기준 기록
  shifts: Shift[]            // 그달 계산에 쓴 근무 (출처 표시용)
  missingRateDates: string[] // 시급을 알 수 없는 근무 날짜
  openCount: number          // 퇴근 누락 건수 (QR)
  payrollItems: PayrollItem[]
  total: number              // 평일 + 주일 + 수기 항목
}

// 근무 한 건 (출처 무관 공통 형태)
export type Shift = {
  staff_id: number
  name: string
  work_date: string
  clock_in: string
  clock_out: string | null
  minutes: number
  rate: number | null
  sunday: boolean
  source: 'paper' | 'qr'
  log_id: number | null // QR 기록 id (고치기용), 종이는 null
}

type StaffJoin = { id: number; name: string; role: string } | null
type PaperRow = { staff_id: number; date: string; start_time: string; end_time: string; hours_worked: number | null; hourly_rate: number | null; staff: StaffJoin }
type QrRow = { id: number; staff_id: number; work_date: string; clock_in: string; clock_out: string | null; minutes_worked: number | null; staff: StaffJoin }

async function paperShifts(start: string, end: string): Promise<Shift[]> {
  const supabase = createServerClient()
  const data = await fetchAllRows<PaperRow>(async (from, to) => {
    const res = await supabase
      .from('work_logs')
      .select('staff_id, date, start_time, end_time, hours_worked, hourly_rate, staff:staff_id (id, name, role)')
      .gte('date', start)
      .lt('date', end)
      .order('date')
      .order('start_time')
      .range(from, to)
    return { data: res.data as unknown as PaperRow[] | null, error: res.error }
  })
  const rows = data.filter((r) => r.staff?.role === 'part_time')
  // 종이 근무일지는 공휴일도 주일 블록(1.5배) → 그달 최저 시급보다 확실히 높으면 주일로 봄
  const minRate = new Map<string, number>()
  for (const r of rows) {
    const ym = r.date.slice(0, 7)
    const rate = Number(r.hourly_rate)
    if (rate > 0) minRate.set(ym, Math.min(minRate.get(ym) ?? Infinity, rate))
  }
  return rows.map((r) => {
    const staff = r.staff!
    const clockIn = kstIso(r.date, String(r.start_time).slice(0, 5))
    let clockOut = kstIso(r.date, String(r.end_time).slice(0, 5))
    if (clockOut <= clockIn) clockOut = new Date(new Date(clockOut).getTime() + 86400000).toISOString()
    const rate = Number(r.hourly_rate) > 0 ? Number(r.hourly_rate) : null
    const min = minRate.get(r.date.slice(0, 7)) ?? 0
    return {
      staff_id: staff.id,
      name: staff.name,
      work_date: r.date,
      clock_in: clockIn,
      clock_out: clockOut,
      minutes: Math.round(Number(r.hours_worked ?? 0) * 60),
      rate,
      sunday: isSunday(r.date) || (rate !== null && min > 0 && rate > min * 1.2),
      source: 'paper' as const,
      log_id: null,
    }
  })
}

async function qrShifts(start: string, end: string, rates: PayRate[]): Promise<Shift[]> {
  const supabase = createServerClient()
  const data = await fetchAllRows<QrRow>(async (from, to) => {
    const res = await supabase
      .from('attendance_logs')
      .select('id, staff_id, work_date, clock_in, clock_out, minutes_worked, staff:staff_id (id, name, role)')
      .gte('work_date', start)
      .lt('work_date', end)
      .order('clock_in')
      .range(from, to)
    return { data: res.data as unknown as QrRow[] | null, error: res.error }
  })
  return data
    .filter((r) => r.staff?.role === 'part_time')
    .map((r) => {
      const staff = r.staff!
      const sunday = isSunday(r.work_date)
      const rate = rateFor(rates, r.work_date)
      return {
        staff_id: staff.id,
        name: staff.name,
        work_date: r.work_date,
        clock_in: r.clock_in,
        clock_out: r.clock_out,
        minutes: r.minutes_worked ?? 0,
        rate: rate ? (sunday ? rate.sunday_hourly : rate.weekday_hourly) : null,
        sunday,
        source: 'qr' as const,
        log_id: r.id,
      }
    })
}

// 직원·날짜별로 기준 기록을 쓰고, 그날 그 기록이 없으면 다른 쪽
export function mergeShifts(paper: Shift[], qr: Shift[], priority: SourcePriority): Shift[] {
  const [first, second] = priority === 'qr' ? [qr, paper] : [paper, qr]
  const covered = new Set(first.map((s) => `${s.staff_id}|${s.work_date}`))
  return [...first, ...second.filter((s) => !covered.has(`${s.staff_id}|${s.work_date}`))]
}

export async function buildTimesheet(
  year: number,
  month: number,
  pre?: { rates: PayRate[]; priority: SourcePriority }
): Promise<Timesheet> {
  const { start, end } = monthRange(year, month)
  const [rates, priority] = pre ? [pre.rates, pre.priority] : await Promise.all([getPayRates(), getSourcePriority()])
  const [paper, qr, manualItems, fixedHistory] = await Promise.all([paperShifts(start, end), qrShifts(start, end, rates), getPayrollItems(year, month), getFixedSalaryHistory()])
  const shifts = mergeShifts(paper, qr, priority)
  // 매달 고정급 — 그 달에 손으로 넣은 고정급이 없을 때만 (id 음수 = 자동, 화면에서 지울 수 없음)
  const fixed = fixedSalaryFor(fixedHistory, start.slice(0, 7))
  const payrollItems: PayrollItem[] =
    fixed && !manualItems.some((i) => i.kind === 'fixed_salary')
      ? [...manualItems, { id: -1, year, month, staff_id: null, kind: 'fixed_salary', label: fixed.label, amount: fixed.amount }]
      : manualItems

  const dates: string[] = []
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) < end; d = new Date(d.getTime() + 86400000)) {
    dates.push(d.toISOString().slice(0, 10))
  }

  const emptyBlock = (): TimesheetBlock => ({ staff: [], days: {}, totals: {}, pay: 0 })
  const weekday = emptyBlock()
  const sunday = emptyBlock()
  const blockRates = { weekday: new Set<number>(), sunday: new Set<number>() }
  const missing = new Set<string>()
  let openCount = 0

  for (const s of [...shifts].sort((a, b) => a.clock_in.localeCompare(b.clock_in))) {
    const block = s.sunday ? sunday : weekday
    if (!block.days[s.staff_id]) {
      block.staff.push({ id: s.staff_id, name: s.name })
      block.days[s.staff_id] = {}
      block.totals[s.staff_id] = { days: 0, minutes: 0, pay: 0 }
    }
    const open = s.clock_out == null
    if (open) openCount++
    const day = block.days[s.staff_id][s.work_date]
    if (!day) {
      block.days[s.staff_id][s.work_date] = { clock_in: s.clock_in, clock_out: s.clock_out, minutes: s.minutes, open }
      block.totals[s.staff_id].days++
    } else {
      // 같은 날 여러 번 근무 → 첫 출근 ~ 마지막 퇴근, 근무 분은 합산
      day.minutes += s.minutes
      day.open = day.open || open
      if (s.clock_out && (!day.clock_out || s.clock_out > day.clock_out)) day.clock_out = s.clock_out
    }
    block.totals[s.staff_id].minutes += s.minutes
    if (s.rate === null) {
      missing.add(s.work_date)
      continue
    }
    blockRates[s.sunday ? 'sunday' : 'weekday'].add(s.rate)
    block.totals[s.staff_id].pay += (s.minutes / 60) * s.rate
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
    rates: {
      weekday: blockRates.weekday.size ? Math.max(...blockRates.weekday) : lastRate?.weekday_hourly ?? null,
      sunday: blockRates.sunday.size ? Math.max(...blockRates.sunday) : lastRate?.sunday_hourly ?? null,
    },
    priority,
    shifts,
    missingRateDates: [...missing].sort(),
    openCount,
    payrollItems,
    total: weekday.pay + sunday.pay + itemsTotal,
  }
}

// 누적 근무일지의 첫 달 — 종이·QR·수기 항목 중 가장 이른 달
export async function firstTimesheetMonth(): Promise<{ year: number; month: number } | null> {
  const supabase = createServerClient()
  const [w, a, p] = await Promise.all([
    supabase.from('work_logs').select('date').order('date').limit(1).maybeSingle(),
    supabase.from('attendance_logs').select('work_date').order('work_date').limit(1).maybeSingle(),
    supabase.from('payroll_items').select('year, month').order('year').order('month').limit(1).maybeSingle(),
  ])
  const candidates = [
    w.data?.date?.slice(0, 7),
    a.data?.work_date?.slice(0, 7),
    p.data ? `${p.data.year}-${String(p.data.month).padStart(2, '0')}` : undefined,
  ].filter((v): v is string => !!v)
  if (candidates.length === 0) return null
  const [y, m] = candidates.sort()[0].split('-').map(Number)
  return { year: y, month: m }
}

// 기간 안의 알바생 근무 (기준 기록으로 종이/QR 합침) — 비서 AI 근무시간 조회 · 전체 근무일지
export async function getShiftsBetween(start: string, endExclusive: string): Promise<Shift[]> {
  const [rates, priority] = await Promise.all([getPayRates(), getSourcePriority()])
  const [paper, qr] = await Promise.all([paperShifts(start, endExclusive), qrShifts(start, endExclusive, rates)])
  return mergeShifts(paper, qr, priority)
}

// 전체 근무일지 — 직원 × 월 근무시간·지급액 (기준 기록으로 합침, 수기 항목 제외)
export type MonthlyCell = { staff_id: number; ym: string; minutes: number; pay: number }

export async function getAllMonthlyTotals(): Promise<{ staff: { id: number; name: string; is_active: boolean }[]; cells: MonthlyCell[] }> {
  const supabase = createServerClient()
  const [shifts, { data: staff }] = await Promise.all([
    getShiftsBetween('2000-01-01', '2100-01-01'),
    supabase.from('staff').select('id, name, is_active'),
  ])
  const map = new Map<string, MonthlyCell>()
  for (const s of shifts) {
    const ym = s.work_date.slice(0, 7)
    const key = `${s.staff_id}|${ym}`
    const cell = map.get(key) ?? { staff_id: s.staff_id, ym, minutes: 0, pay: 0 }
    cell.minutes += s.minutes
    if (s.rate) cell.pay += (s.minutes / 60) * s.rate
    map.set(key, cell)
  }
  const cells = [...map.values()].map((c) => ({ ...c, pay: Math.round(c.pay) }))
  const ids = new Set(cells.map((c) => c.staff_id))
  return { staff: ((staff ?? []) as { id: number; name: string; is_active: boolean }[]).filter((s) => ids.has(s.id)), cells }
}
