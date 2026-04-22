'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProductAgg } from '@/lib/supabase/queries/income'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '@/components/ui/chartStyles'

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

// 카테고리별 색상 (무드 톤 — 커피는 시그니처 다크그린 유지, 나머지는 파스텔)
const CATEGORY_HEX: Record<string, string> = {
  coffee: '#1a5c3a', // 시그니처 다크그린
  drip_coffee: '#6ba088',
  dutch_coffee: '#9ec8b2',
  matcha: '#7cc4a7', // 살짝 틸 느낌
  ade: '#e8c787', // 무드 옐로우
  tea: '#e8a98a', // 더스티 피치
  beverage: '#8fb9d4', // 무드 블루그레이
  dessert: '#d99aa8', // 더스티 로즈
  season: '#b8a0d0', // 무드 라벤더
  etc: '#c4c7cc', // 라이트 그레이
}
const FALLBACK_COLOR = '#c4c7cc'

interface CategoryItem {
  category: string
  amount: number
}

interface CategoryDonutProps {
  data: CategoryItem[]
  products: ProductAgg[]
}

export default function CategoryDonut({ data, products }: CategoryDonutProps) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  const [selected, setSelected] = useState<string | null>(null)

  // 카테고리 → 색상 맵 (고정 팔레트)
  const colorByCategory = new Map<string, string>()
  data.forEach((d) => colorByCategory.set(d.category, CATEGORY_HEX[d.category] ?? FALLBACK_COLOR))

  const chartData = data.map((d) => ({
    name: CATEGORY_LABEL[d.category] ?? d.category,
    value: d.amount,
    category: d.category,
  }))

  const selectedProducts = selected
    ? products.filter((p) => p.category === selected).slice(0, 10)
    : []
  const selectedTotal = selectedProducts.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">카테고리별 비중</p>
        <p className="text-[11px] text-gray-400">
          {selected ? '카테고리 클릭 시 전체 복귀' : '카테고리 클릭 시 상품 목록'}
        </p>
      </div>

      <div className="flex items-center gap-6">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={54}
              dataKey="value"
              strokeWidth={0}
              onClick={(e: { category?: string }) => {
                if (!e?.category) return
                setSelected((prev) => (prev === e.category ? null : e.category!))
              }}
              cursor="pointer"
            >
              {chartData.map((d, i) => {
                const active = selected === null || selected === d.category
                return (
                  <Cell
                    key={i}
                    fill={CATEGORY_HEX[d.category] ?? FALLBACK_COLOR}
                    opacity={active ? 1 : 0.2}
                  />
                )
              })}
            </Pie>
            <Tooltip
              formatter={(value) => `${Math.round(Number(value) / 10000)}만`}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
          </PieChart>
        </ResponsiveContainer>

        <ul className="flex flex-col gap-1.5 text-xs text-gray-600 flex-1">
          {chartData.map((item) => {
            const isSelected = selected === item.category
            return (
              <li
                key={item.name}
                onClick={() =>
                  setSelected((prev) =>
                    prev === item.category ? null : item.category
                  )
                }
                className={`flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 transition-colors ${
                  isSelected
                    ? 'bg-[#1a5c3a]/5 text-[#1a5c3a]'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: CATEGORY_HEX[item.category] ?? FALLBACK_COLOR }}
                />
                <span className="flex-1">{item.name}</span>
                <span className="font-medium text-gray-800">
                  {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                </span>
                <span className="text-gray-400 w-12 text-right">
                  {Math.round(item.value / 10000)}만
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {selected && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">
              {CATEGORY_LABEL[selected] ?? selected}{' '}
              <span className="text-xs text-gray-400 font-normal">
                ({selectedTotal.toLocaleString()}원 · {selectedProducts.length}개)
              </span>
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              ✕ 닫기
            </button>
          </div>
          {selectedProducts.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">이 카테고리 상품 없음</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {selectedProducts.map((p, i) => {
                const ratio = p.amount / (selectedProducts[0]?.amount ?? 1)
                return (
                  <li key={p.product_name} className="flex items-center gap-2">
                    <span className="w-4 text-gray-400 tabular-nums text-right">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-gray-700">
                      {p.product_name}
                    </span>
                    <span className="text-gray-400 tabular-nums shrink-0">
                      {p.quantity}잔
                    </span>
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratio * 100}%`,
                          background: colorByCategory.get(selected),
                        }}
                      />
                    </div>
                    <span className="text-gray-700 tabular-nums w-20 text-right shrink-0">
                      {p.amount.toLocaleString()}원
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
