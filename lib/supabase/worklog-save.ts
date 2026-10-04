import type { createServerClient } from './server'
import type { WorkShift, WorklogStaff } from '@/lib/worklog-parser'

type Supabase = ReturnType<typeof createServerClient>

// 근무일지 저장
// 1) 직원 이름으로 staff 매칭 — 없으면 알바생(part_time)으로 자동 등록
// 2) 파일에 포함된 월 × 파일 속 직원의 work_logs를 지우고 다시 넣음 (같은 파일 재업로드해도 중복 X)
// 3) staff_salary = 월별 Σ(근무시간 × 블록 시급). 주휴수당 미포함 — 근무일지 "총 지급액"과 같은 기준
export async function saveWorklog(
  supabase: Supabase,
  shifts: WorkShift[],
  staffSummary: WorklogStaff[],
  months: string[],
): Promise<{ createdStaff: string[]; savedShifts: number }> {
  const latestMonth = months[months.length - 1]

  // 1) 직원 매칭/등록
  const { data: existing, error: staffErr } = await supabase.from('staff').select('id, name')
  if (staffErr) throw staffErr
  const idByName = new Map((existing ?? []).map((s) => [s.name as string, s.id as number]))

  const createdStaff: string[] = []
  for (const s of staffSummary) {
    const weekdayRate = s.weekdayRate ?? (s.sundayRate ? Math.round(s.sundayRate / 1.5) : 0)
    const fields = {
      hourly_pay: weekdayRate,
      sunday_hourly_pay: s.sundayRate ?? Math.round(weekdayRate * 1.5),
      // 파일의 마지막 달에 근무 기록이 있으면 재직 중으로 간주
      is_active: s.lastDate.slice(0, 7) === latestMonth,
    }
    const id = idByName.get(s.name)
    if (id) {
      const { error } = await supabase.from('staff').update(fields).eq('id', id)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('staff')
        .insert({ name: s.name, role: 'part_time', hire_date: s.firstDate, ...fields })
        .select('id')
        .single()
      if (error) throw error
      idByName.set(s.name, data.id)
      createdStaff.push(s.name)
    }
  }

  const staffIds = staffSummary.map((s) => idByName.get(s.name)!)

  // 2) 해당 월 기록 교체
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number)
    const start = `${ym}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    const { error } = await supabase
      .from('work_logs')
      .delete()
      .in('staff_id', staffIds)
      .gte('date', start)
      .lt('date', end)
    if (error) throw error
  }

  const inserts = shifts.map((s) => ({
    staff_id: idByName.get(s.name)!,
    date: s.date,
    start_time: s.start,
    end_time: s.end,
    // hours_worked는 DB generated column (출퇴근 시각으로 자동 계산)
    hourly_rate: s.rate, // 근무 당시 시급 (평일/주일·연도별로 다름)
  }))
  const CHUNK = 500
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const { error } = await supabase.from('work_logs').insert(inserts.slice(i, i + CHUNK))
    if (error) throw error
  }

  // 3) 월별 지급액
  const pay = new Map<string, { staff_id: number; year: number; month: number; amount: number }>()
  for (const s of shifts) {
    const staffId = idByName.get(s.name)!
    const [year, month] = s.date.split('-').map(Number)
    const key = `${staffId}|${year}|${month}`
    const cur = pay.get(key) ?? { staff_id: staffId, year, month, amount: 0 }
    cur.amount += s.hours * s.rate
    pay.set(key, cur)
  }
  const salaryRows = [...pay.values()].map((p) => ({ ...p, amount: Math.round(p.amount) }))
  if (salaryRows.length > 0) {
    const { error } = await supabase
      .from('staff_salary')
      .upsert(salaryRows, { onConflict: 'staff_id,year,month' })
    if (error) throw error
  }

  return { createdStaff, savedShifts: inserts.length }
}
