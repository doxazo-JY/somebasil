import type { Metadata } from 'next'
import LinkScreen from '@/components/clock/LinkScreen'

export const metadata: Metadata = {
  title: '썸바실 폰 연결',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ t?: string }>
}

// 폰 교체 연결 화면 — 점장이 관리 화면에 띄운 연결 QR(/clock/link?t=토큰)로 진입
export default async function ClockLinkPage({ searchParams }: PageProps) {
  const { t } = await searchParams
  return <LinkScreen token={t ?? ''} />
}
