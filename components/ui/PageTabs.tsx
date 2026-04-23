'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type GroupKey = 'overview' | 'analysis' | 'admin'

const GROUPS: Record<GroupKey, { label: string; href: string }[]> = {
  overview: [
    { label: '월간', href: '/' },
    { label: '주간', href: '/weekly' },
    { label: '종합', href: '/profit' },
  ],
  analysis: [
    { label: '매출', href: '/income' },
    { label: '지출', href: '/expenses' },
    { label: '메뉴', href: '/menu-analysis' },
  ],
  admin: [
    { label: '업로드', href: '/upload' },
    { label: '설정', href: '/settings' },
  ],
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

  return (
    <div className="flex gap-1 mb-5 border-b border-gray-100">
      {tabs.map(({ label, href }) => {
        const active = href === pathname
        const hrefWithQs = qs ? `${href}?${qs}` : href
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
