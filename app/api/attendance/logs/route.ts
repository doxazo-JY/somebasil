import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { kstIso } from '@/lib/attendance/format'

// 점장(관리 화면): 출퇴근 기록 수기 추가 / 수정 / 삭제 — 관리 화면 로그인 대상
// 시간은 한국 시간 'HH:MM'. 퇴근이 출근보다 이르면 다음 날 퇴근(자정 넘김)으로 처리

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function toRange(workDate: string, inHm: string, outHm: string | null) {
  const clockIn = kstIso(workDate, inHm)
  if (!outHm) return { clock_in: clockIn, clock_out: null }
  let clockOut = kstIso(workDate, outHm)
  if (clockOut <= clockIn) clockOut = new Date(new Date(clockOut).getTime() + 86400000).toISOString()
  return { clock_in: clockIn, clock_out: clockOut }
}

function parseTimes(body: { clock_in?: unknown; clock_out?: unknown }) {
  const inHm = typeof body.clock_in === 'string' ? body.clock_in : ''
  const outHm = typeof body.clock_out === 'string' && body.clock_out ? body.clock_out : null
  if (!HHMM.test(inHm) || (outHm && !HHMM.test(outHm))) return null
  return { inHm, outHm }
}

function memoOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 200) : null
}

// 수기 추가 (폰을 안 가져온 날 등)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const staffId = Number(body.staff_id)
  const times = parseTimes(body)
  if (!Number.isInteger(staffId) || !DATE.test(body.work_date ?? '') || !times) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase.from('attendance_logs').insert({
    staff_id: staffId,
    work_date: body.work_date,
    ...toRange(body.work_date, times.inHm, times.outHm),
    edited_at: new Date().toISOString(),
    edit_memo: memoOf(body.memo) ?? '수기 입력',
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_open' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// 시간 수정 (QR 원래 시각은 qr_clock_*에 그대로 남음)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = Number(body.id)
  const times = parseTimes(body)
  if (!Number.isInteger(id) || !times) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { data: row } = await supabase.from('attendance_logs').select('work_date').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error } = await supabase
    .from('attendance_logs')
    .update({
      ...toRange(row.work_date, times.inHm, times.outHm),
      edited_at: new Date().toISOString(),
      edit_memo: memoOf(body.memo),
    })
    .eq('id', id)
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_open' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(Number(id))) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('attendance_logs').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
