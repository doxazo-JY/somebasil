'use client'

import { useState } from 'react'
import type { MenuCost } from '@/lib/supabase/queries/recipe-costs'

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

type Filter = 'all' | 'ok' | 'missing'
type Sort = 'cost_ratio_desc' | 'margin_asc' | 'name'

export default function CostTable({ costs }: { costs: MenuCost[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('cost_ratio_desc')

  const filtered = costs.filter((c) => {
    if (filter === 'ok') return c.status === 'ok'
    if (filter === 'missing') return c.status !== 'ok'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.productName.localeCompare(b.productName)
    if (sort === 'cost_ratio_desc') {
      // ok 메뉴는 원가율 desc, 미등록은 맨 뒤
      if (a.status === 'ok' && b.status === 'ok') return (b.costRatio ?? 0) - (a.costRatio ?? 0)
      if (a.status === 'ok') return -1
      if (b.status === 'ok') return 1
      return 0
    }
    // margin_asc — 마진 적은 순
    if (a.status === 'ok' && b.status === 'ok') return (a.margin ?? 0) - (b.margin ?? 0)
    if (a.status === 'ok') return -1
    if (b.status === 'ok') return 1
    return 0
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'ok', 'missing'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? '전체' : f === 'ok' ? '원가 등록' : '미등록'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700"
        >
          <option value="cost_ratio_desc">원가율 높은 순</option>
          <option value="margin_asc">마진 적은 순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium px-4 py-2.5">메뉴</th>
              <th className="text-left font-medium px-2 py-2.5">분류</th>
              <th className="text-right font-medium px-2 py-2.5">판매가</th>
              <th className="text-right font-medium px-2 py-2.5">원가</th>
              <th className="text-right font-medium px-2 py-2.5">마진</th>
              <th className="text-right font-medium px-4 py-2.5">원가율</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <CostRow key={c.productId} cost={c} />
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          표시할 메뉴가 없습니다.
        </p>
      )}
    </div>
  )
}

function CostRow({ cost: c }: { cost: MenuCost }) {
  const isOk = c.status === 'ok'
  const ratioColor =
    c.costRatio == null
      ? 'text-gray-400'
      : c.costRatio >= 0.4
        ? 'text-red-500'
        : c.costRatio >= 0.3
          ? 'text-amber-600'
          : 'text-[#1a5c3a]'

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-2.5">
        <div className="text-gray-800">{c.productName}</div>
        {c.status === 'missing_price' && c.missingIngredients && c.missingIngredients.length > 0 && (
          <div className="text-[11px] text-amber-600 mt-0.5">
            ⚠ {c.missingIngredients.slice(0, 2).join(', ')}
            {c.missingIngredients.length > 2 && ` 외 ${c.missingIngredients.length - 2}건`}
          </div>
        )}
        {c.status === 'no_recipe' && (
          <div className="text-[11px] text-gray-400 mt-0.5">레시피 미등록</div>
        )}
      </td>
      <td className="px-2 py-2.5 text-gray-500 text-xs">
        {CATEGORY_LABEL[c.productCategory] ?? c.productCategory ?? '-'}
        {c.servingTemp && (
          <span className="ml-1 text-gray-300">
            {c.servingTemp === 'hot' ? 'H' : 'I'}
          </span>
        )}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {c.price.toLocaleString()}원
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {isOk ? `${c.totalCost!.toLocaleString()}원` : '-'}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {isOk ? `${c.margin!.toLocaleString()}원` : '-'}
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${ratioColor}`}>
        {isOk ? `${(c.costRatio! * 100).toFixed(1)}%` : '-'}
      </td>
    </tr>
  )
}
