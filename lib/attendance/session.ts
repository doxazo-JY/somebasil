import { cookies } from 'next/headers'
import { findDevice, getQrSecretValue } from '@/lib/supabase/queries/attendance'
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  TICKET_COOKIE,
  TICKET_TTL_MS,
  signTicket,
  verifyTicket,
} from './tokens'

// /api/clock/* 라우트 공통 — 기기 쿠키(누구인지) + 입장권 쿠키(방금 QR 찍었는지)

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }

export async function readClockSession() {
  const cookieStore = await cookies()
  const secret = await getQrSecretValue()
  const deviceToken = cookieStore.get(DEVICE_COOKIE)?.value
  const device = await findDevice(deviceToken)
  const ticketExpiresAt = secret ? verifyTicket(secret, cookieStore.get(TICKET_COOKIE)?.value) : null
  return { cookieStore, secret, deviceToken, device, ticketExpiresAt }
}

type CookieStore = Awaited<ReturnType<typeof cookies>>

export function setDeviceCookie(cookieStore: CookieStore, token: string) {
  cookieStore.set(DEVICE_COOKIE, token, { ...COOKIE_BASE, maxAge: DEVICE_COOKIE_MAX_AGE })
}

// 카운터 QR을 찍은 직후 발급 → 만료시각(ms)
export function issueTicket(cookieStore: CookieStore, secret: string, now = Date.now()): number {
  const expiresAt = now + TICKET_TTL_MS
  cookieStore.set(TICKET_COOKIE, signTicket(secret, expiresAt), { ...COOKIE_BASE, maxAge: Math.ceil(TICKET_TTL_MS / 1000) })
  return expiresAt
}

// 출근/퇴근 1회 후 입장권 소멸 (다음 출퇴근은 다시 QR)
export function clearTicket(cookieStore: CookieStore) {
  cookieStore.delete(TICKET_COOKIE)
}
