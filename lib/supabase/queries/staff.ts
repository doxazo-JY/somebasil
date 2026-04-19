import { createServerClient } from '../server'

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

// 직원 상세
export async function getStaffById(id: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// 직원별 월별 인건비 그리드 (연도)
export async function getStaffSalaryGrid(year: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('staff_salary')
    .select('staff_id, month, amount')
    .eq('year', year)

  if (error) throw error
  return data ?? []
}

// 직원 출퇴근 기록 (월별)
export async function getWorkLogs(staffId: number, year: number, month: number) {
  const supabase = createServerClient()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('staff_id', staffId)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date')

  if (error) throw error
  return data ?? []
}

// 직원 추가
export async function createStaff(staff: {
  name: string
  role: string
  hire_date: string
  hourly_pay: number
  sunday_hourly_pay?: number
  tax_rate: number
}) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('staff')
    .insert({ ...staff, is_active: true })
    .select()
    .single()

  if (error) throw error
  return data
}

// 직원 정보 수정
export async function updateStaff(id: number, updates: Partial<{
  name: string
  role: string
  hire_date: string
  leave_date: string
  hourly_pay: number
  sunday_hourly_pay: number
  tax_rate: number
  is_active: boolean
}>) {
  const supabase = createServerClient()
  const { error } = await supabase.from('staff').update(updates).eq('id', id)
  if (error) throw error
}
