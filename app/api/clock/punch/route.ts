import { NextRequest, NextResponse } from 'next/server'
import { punch } from '@/lib/supabase/queries/attendance'
import { clearTicket, readClockSession } from '@/lib/attendance/session'

// 직원용 출근/퇴근 — 등록된 폰 + 유효한 입장권(카운터 QR 찍은 지 3분 이내)일 때만
// body: { action: 'in' | 'out' }
export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({}))
  if (action !== 'in' && action !== 'out') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  try {
    const { cookieStore, device, ticketExpiresAt } = await readClockSession()
    if (!device) return NextResponse.json({ error: 'not_registered' }, { status: 403 })
    if (ticketExpiresAt === null) return NextResponse.json({ error: 'need_qr' }, { status: 403 })

    const result = await punch(device, action)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })

    clearTicket(cookieStore)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/clock/punch] error:', error)
    return NextResponse.json({ error: 'punch_failed' }, { status: 500 })
  }
}
