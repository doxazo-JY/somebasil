import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'

// 시간대별 인력 효율 — "손님 없는 시간에 사람이 너무 많지 않은가?"
// 근무일지(work_logs, 알바만) × POS 시간대 매출을 1시간 단위로 겹쳐서 비교
// 인건비 = 근무시간 × 근무 당시 시급(work_logs.hourly_rate, 없으면 직원 현재 시급). 점장·매니저 등 근무일지 밖 인원은 빠짐

export type DayType = 'weekday' | 'weekend'

export interface HourlyLaborCell {
  hour: number
  /** 하루 평균 그 시간 매출 */
  sales: number
  /** 하루 평균 그 시간 근무 인원 (명) */
  staff: number
  /** 하루 평균 그 시간 인건비 */
  laborCost: number
}

export interface HourlyLaborResult {
  months: { year: number; month: number }[]
  days: Record<DayType, number>
  cells: Record<DayType, HourlyLaborCell[]>
}

function kstParts(iso: string) {
  const kst = new Date(Date.parse(iso) + 9 * 3600 * 1000)
  return { hour: kst.getUTCHours() }
}

function dayTypeOf(date: string): DayType {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// 근무 기록이 있는 최근 N개 마감 월 기준
export async function getHourlyLaborEfficiency(monthCount = 3): Promise<HourlyLaborResult | null> {
  const supabase = createServerClient()

  const [logs, staffRes] = await Promise.all([
    fetchAllRows<{
      staff_id: number
      date: string
      start_time: string
      end_time: string
      hourly_rate: number | null
    }>((from, to) =>
      supabase
        .from('work_logs')
        .select('staff_id, date, start_time, end_time, hourly_rate')
        .range(from, to),
    ),
    supabase.from('staff').select('id, hourly_pay, sunday_hourly_pay'),
  ])
  if (staffRes.error) throw staffRes.error
  if (logs.length === 0) return null

  const ymKeys = [...new Set(logs.map((l) => l.date.slice(0, 7)))].sort().slice(-monthCount)
  const months = ymKeys.map((k) => ({ year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)) }))
  const startDate = `${ymKeys[0]}-01`
  const last = months[months.length - 1]
  const endDate =
    last.month === 12 ? `${last.year + 1}-01-01` : `${last.year}-${String(last.month + 1).padStart(2, '0')}-01`

  const sales = await fetchAllRows<{ date: string; order_time: string | null; amount: number }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('date, order_time, amount')
        .eq('source', 'pos')
        .gte('date', startDate)
        .lt('date', endDate)
        .range(from, to),
  )

  const rates = new Map(
    (staffRes.data ?? []).map((s) => [s.id as number, { weekday: s.hourly_pay as number, sunday: (s.sunday_hourly_pay ?? s.hourly_pay) as number }]),
  )

  // 합계 (type × hour)
  const blank = () => Array.from({ length: 24 }, () => ({ sales: 0, staffMin: 0, cost: 0 }))
  const acc: Record<DayType, ReturnType<typeof blank>> = { weekday: blank(), weekend: blank() }
  const openDays: Record<DayType, Set<string>> = { weekday: new Set(), weekend: new Set() }

  for (const r of sales) {
    if (!r.order_time) continue
    const type = dayTypeOf(r.date)
    openDays[type].add(r.date)
    acc[type][kstParts(r.order_time).hour].sales += r.amount
  }

  for (const l of logs) {
    if (l.date < startDate || l.date >= endDate) continue
    const type = dayTypeOf(l.date)
    const isSunday = new Date(`${l.date}T00:00:00Z`).getUTCDay() === 0
    const rate = rates.get(l.staff_id)
    const perHour = l.hourly_rate ?? (isSunday ? rate?.sunday : rate?.weekday) ?? 0
    let s = toMinutes(l.start_time)
    let e = toMinutes(l.end_time)
    if (e <= s) e += 24 * 60
    // 시간 칸마다 겹친 분 만큼 배분
    while (s < e) {
      const hourEnd = Math.min(e, (Math.floor(s / 60) + 1) * 60)
      const mins = hourEnd - s
      const cell = acc[type][Math.floor(s / 60) % 24]
      cell.staffMin += mins
      cell.cost += (mins / 60) * perHour
      s = hourEnd
    }
  }

  const cells = {} as Record<DayType, HourlyLaborCell[]>
  const days = {} as Record<DayType, number>
  for (const type of ['weekday', 'weekend'] as DayType[]) {
    const n = openDays[type].size || 1
    days[type] = openDays[type].size
    const all = acc[type].map((c, hour) => ({
      hour,
      sales: c.sales / n,
      staff: c.staffMin / 60 / n,
      laborCost: c.cost / n,
    }))
    // 영업시간 범위만 (새벽 테스트 주문 같은 튀는 값 제외)
    const peak = Math.max(...all.map((c) => c.sales))
    const active = all.filter((c) => c.sales > peak * 0.02 || c.staff > 0.05).map((c) => c.hour)
    cells[type] =
      active.length > 0 ? all.slice(Math.min(...active), Math.max(...active) + 1) : []
  }

  return { months, days, cells }
}
