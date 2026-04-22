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

// 뱃지 — 도넛과 동일 무드 톤 (배경 pastel / 텍스트 진한 버전)
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

interface TopProductsCardProps {
  products: ProductAgg[]
  prevProducts: ProductAgg[]
  limit?: number
}

export default function TopProductsCard({
  products,
  prevProducts,
  limit = 10,
}: TopProductsCardProps) {
  const top = products.slice(0, limit)
  const max = top[0]?.amount ?? 1

  // 전월 순위 맵
  const prevRankMap = new Map<string, number>()
  prevProducts.forEach((p, i) => prevRankMap.set(p.product_name, i + 1))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">BEST {limit} 메뉴</p>
        <p className="text-[11px] text-gray-400">매출 순</p>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">데이터 없음</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {top.map((p, i) => {
            const rank = i + 1
            const prevRank = prevRankMap.get(p.product_name)
            const rankDelta = prevRank !== undefined ? prevRank - rank : null
            const ratio = p.amount / max
            const catLabel = CATEGORY_LABEL[p.category] ?? p.category
            const catColor =
              CATEGORY_COLOR[p.category] ?? 'bg-gray-100 text-gray-500'

            return (
              <li key={p.product_name} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-xs font-semibold text-gray-400 shrink-0 text-right">
                  {rank}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor}`}
                >
                  {catLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-800 truncate">{p.product_name}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {p.quantity.toLocaleString()}잔
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1a5c3a] rounded-full"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-700 tabular-nums shrink-0 text-right w-20">
                  {p.amount.toLocaleString()}원
                </span>
                <span className="w-8 text-right shrink-0 text-[11px]">
                  {rankDelta === null ? (
                    <span className="text-[#1a5c3a]/70">NEW</span>
                  ) : rankDelta > 0 ? (
                    <span className="text-[#1a5c3a]">▲{rankDelta}</span>
                  ) : rankDelta < 0 ? (
                    <span className="text-red-400">▼{Math.abs(rankDelta)}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
