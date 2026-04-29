'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// 그룹 → 기본 랜딩 경로 + 포함 경로
// 운영: 매일/매주 본다. 결산: 월말 본다. 관리: 데이터·인력 운영.
const NAV_ITEMS = [
  { label: '운영', href: '/', group: ['/', '/weekly'] },
  { label: '결산', href: '/profit', group: ['/profit', '/expenses', '/menu', '/recipes'] },
  { label: '관리', href: '/upload', group: ['/upload', '/staff', '/settings'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function isActive(group: string[]) {
    return group.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))
  }

  // 그룹 이동 시 기간 필터 유지 (?year=&month= 등)
  // 페이지가 사용하지 않는 쿼리는 무시되므로 무해
  const qs = searchParams.toString()
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href)

  return (
    <>
      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col h-screen bg-white border-r border-gray-100 sticky top-0">
        <div className="px-6 py-6 border-b border-gray-100">
          <span className="text-lg font-bold tracking-tight text-gray-900">썸바실</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, group }) => (
            <Link
              key={href}
              href={withQs(href)}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(group)
                  ? 'bg-[#1a5c3a] text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">관리자</p>
        </div>
      </aside>

      {/* ── 모바일 상단 헤더 ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 flex items-center px-4 h-12">
        <span className="text-base font-bold tracking-tight text-gray-900">썸바실</span>
      </header>

      {/* ── 모바일 하단 탭 바 ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex overflow-x-auto">
        {NAV_ITEMS.map(({ label, href, group }) => {
          const active = isActive(group)
          return (
            <Link
              key={href}
              href={withQs(href)}
              className={`flex-1 min-w-[60px] flex flex-col items-center justify-center py-2 text-[11px] font-medium transition-colors ${
                active ? 'text-[#1a5c3a]' : 'text-gray-400'
              }`}
            >
              <span className={`w-1 h-1 rounded-full mb-1 ${active ? 'bg-[#1a5c3a]' : 'bg-transparent'}`} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
