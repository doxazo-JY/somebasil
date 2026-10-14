'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type GroupKey = 'operations' | 'analysis' | 'data'

// also: 탭은 없지만 이 탭에 속한 화면 (마케팅 화면은 사무실 마케팅 AI 자리에서 들어감)
// 진단 → 손익 > 흑자 조건, 원가 → 메뉴 > 원가, 설정 → 데이터 > 데이터 고치기 (10/16 탭 정리)
// 그룹: 운영(매장 굴리기 · 매일/수시) / 분석(깊게 보기) / 데이터(파일 넣기·고치기) — 10/16 직원은 운영으로
const GROUPS: Record<GroupKey, { label: string; href: string; also?: string[] }[]> = {
  // 매일/매주 — 점장 운영용
  operations: [
    { label: '대시보드', href: '/' },
    { label: '주간', href: '/weekly' },
    { label: '사무실', href: '/inbox', also: ['/marketing'] },
    { label: '직원', href: '/staff' },
  ],
  // 깊게 보기 — 손익·지출·메뉴
  analysis: [
    { label: '손익', href: '/profit' },
    { label: '지출', href: '/expenses' },
    { label: '메뉴', href: '/menu' },
  ],
  // 파일 넣기·고치기 (탭 1개라 탭 줄은 숨김)
  data: [{ label: '데이터', href: '/upload' }],
}

interface PageTabsProps {
  group: GroupKey
}

// 상단 서브 탭 (그룹 내 페이지 간 이동)
// 현재 경로의 쿼리 파라미터(?year=&month= 등)를 유지해 기간 필터를 이어감
export default function PageTabs({ group }: PageTabsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const tabs = GROUPS[group]
  if (tabs.length < 2) return null

  return (
    <div className="flex gap-1 mb-5 border-b border-gray-100">
      {tabs.map(({ label, href, also }) => {
        const active = href === pathname || !!also?.includes(pathname)
        // 보기 전환(?view= · ?fix=)은 다른 탭으로 넘기지 않음 — 기간 필터만 이어감
        const keep = new URLSearchParams(qs)
        keep.delete('view')
        keep.delete('fix')
        const rest = keep.toString()
        const hrefWithQs = rest ? `${href}?${rest}` : href
        return (
          <Link
            key={href}
            href={hrefWithQs}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              active ? 'text-[#1a5c3a]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {label}
            {active && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#1a5c3a] rounded-t" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
