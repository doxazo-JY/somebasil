import { NextRequest, NextResponse } from 'next/server'
import { consumeLinkToken, createDevice, getQrSecretValue } from '@/lib/supabase/queries/attendance'
import { issueTicket, readClockSession, setDeviceCookie } from '@/lib/attendance/session'
import { deviceLabel } from '@/lib/attendance/tokens'

// 폰 연결 — 점장이 매장에서 띄운 연결 QR(10분, 1회용)을 직원 폰으로 스캔 (기존 직원 첫 연결 · 폰 교체)
// body: { token: 연결 QR 토큰 }
// 연결 QR도 점장 앞에서 찍는 것이라 카운터 QR처럼 3분 입장권을 같이 줌 → 연결 화면에서 바로 출근 가능
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}))
  const staff = await consumeLinkToken(token)
  if (!staff) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 })
  }

  try {
    const { cookieStore } = await readClockSession()
    const { token: deviceToken } = await createDevice(staff.id, deviceLabel(req.headers.get('user-agent')))
    setDeviceCookie(cookieStore, deviceToken)
    const secret = await getQrSecretValue()
    const ticketExpiresAt = secret ? issueTicket(cookieStore, secret) : null
    return NextResponse.json({ status: 'linked', name: staff.name, ticket: !!ticketExpiresAt })
  } catch (error) {
    console.error('[POST /api/clock/link] error:', error)
    return NextResponse.json({ error: 'link_failed' }, { status: 500 })
  }
}
