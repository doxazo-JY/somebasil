import type { DeadMenu } from '@/lib/supabase/queries/menu'
import { unitFor } from '@/lib/menu-utils'
import MatchMenuButton from './MatchMenuButton'
import DeactivateMenuButton from './DeactivateMenuButton'

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
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">
          죽은 메뉴 <span className="text-xs text-gray-400 font-normal">({periodLabel})</span>
        </p>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">마지막 판매 오래된 순</p>
      </div>

      {menus.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          기준치 이하 메뉴 없음
        </p>
      ) : (
        <>
        {/* 컬럼 헤더 (badge는 variable width이라 헤더 생략) */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 tracking-wider px-1 pb-1.5 border-b border-gray-50 mb-2">
          <span className="flex-1 min-w-0">메뉴</span>
          <span className="shrink-0 w-10 text-right">판매량</span>
          <span className="shrink-0 w-14 text-right">매출(원)</span>
          <span className="shrink-0 w-20 text-right">마지막 판매</span>
        </div>
        <ul className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
          {menus.map((m) => {
            const catLabel = CATEGORY_LABEL[m.category] ?? m.category
            const catColor = CATEGORY_COLOR[m.category] ?? 'bg-gray-100 text-gray-500'
            const daysAgo = m.daysSinceLastSold

            return (
              <li
                key={`${m.category}|${m.product_name}`}
                className="flex items-center gap-2 text-sm py-1"
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor}`}
                >
                  {catLabel}
                </span>
                <span className="flex-1 min-w-0 truncate text-gray-800">{m.product_name}</span>
                {m.product_id && (
                  <>
                    <MatchMenuButton
                      productId={m.product_id}
                      productName={m.product_name}
                    />
                    <DeactivateMenuButton
                      productId={m.product_id}
                      productName={m.product_name}
                    />
                  </>
                )}
                <span className="text-[11px] text-gray-400 shrink-0 tabular-nums w-10 text-right">
                  {m.quantity}{unitFor(m.category)}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0 tabular-nums w-14 text-right">
                  {m.amount >= 10000
                    ? `${Math.round(m.amount / 10000)}만`
                    : `${m.amount.toLocaleString()}`}
                </span>
                <span className="text-[11px] shrink-0 w-20 text-right tabular-nums">
                  {m.lastSoldDate === null ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <span
                      className={
                        daysAgo !== null && daysAgo > 60
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }
                      title={daysAgo !== null ? `${daysAgo}일 전` : undefined}
                    >
                      {m.lastSoldDate.slice(5).replace('-', '/')}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        </>
      )}

      <p className="text-[11px] text-gray-400 mt-3 [word-break:keep-all]">
        ※ <strong>마지막 판매 오래된 순 하위 30개</strong>. 한 번도 안 팔린 메뉴 우선. 매출·판매량은 위쪽 selector 기간 기준.
      </p>
    </div>
  )
}
