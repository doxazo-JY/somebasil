'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// 한 페이지 안의 보기 전환 (예: 손익 > 월별 손익 / 흑자 조건) — 주소 ?view= 로 바꿔서 새로고침·공유해도 유지
// 다른 쿼리(?year= 등)는 그대로 둠. 첫 항목이 기본 보기 (param 없음)
export default function SubTabs({ items, param = 'view' }: { items: { key: string; label: string }[]; param?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get(param) ?? items[0].key

  const hrefFor = (key: string) => {
    const qs = new URLSearchParams(searchParams.toString())
    if (key === items[0].key) qs.delete(param)
    else qs.set(param, key)
    const s = qs.toString()
    return s ? `${pathname}?${s}` : pathname
  }

  return (
    <div className="flex gap-1 mb-5">
      {items.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          className={`text-sm px-3.5 py-1.5 rounded-lg ${current === t.key ? 'bg-[#1a5c3a] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
