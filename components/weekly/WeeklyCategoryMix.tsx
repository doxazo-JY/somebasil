import type { WeekDetail } from '@/lib/supabase/queries/weekly'

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피&슈페너',
  drip_coffee: '드립커피',
  dutch_coffee: '더치커피',
  matcha: '말차',
  ade: '에이드',
  tea: '티',
  beverage: '음료',
  dessert: '디저트',
  season: '시즌',
  etc: '기타',
}

const CATEGORY_HEX: Record<string, string> = {
  coffee: '#1a5c3a',
  drip_coffee: '#6ba088',
  dutch_coffee: '#9ec8b2',
  matcha: '#7cc4a7',
  ade: '#e8c787',
  tea: '#e8a98a',
  beverage: '#8fb9d4',
  dessert: '#d99aa8',
  season: '#b8a0d0',
  etc: '#c4c7cc',
}

interface Props {
  current: WeekDetail['categoryMix']
  prev?: WeekDetail['categoryMix']
}

export default function WeeklyCategoryMix({ current, prev }: Props) {
  const prevMap = new Map<string, number>()
  if (prev) {
    for (const c of prev) prevMap.set(c.category, c.pct)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">카테고리 믹스</p>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-1.5 rounded-sm bg-[#1a5c3a]" />
            선택 주
          </span>
          {prev && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-1.5 rounded-sm bg-gray-300" />
              전주
            </span>
          )}
        </div>
      </div>

      {current.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">데이터 없음</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {current.map(({ category, amount, pct }) => {
            const label = CATEGORY_LABEL[category] ?? category
            const color = CATEGORY_HEX[category] ?? '#c4c7cc'
            const prevPct = prevMap.get(category)
            const delta = prevPct !== undefined ? pct - prevPct : null

            return (
              <li key={category} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-gray-600 shrink-0">{label}</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  {prev && (
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-300"
                        style={{ width: `${prevPct ?? 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0 shrink-0 w-12">
                  <span className="text-gray-700 font-medium tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                  {prev && (
                    <span className="text-gray-400 text-[10px] tabular-nums">
                      {prevPct !== undefined ? `${prevPct.toFixed(1)}%` : '—'}
                    </span>
                  )}
                </div>
                <span className="w-14 text-right shrink-0 text-[11px] tabular-nums">
                  {delta === null ? (
                    <span className="text-gray-300">—</span>
                  ) : Math.abs(delta) < 0.1 ? (
                    <span className="text-gray-300">=</span>
                  ) : delta > 0 ? (
                    <span className="text-[#1a5c3a]">▲{delta.toFixed(1)}%p</span>
                  ) : (
                    <span className="text-red-400">▼{Math.abs(delta).toFixed(1)}%p</span>
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
