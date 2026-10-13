import type { Metadata } from 'next'
import ClockScreen from '@/components/clock/ClockScreen'

export const metadata: Metadata = {
  title: '썸바실 출퇴근',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ k?: string }>
}

// 직원용 출퇴근 화면 — 카운터 QR(/clock?k=비밀값)로 진입. 로그인 없이 공개
export default async function ClockPage({ searchParams }: PageProps) {
  const { k } = await searchParams
  return <ClockScreen qrKey={k ?? ''} />
}
