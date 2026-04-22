import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 근무 시간 계산 (시간 단위, 소수점 2자리)
function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // 자정 넘어가는 경우
  return Math.round((mins / 60) * 100) / 100
}

// 출퇴근 기록 추가
export async function POST(req: NextRequest) {
  const { staff_id, date, start_time, end_time } = await req.json()
  const supabase = createServerClient()

  const hours_worked = calcHours(start_time, end_time)

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ staff_id, date, start_time, end_time, hours_worked })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 월별 급여 재계산 → staff_salary upsert
  await recalcMonthlySalary(supabase, staff_id, date)

  return NextResponse.json(data)
}

// 출퇴근 기록 삭제
export async function DELETE(req: NextRequest) {
  const { id, staff_id, date } = await req.json()
  const supabase = createServerClient()

  const { error } = await supabase.from('work_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recalcMonthlySalary(supabase, staff_id, date)
  return NextResponse.json({ ok: true })
}

// 월별 급여 재계산
async function recalcMonthlySalary(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServerClient>,
  staffId: number,
  date: string
) {
  const [year, month] = date.split('-').map(Number)

  // 직원 정보 (시급, 일요일 시급)
  const { data: staff } = await supabase
    .from('staff')
    .select('hourly_pay, sunday_hourly_pay, tax_rate')
    .eq('id', staffId)
    .single()

  if (!staff) return

  // 해당 월 전체 work_logs 조회
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data: logs } = await supabase
    .from('work_logs')
    .select('date, hours_worked')
    .eq('staff_id', staffId)
    .gte('date', startDate)
    .lt('date', endDate)

  if (!logs) return

  // 기본 급여 계산 (요일별 시급 적용)
  let basePay = 0
  for (const log of logs) {
    const dayOfWeek = new Date(log.date).getDay() // 0=일
    const rate =
      dayOfWeek === 0 && staff.sunday_hourly_pay
        ? staff.sunday_hourly_pay
        : staff.hourly_pay
    basePay += (log.hours_worked ?? 0) * rate
  }

  // 주휴수당 계산 (주 15시간 이상인 주만)
  const weeklyHours = groupByWeek(logs)
  let weeklyAllowance = 0
  for (const hours of Object.values(weeklyHours)) {
    if (hours >= 15) {
      weeklyAllowance += (hours / 40) * 8 * staff.hourly_pay
    }
  }

  const grossPay = Math.round(basePay + weeklyAllowance)

  // staff_salary upsert (세전 기준으로 저장)
  await supabase.from('staff_salary').upsert(
    { staff_id: staffId, year, month, amount: grossPay },
    { onConflict: 'staff_id,year,month' }
  )
}

// 날짜별 로그를 주차별로 묶어서 시간 합산
function groupByWeek(logs: { date: string; hours_worked: number | null }[]) {
  const weekMap: Record<number, number> = {}
  for (const log of logs) {
    const d = new Date(log.date)
    // ISO 주차 계산
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    weekMap[weekNum] = (weekMap[weekNum] ?? 0) + (log.hours_worked ?? 0)
  }
  return weekMap
}
