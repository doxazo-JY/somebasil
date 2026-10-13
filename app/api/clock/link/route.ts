import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { consumeLinkToken, createDevice } from '@/lib/supabase/queries/attendance'
import { setDeviceCookie } from '@/lib/attendance/session'
import { deviceLabel } from '@/lib/attendance/tokens'

// 폰 교체 — 점장이 만든 연결 QR(10분, 1회용)을 새 폰으로 스캔
// body: { token: 연결 QR 토큰 }
// 출퇴근 기록은 하지 않음 (연결만). 이후 카운터 QR로 평소처럼 출퇴근
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}))
  const staff = await consumeLinkToken(token)
  if (!staff) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 })
  }

  try {
    const { token: deviceToken } = await createDevice(staff.id, deviceLabel(req.headers.get('user-agent')))
    setDeviceCookie(await cookies(), deviceToken)
    return NextResponse.json({ status: 'linked', name: staff.name })
  } catch (error) {
    console.error('[POST /api/clock/link] error:', error)
    return NextResponse.json({ error: 'link_failed' }, { status: 500 })
  }
}
