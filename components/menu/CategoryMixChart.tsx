'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CategoryMixRow } from '@/lib/supabase/queries/menu'
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '@/components/ui/chartStyles'

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

// 카테고리를 매출 큰 순서로 배치
const STACK_ORDER = [
  'coffee',
  'dessert',
  'matcha',
  'tea',
  'beverage',
  'ade',
  'drip_coffee',
  'dutch_coffee',
  'season',
  'etc',
]

interface CategoryMixChartProps {
  data: CategoryMixRow[]
  categories: string[]
  mode?: 'absolute' | 'percent'
}

function formatManwon(v: number) {
  return `${Math.round(v / 10000)}만`
}

export default function CategoryMixChart({
  data,
  categories,
  mode = 'percent',
}: CategoryMixChartProps) {
  const sortedCats = STACK_ORDER.filter((c) => categories.includes(c))

  // percent 모드이면 각 월 합계로 나누기
  const chartData =
    mode === 'percent'
      ? data.map((row) => {
          const total = sortedCats.reduce((s, c) => s + Number(row[c] ?? 0), 0)
          const out: Record<string, number | string> = { yearMonth: row.yearMonth }
          for (const c of sortedCats) {
            out[c] = total > 0 ? (Number(row[c] ?? 0) / total) * 100 : 0
          }
          return out
        })
      : data

  // 라벨 포맷: "2026-03" → "3월"
  function formatMonth(ym: string) {
    const m = Number(ym.slice(5, 7))
    return `${m}월`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">월별 카테고리 믹스</p>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">
          {mode === 'percent' ? '비율 (%)' : '금액'} · 누적 영역
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="yearMonth"
            tickFormatter={formatMonth}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={
              mode === 'percent'
                ? (v) => `${v}%`
                : (v) => formatManwon(Number(v))
            }
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={mode === 'percent' ? 36 : 56}
            domain={mode === 'percent' ? [0, 100] : undefined}
            ticks={mode === 'percent' ? [0, 25, 50, 75, 100] : undefined}
          />
          <Tooltip
            formatter={(value, name) => {
              const label = CATEGORY_LABEL[String(name)] ?? name
              const v = Number(value)
              return [mode === 'percent' ? `${v.toFixed(1)}%` : formatManwon(v), label]
            }}
            labelFormatter={(l) => formatMonth(String(l))}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(v) => CATEGORY_LABEL[String(v)] ?? v}
          />
          {sortedCats.map((c) => (
            <Area
              key={c}
              type="monotone"
              dataKey={c}
              stackId="1"
              stroke={CATEGORY_HEX[c] ?? '#c4c7cc'}
              fill={CATEGORY_HEX[c] ?? '#c4c7cc'}
              strokeWidth={0.5}
              fillOpacity={0.85}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
