import type { DeadMenu } from '@/lib/supabase/queries/menu'

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

interface DeadMenuListProps {
  menus: DeadMenu[]
  periodLabel: string // "최근 2개월" 등
}

export default function DeadMenuList({ menus, periodLabel }: DeadMenuListProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">
          죽은 메뉴 <span className="text-xs text-gray-400 font-normal">({periodLabel})</span>
        </p>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">판매량 낮은 순</p>
      </div>

      {menus.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          기준치 이하 메뉴 없음
        </p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
          {menus.map((m) => {
            const catLabel = CATEGORY_LABEL[m.category] ?? m.category
            const catColor = CATEGORY_COLOR[m.category] ?? 'bg-gray-100 text-gray-500'
            const daysAgo = m.daysSinceLastSold

            return (
              <li
                key={m.product_name}
                className="flex items-center gap-2 text-sm py-1"
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor}`}
                >
                  {catLabel}
                </span>
                <span className="flex-1 min-w-0 truncate text-gray-800">{m.product_name}</span>
                <span className="text-[11px] text-gray-400 shrink-0 tabular-nums w-10 text-right">
                  {m.quantity}잔
                </span>
                <span className="text-[11px] text-gray-400 shrink-0 tabular-nums w-14 text-right">
                  {m.amount >= 10000
                    ? `${Math.round(m.amount / 10000)}만`
                    : `${m.amount.toLocaleString()}`}
                </span>
                <span className="text-[11px] shrink-0 w-14 text-right">
                  {daysAgo === null ? (
                    <span className="text-gray-300">—</span>
                  ) : daysAgo === 0 ? (
                    <span className="text-gray-400">오늘</span>
                  ) : daysAgo > 60 ? (
                    <span className="text-red-400">{daysAgo}일 전</span>
                  ) : (
                    <span className="text-gray-400">{daysAgo}일 전</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-[11px] text-gray-400 mt-3">
        ※ 월 10잔 미만 판매 기준. 메뉴판 정리 / 재료 발주 검토에 활용.
      </p>
    </div>
  )
}
