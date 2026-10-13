import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

// 출퇴근 QR 공통 유틸 — 서버 전용

// 폰 기기 토큰 쿠키 (1년, 화면 열 때마다 연장)
export const DEVICE_COOKIE = 'sb_device'
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// QR 입장권 쿠키 — 카운터 QR을 실제로 찍은 직후 3분만 출퇴근 버튼 허용
// (열어 둔 탭·새로고침·북마크로는 출퇴근 불가, 현황만 조회)
export const TICKET_COOKIE = 'sb_ticket'
export const TICKET_TTL_MS = 3 * 60 * 1000

// 폰 교체용 연결 QR 유효 시간
export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000

// 이 시간 안에 시작된 퇴근 전 기록만 "근무 중"으로 봄. 그보다 오래된 건 퇴근 누락
export const CURRENT_SHIFT_MAX_MS = 16 * 60 * 60 * 1000

// 입장권 = "만료시각.서명" (서명 키 = 카운터 QR 비밀값 → QR 교체 시 기존 입장권도 무효)
export function signTicket(secret: string, expiresAt: number): string {
  const sig = createHmac('sha256', secret).update(String(expiresAt)).digest('base64url')
  return `${expiresAt}.${sig}`
}

// 유효하면 만료시각(ms), 아니면 null
export function verifyTicket(secret: string, value: string | undefined, now = Date.now()): number | null {
  if (!value) return null
  const [exp] = value.split('.')
  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null
  return safeEqual(value, signTicket(secret, expiresAt)) ? expiresAt : null
}

// 추측 불가능한 무작위 토큰 (원문은 쿠키/QR에만, DB엔 해시만 저장)
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// 길이가 달라도 안전하게 비교 (타이밍 공격 방지)
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// 한국 시간 기준 날짜 'YYYY-MM-DD'
export function kstDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)
}

// 직원 이름 정리 — 앞뒤 공백 제거, 연속 공백 1칸
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > 20) return null
  return name
}

// User-Agent에서 "iPhone Safari" 같은 짧은 기기 이름 추출
export function deviceLabel(ua: string | null): string {
  if (!ua) return '알 수 없는 기기'
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '기기'
  const browser = /KAKAOTALK/i.test(ua) ? '카카오톡' : /NAVER/i.test(ua) ? '네이버' : /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '브라우저'
  return `${os} ${browser}`
}
