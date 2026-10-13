import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// 전체 직원 목록
export async function getStaffList(includeInactive = false) {
  const supabase = createServerClient()
  let query = supabase
    .from('staff')
    .select('*')
    .order('is_active', { ascending: false })
    .order('hire_date')

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// 직원 × 월 근무시간/지급액 (근무일지 업로드 기준, 연도 구분 없이 전체 기간)
export interface StaffMonthCell {
  staff_id: number
  ym: string // 'YYYY-MM'
  hours: number
  amount: number
}

export async function getStaffMonthlyGrid(): Promise<StaffMonthCell[]> {
  const supabase = createServerClient()
  const [logs, salaries] = await Promise.all([
    fetchAllRows<{ staff_id: number; date: string; hours_worked: number | null }>((from, to) =>
      supabase.from('work_logs').select('staff_id, date, hours_worked').range(from, to),
    ),
    supabase.from('staff_salary').select('staff_id, year, month, amount'),
  ])
  if (salaries.error) throw salaries.error

  const map = new Map<string, StaffMonthCell>()
  const get = (staffId: number, ym: string) => {
    const key = `${staffId}|${ym}`
    const cell = map.get(key) ?? { staff_id: staffId, ym, hours: 0, amount: 0 }
    map.set(key, cell)
    return cell
  }
  for (const l of logs) get(l.staff_id, l.date.slice(0, 7)).hours += Number(l.hours_worked ?? 0)
  for (const s of salaries.data ?? []) {
    get(s.staff_id, `${s.year}-${String(s.month).padStart(2, '0')}`).amount += s.amount
  }
  return [...map.values()]
}
