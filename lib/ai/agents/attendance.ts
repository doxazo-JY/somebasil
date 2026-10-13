import { createServerClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/attendance/tokens'
import { fmtWorkDate } from '@/lib/attendance/format'
import { getPayRates, rateFor } from '@/lib/supabase/queries/attendance-admin'
import { recordRun, type RunTrigger } from '../client'

// 근태 AI — 매일 아침. AI 호출 없이 규칙으로 점검 (비용 0)
//   1) 퇴근 누락: 출근 후 16시간이 지나도 퇴근 기록 없는 QR 기록
//   2) 주휴수당 대상: 알바생이 한 주(월~일) QR 근무 15시간 이상 — 이번 주·지난주
// 같은 알림은 dedupe_key로 한 번만 올림

const MISSING_AFTER_MS = 16 * 60 * 60 * 1000
const WEEKLY_HOLIDAY_MIN_HOURS = 15

// 한국 날짜의 그 주 월요일
function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return dt.toISOString().slice(0, 10)
}

function addDays(date: string, n: number): string {
  const dt = new Date(`${date}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

type Alert = {
  dedupe_key: string
  severity: 'info' | 'warn'
  title: string
  body: string
  evidence: { label: string; value: string }[]
  action: string
  link: string
  period: string
}

export async function runAttendanceAgent(trigger: RunTrigger, now = new Date()) {
  return recordRun('attendance', trigger, async (runId) => {
    const supabase = createServerClient()
    const today = kstDate(now)
    const thisMonday = mondayOf(today)
    const lastMonday = addDays(thisMonday, -7)

    const [{ data: open }, { data: weekLogs }, rates] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('id, work_date, clock_in, staff:staff_id (name)')
        .is('clock_out', null)
        .lt('clock_in', new Date(now.getTime() - MISSING_AFTER_MS).toISOString()),
      supabase
        .from('attendance_logs')
        .select('staff_id, work_date, minutes_worked, staff:staff_id (name, role, is_active)')
        .gte('work_date', lastMonday)
        .lte('work_date', addDays(thisMonday, 6)),
      getPayRates(),
    ])

    const alerts: Alert[] = []

    for (const log of open ?? []) {
      const name = (log as unknown as { staff: { name: string } | null }).staff?.name ?? '직원'
      alerts.push({
        dedupe_key: `attendance:missing:${log.id}`,
        severity: 'warn',
        title: `${name}님 ${fmtWorkDate(log.work_date)} 퇴근 기록이 없어요`,
        body: '퇴근을 찍지 않아 이날 근무시간이 근무일지와 인건비에서 빠져 있어요. 직원에게 실제 퇴근 시간을 물어 넣어 주세요.',
        evidence: [{ label: '출근', value: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(log.clock_in)) }],
        action: '직원 > 근무 탭 출퇴근 기록에서 [수정] → 퇴근 시간 입력',
        link: '/staff',
        period: log.work_date,
      })
    }

    // 주별·직원별 근무 분 (알바생, 퇴근 기록된 것만)
    const weekly = new Map<string, { name: string; minutes: number; days: Set<string> }>()
    for (const row of weekLogs ?? []) {
      const staff = (row as unknown as { staff: { name: string; role: string; is_active: boolean } | null }).staff
      if (!staff || staff.role !== 'part_time' || !staff.is_active) continue
      const key = `${row.staff_id}|${mondayOf(row.work_date)}`
      const cur = weekly.get(key) ?? { name: staff.name, minutes: 0, days: new Set<string>() }
      cur.minutes += row.minutes_worked ?? 0
      cur.days.add(row.work_date)
      weekly.set(key, cur)
    }
    for (const [key, w] of weekly) {
      const hours = w.minutes / 60
      if (hours < WEEKLY_HOLIDAY_MIN_HOURS) continue
      const [staffId, monday] = key.split('|')
      const rate = rateFor(rates, monday)?.weekday_hourly ?? null
      // 주휴수당 = (주 근무시간 ÷ 40) × 8시간 × 시급, 최대 8시간분
      const allowance = rate ? Math.round((Math.min(hours, 40) / 40) * 8 * rate) : null
      const isThisWeek = monday === thisMonday
      alerts.push({
        dedupe_key: `attendance:juhyu:${staffId}:${monday}`,
        severity: 'info',
        title: `${w.name}님 ${isThisWeek ? '이번' : '지난'} 주 근무가 15시간을 넘었어요`,
        body: `한 주에 15시간 이상 일하면 주휴수당 대상이 돼요. ${isThisWeek ? '이번 주 남은 근무를 짤 때 참고하세요.' : '이번 달 인건비에 주휴수당을 넣어야 해요.'} 개근 여부 같은 정확한 조건은 세무사님께 확인해 주세요.`,
        evidence: [
          { label: `${fmtWorkDate(monday)} 주 근무`, value: `${Math.round(hours * 10) / 10}시간 · ${w.days.size}일` },
          ...(allowance ? [{ label: '예상 주휴수당', value: `약 ${allowance.toLocaleString('ko-KR')}원` }] : []),
        ],
        action: '월말에 직원 > 근무 탭 수기 항목에 "주휴수당"으로 넣기',
        link: '/staff',
        period: monday,
      })
    }

    // 이미 올린 알림은 건너뜀
    let inserted = 0
    if (alerts.length > 0) {
      const { data: existing } = await supabase
        .from('ai_inbox')
        .select('dedupe_key')
        .in('dedupe_key', alerts.map((a) => a.dedupe_key))
      const seen = new Set((existing ?? []).map((e) => e.dedupe_key))
      const fresh = alerts.filter((a) => !seen.has(a.dedupe_key))
      if (fresh.length > 0) {
        const { error } = await supabase
          .from('ai_inbox')
          .insert(fresh.map((a) => ({ ...a, run_id: runId, agent: 'attendance', kind: 'alert' })))
        if (error) throw error
      }
      inserted = fresh.length
    }

    const missing = alerts.filter((a) => a.dedupe_key.includes(':missing:')).length
    return {
      summary: inserted > 0
        ? `새 알림 ${inserted}건 (퇴근 누락 ${missing} · 주휴 대상 ${alerts.length - missing})`
        : '점검 완료 · 새로 챙길 일 없음',
      output: { alerts: alerts.length, inserted },
      model: null,
      period: today,
    }
  })
}
