import { createServerClient } from '../server'
import {
  CURRENT_SHIFT_MAX_MS,
  LINK_TOKEN_TTL_MS,
  hashToken,
  kstDate,
  newToken,
  safeEqual,
} from '@/lib/attendance/tokens'

// 직원용 출퇴근 쿼리 — 테이블 정의는 supabase/migrations/20261013_attendance*.sql
// 화면 흐름: 상태 조회(누구나, 현황만) → 출근/퇴근(카운터 QR 입장권 있을 때만)

export type MyLog = {
  id: number
  work_date: string
  clock_in: string
  clock_out: string | null
  minutes_worked: number | null
}

// /clock 화면이 받는 상태
export type ClockStatus =
  | { registered: false; can_punch: boolean; ticket_expires_at: number | null }
  | {
      registered: true
      name: string
      can_punch: boolean
      ticket_expires_at: number | null
      current: { id: number; clock_in: string } | null // 근무 중 (16시간 이내 시작)
      missing: { work_date: string }[]                   // 퇴근 누락 (그보다 오래된 근무 중 기록)
      month: { days: number; minutes: number; logs: MyLog[] }
    }

export type PunchResult =
  | { ok: true; action: 'in'; name: string; at: string }
  | { ok: true; action: 'out'; name: string; at: string; clock_in: string; minutes: number }
  | { ok: false; error: 'already_in' | 'not_in' | 'already_open_today' }

const UNIQUE_VIOLATION = '23505'

// 카운터 QR 비밀값 (입장권 서명 키로도 사용)
export async function getQrSecretValue(): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'attendance_qr_secret')
    .maybeSingle()
  return typeof data?.value === 'string' ? data.value : null
}

export function isValidQrKey(k: unknown, secret: string | null): boolean {
  return typeof k === 'string' && !!k && !!secret && safeEqual(k, secret)
}

// 쿠키 토큰 → 등록된 폰 + 직원 (해제된 폰, 퇴사 직원은 제외)
export async function findDevice(token: string | undefined) {
  if (!token) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('staff_devices')
    .select('id, staff_id, revoked_at, staff:staff_id (id, name, is_active)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!data || data.revoked_at) return null
  const staff = data.staff as unknown as { id: number; name: string; is_active: boolean } | null
  if (!staff?.is_active) return null
  return { deviceId: data.id as number, staff }
}

export async function touchDevice(deviceId: number, now = new Date()) {
  const supabase = createServerClient()
  await supabase.from('staff_devices').update({ last_used_at: now.toISOString() }).eq('id', deviceId)
}

// 퇴근 전 기록 → 근무 중 1건 + 퇴근 누락 목록
async function openShifts(staffId: number, now: Date) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('attendance_logs')
    .select('id, work_date, clock_in')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
  const rows = data ?? []
  const current = rows.find((r) => now.getTime() - new Date(r.clock_in).getTime() < CURRENT_SHIFT_MAX_MS) ?? null
  const missing = rows.filter((r) => r !== current).map((r) => ({ work_date: r.work_date as string }))
  return { current: current ? { id: current.id as number, clock_in: current.clock_in as string } : null, missing }
}

// 이번 달(한국 시간) 내 기록
async function myMonth(staffId: number, now: Date) {
  const supabase = createServerClient()
  const [y, m] = kstDate(now).split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const { data } = await supabase
    .from('attendance_logs')
    .select('id, work_date, clock_in, clock_out, minutes_worked')
    .eq('staff_id', staffId)
    .gte('work_date', start)
    .lt('work_date', end)
    .order('clock_in', { ascending: false })
  const logs = (data ?? []) as MyLog[]
  return {
    days: new Set(logs.map((l) => l.work_date)).size,
    minutes: logs.reduce((sum, l) => sum + (l.minutes_worked ?? 0), 0),
    logs,
  }
}

export async function getMyStatus(
  device: { deviceId: number; staff: { id: number; name: string } },
  ticketExpiresAt: number | null,
  now = new Date()
): Promise<ClockStatus> {
  const [{ current, missing }, month] = await Promise.all([
    openShifts(device.staff.id, now),
    myMonth(device.staff.id, now),
  ])
  return {
    registered: true,
    name: device.staff.name,
    can_punch: ticketExpiresAt !== null,
    ticket_expires_at: ticketExpiresAt,
    current,
    missing,
    month,
  }
}

