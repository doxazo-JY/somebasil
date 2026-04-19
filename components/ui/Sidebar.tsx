'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: '대시보드', href: '/' },
  { label: '수입', href: '/income' },
  { label: '지출', href: '/expenses' },
  { label: '이익', href: '/profit' },
  { label: '직원', href: '/staff' },
  { label: '업로드', href: '/upload' },
  { label: '설정', href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen bg-white border-r border-gray-100 sticky top-0">
      {/* 로고 */}
      <div className="px-6 py-6 border-b border-gray-100">
        <span className="text-lg font-bold tracking-tight text-gray-900">썸바실</span>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ label, href }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#1a5c3a] text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 하단 관리자 */}
      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">관리자</p>
      </div>
    </aside>
  )
}
