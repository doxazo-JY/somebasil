'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: '대시보드', href: '/' },
  { label: '주간현황', href: '/weekly' },
  { label: '이익', href: '/profit' },
  { label: '수입', href: '/income' },
  { label: '지출', href: '/expenses' },
  { label: '메뉴분석', href: '/menu-analysis' },
  { label: '업로드', href: '/upload' },
  { label: '설정', href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <>
      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col h-screen bg-white border-r border-gray-100 sticky top-0">
        <div className="px-6 py-6 border-b border-gray-100">
          <span className="text-lg font-bold tracking-tight text-gray-900">썸바실</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
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
        {NAV_ITEMS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 min-w-[60px] flex flex-col items-center justify-center py-2 text-[11px] font-medium transition-colors ${
              isActive(href)
                ? 'text-[#1a5c3a]'
                : 'text-gray-400'
            }`}
          >
            <span className={`w-1 h-1 rounded-full mb-1 ${isActive(href) ? 'bg-[#1a5c3a]' : 'bg-transparent'}`} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}
