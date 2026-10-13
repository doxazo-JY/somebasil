import { NextResponse, type NextRequest } from 'next/server'

// 직원용 주소 분리
// NEXT_PUBLIC_CLOCK_ORIGIN(예: https://somebasil-staff.vercel.app)으로 들어온 요청은
// 출퇴근 화면과 그 API만 허용하고 나머지(대시보드·결산·관리 API)는 404
// → 카운터 QR에 직원용 주소만 들어가서 직원 폰에 관리용 주소가 남지 않음
// 환경변수가 없으면(로컬 개발 등) 아무것도 막지 않음
// ※ 관리용 주소 자체를 잠그는 것은 아님 — 관리자 로그인은 별도

const CLOCK_ORIGIN = process.env.NEXT_PUBLIC_CLOCK_ORIGIN
const CLOCK_HOST = CLOCK_ORIGIN ? new URL(CLOCK_ORIGIN).host : null

// /api/cron/* 은 Vercel Cron이 어느 주소로 호출해도 동작하도록 허용 (CRON_SECRET으로 보호됨)
const ALLOWED = [/^\/clock(\/|$)/, /^\/api\/clock(\/|$)/, /^\/api\/cron\//]

export function proxy(request: NextRequest) {
  if (!CLOCK_HOST || request.headers.get('host') !== CLOCK_HOST) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (pathname === '/') return NextResponse.redirect(new URL('/clock', request.url))
  if (ALLOWED.some((re) => re.test(pathname))) return NextResponse.next()
  return new NextResponse('Not Found', { status: 404 })
}

export const config = {
  // Next 내부 파일은 제외 (출퇴근 화면이 쓰는 JS·CSS, 개발 서버 연결)
  matcher: ['/((?!_next/|favicon.ico).*)'],
}
