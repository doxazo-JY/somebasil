import Link from 'next/link'
import type { ProductAgg } from '@/lib/supabase/queries/income'

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피',
  drip_coffee: '드립',
  dutch_coffee: '더치',
  matcha: '말차',
  ade: '에이드',
  tea: '티',
  beverage: '음료',
  dessert: '디저트',
  season: '시즌',
  etc: '기타',
}

const CATEGORY_COLOR: Record<string, string> = {
  coffee: 'bg-[#1a5c3a]/10 text-[#1a5c3a]',
  drip_coffee: 'bg-[#6ba088]/15 text-[#3d7a61]',
  dutch_coffee: 'bg-[#9ec8b2]/25 text-[#4d7a65]',
  matcha: 'bg-[#7cc4a7]/20 text-[#3d8665]',
  ade: 'bg-[#e8c787]/25 text-[#8f6c1f]',
  tea: 'bg-[#e8a98a]/25 text-[#954a1f]',
  beverage: 'bg-[#8fb9d4]/25 text-[#3d6b8f]',
  dessert: 'bg-[#d99aa8]/25 text-[#8a3a4a]',
  season: 'bg-[#b8a0d0]/25 text-[#6b4a8a]',
  etc: 'bg-gray-100 text-gray-500',
}

interface Props {
  products: ProductAgg[]
  limit?: number
}

export default function TopMenusCompact({ products, limit = 5 }: Props) {
  const top = products.slice(0, limit)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">BEST {limit} 메뉴</p>
        <Link
          href="/income"
          className="text-[11px] text-gray-400 hover:text-[#1a5c3a] transition-colors"
        >
          전체보기 →
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">데이터 없음</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {top.map((p, i) => {
            const catLabel = CATEGORY_LABEL[p.category] ?? p.category
            const catColor =
              CATEGORY_COLOR[p.category] ?? 'bg-gray-100 text-gray-500'
            return (
              <li key={p.product_name} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-xs font-semibold text-gray-400 shrink-0 text-right">
                  {i + 1}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor}`}
                >
                  {catLabel}
                </span>
                <span className="flex-1 truncate text-gray-800">{p.product_name}</span>
                <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                  {p.quantity}잔
                </span>
                <span className="text-xs text-gray-700 tabular-nums shrink-0 w-16 text-right">
                  {Math.round(p.amount / 10000) > 0
                    ? `${Math.round(p.amount / 10000)}만`
                    : `${p.amount.toLocaleString()}원`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
