import { NextRequest, NextResponse } from 'next/server'
import { createDevice, isNameTaken, registerStaff } from '@/lib/supabase/queries/attendance'
import { readClockSession, setDeviceCookie } from '@/lib/attendance/session'
import { deviceLabel, normalizeName } from '@/lib/attendance/tokens'

// 첫 등록 — 새 직원 + 폰 연결. 카운터 QR 입장권이 있을 때만 (매장에서만 등록 가능)
// body: { name }
// 출근은 등록 후 화면의 [출근하기]로 (같은 입장권 사용)
// 기존 직원의 폰 연결은 여기서 불가 → 점장 연결 QR(/api/clock/link)로만
export async function POST(req: NextRequest) {
  const { name: rawName } = await req.json().catch(() => ({}))
  const name = normalizeName(rawName)
  if (!name) return NextResponse.json({ error: 'invalid_name' }, { status: 400 })

  try {
    const { cookieStore, device, ticketExpiresAt } = await readClockSession()
    if (ticketExpiresAt === null) return NextResponse.json({ error: 'need_qr' }, { status: 403 })
    if (device) return NextResponse.json({ error: 'already_registered' }, { status: 409 })
    if (await isNameTaken(name)) return NextResponse.json({ error: 'name_taken' }, { status: 409 })

    const staffId = await registerStaff(name)
    const { token } = await createDevice(staffId, deviceLabel(req.headers.get('user-agent')))
    setDeviceCookie(cookieStore, token)
    return NextResponse.json({ ok: true, name })
  } catch (error) {
    console.error('[POST /api/clock/register] error:', error)
    return NextResponse.json({ error: 'register_failed' }, { status: 500 })
  }
}