// 출근/퇴근 — 입장권 검증은 호출 측(route)에서
export async function punch(
  device: { deviceId: number; staff: { id: number; name: string } },
  action: 'in' | 'out',
  now = new Date()
): Promise<PunchResult> {
  const supabase = createServerClient()
  const { staff, deviceId } = device
  const { current } = await openShifts(staff.id, now)
  const at = now.toISOString()

  if (action === 'in') {
    if (current) return { ok: false, error: 'already_in' }
    const { error } = await supabase.from('attendance_logs').insert({
      staff_id: staff.id,
      work_date: kstDate(now),
      clock_in: at,
      qr_clock_in: at,
      device_id: deviceId,
    })
    if (error) {
      // 같은 날 퇴근 전 기록이 이미 있음 (16시간 넘게 지난 오늘 기록 등 드문 경우)
      if (error.code === UNIQUE_VIOLATION) return { ok: false, error: 'already_open_today' }
      throw error
    }
    return { ok: true, action: 'in', name: staff.name, at }
  }

  if (!current) return { ok: false, error: 'not_in' }
  const { data: closed, error } = await supabase
    .from('attendance_logs')
    .update({ clock_out: at, qr_clock_out: at })
    .eq('id', current.id)
    .is('clock_out', null)
    .select('minutes_worked')
    .maybeSingle()
  if (error) throw error
  if (!closed) return { ok: false, error: 'not_in' } // 동시에 두 번 눌림
  return { ok: true, action: 'out', name: staff.name, at, clock_in: current.clock_in, minutes: closed.minutes_worked ?? 0 }
}

// 같은 이름의 직원이 있는지 (퇴사 포함, 공백 정리 후 비교)
export async function isNameTaken(name: string): Promise<boolean> {
  const supabase = createServerClient()
  // 퇴사 처리한 직원 이름도 막음 — 같은 사람이 새 직원으로 중복 등록되지 않게 (돌아오면 점장이 복직 후 연결 QR)
  const { data } = await supabase.from('staff').select('name')
  return (data ?? []).some((s) => s.name.trim().replace(/\s+/g, ' ') === name)
}

// 새 직원 등록 (직책 기본값 알바생, 입사일 오늘) → 직원 id
export async function registerStaff(name: string, now = new Date()): Promise<number> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('staff')
    .insert({ name, role: 'part_time', hire_date: kstDate(now), is_active: true })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// 폰 등록 → 쿠키에 넣을 토큰 원문과 기기 id
export async function createDevice(staffId: number, label: string) {
  const supabase = createServerClient()
  const token = newToken()
  const { data, error } = await supabase
    .from('staff_devices')
    .insert({ staff_id: staffId, token_hash: hashToken(token), label })
    .select('id')
    .single()
  if (error) throw error
  return { token, deviceId: data.id as number }
}

// 점장: 폰 교체용 연결 토큰 발급 (이전 토큰은 덮어써서 무효). 재직 중 직원이 아니면 null
export async function createLinkToken(staffId: number, now = new Date()) {
  const supabase = createServerClient()
  const token = newToken()
  const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MS).toISOString()
  const { data, error } = await supabase
    .from('staff')
    .update({ link_token_hash: hashToken(token), link_token_expires_at: expiresAt })
    .eq('id', staffId)
    .eq('is_active', true)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { token, expiresAt }
}

// 직원: 연결 토큰 사용 (1회용 — 조건부 update로 동시 사용 차단) → 직원 or null
export async function consumeLinkToken(token: unknown, now = new Date()) {
  if (typeof token !== 'string' || !token) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('staff')
    .update({ link_token_hash: null, link_token_expires_at: null })
    .eq('link_token_hash', hashToken(token))
    .gt('link_token_expires_at', now.toISOString())
    .eq('is_active', true)
    .select('id, name')
    .maybeSingle()
  return data as { id: number; name: string } | null
}
