import { NextRequest, NextResponse } from 'next/server'
import { getMyStatus, isValidQrKey, touchDevice, type ClockStatus } from '@/lib/supabase/queries/attendance'
import { issueTicket, readClockSession, setDeviceCookie } from '@/lib/attendance/session'

// 직원용 상태 조회 — 로그인 없이 공개 (관리 화면 로그인 도입 시 /api/clock/* 는 예외 처리)
// body: { k?: 카운터 QR 비밀값 }
//   k가 맞으면 = 방금 카운터 QR을 찍음 → 3분 입장권 발급 (출퇴근 버튼 허용)
//   k가 없으면 = 열어 둔 탭/링크 → 현황만
export async function POST(req: NextRequest) {
  const { k } = await req.json().catch(() => ({}))
  try {
    const { cookieStore, secret, device, deviceToken, ticketExpiresAt } = await readClockSession()

    let expiresAt = ticketExpiresAt
    const invalidQr = !!k && !isValidQrKey(k, secret)
    if (k && !invalidQr && secret) expiresAt = issueTicket(cookieStore, secret)

    if (!device || !deviceToken) {
      const body: ClockStatus & { invalid_qr: boolean } = {
        registered: false,
        can_punch: expiresAt !== null,
        ticket_expires_at: expiresAt,
        invalid_qr: invalidQr,
      }
      return NextResponse.json(body)
    }

    await touchDevice(device.deviceId)
    setDeviceCookie(cookieStore, deviceToken) // 기간 연장
    const status = await getMyStatus(device, expiresAt)
    return NextResponse.json({ ...status, invalid_qr: invalidQr })
  } catch (error) {
    console.error('[POST /api/clock] error:', error)
    return NextResponse.json({ error: 'status_failed' }, { status: 500 })
  }
}
