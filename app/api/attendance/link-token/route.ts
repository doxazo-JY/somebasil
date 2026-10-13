import { NextRequest, NextResponse } from 'next/server'
import { createLinkToken } from '@/lib/supabase/queries/attendance'

// 점장(관리 화면): 직원별 폰 연결 QR 발급 — 관리 화면 로그인 대상
// body: { staff_id }
// 응답의 url을 QR로 띄우면 직원이 새 폰으로 스캔 → /clock/link 페이지가 /api/clock/link 호출
export async function POST(req: NextRequest) {
  const { staff_id } = await req.json().catch(() => ({}))
  const staffId = Number(staff_id)
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ error: 'invalid_staff_id' }, { status: 400 })
  }

  try {
    const issued = await createLinkToken(staffId)
    if (!issued) {
      return NextResponse.json({ error: 'staff_not_found' }, { status: 404 })
    }
    const { token, expiresAt } = issued
    // 직원용 주소가 있으면 그 주소로 (proxy.ts 참고)
    const origin = process.env.NEXT_PUBLIC_CLOCK_ORIGIN || req.nextUrl.origin
    const url = `${origin}/clock/link?t=${encodeURIComponent(token)}`
    return NextResponse.json({ url, expires_at: expiresAt })
  } catch (error) {
    console.error('[POST /api/attendance/link-token] error:', error)
    return NextResponse.json({ error: 'link_token_failed' }, { status: 500 })
  }
}
