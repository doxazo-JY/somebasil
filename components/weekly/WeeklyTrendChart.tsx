'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Dot,
} from 'recharts'
import type { WeekData } from '@/lib/supabase/queries/weekly'

interface Props {
  data: WeekData[]
  /** 선택된 주의 시작일 (하이라이트용) */
  highlightWeekStart?: string
}

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

// 툴팁
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: WeekData }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-md px-2.5 py-2 shadow-sm text-xs leading-tight">
      <p className="font-medium text-gray-700 mb-1">{d.label}</p>
      <p className="text-[#1a5c3a]">매출 {fmt(d.income)}</p>
      {d.hasExpenseData && <p className="text-red-400">지출 {fmt(d.expense)}</p>}
      {d.hasExpenseData && (
        <p className={d.profit >= 0 ? 'text-[#1a5c3a] font-semibold' : 'text-red-500 font-semibold'}>
          손익 {fmt(d.profit)}
        </p>
      )}
    </div>
  )
}

export default function WeeklyTrendChart({ data, highlightWeekStart }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    incomeM: Math.round(d.income / 10000),
    expenseM: d.hasExpenseData ? Math.round(d.expense / 10000) : null,
    isHighlight: d.weekStart === highlightWeekStart,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">최근 {data.length}주 추이</p>
        <p className="text-[11px] text-gray-400">선택 주 하이라이트</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={48}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}만`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
          {/* 선택된 주 수직선 */}
          {highlightWeekStart && (
            <ReferenceLine
              x={chartData.find((d) => d.weekStart === highlightWeekStart)?.label}
              stroke="#1a5c3a"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
          )}
          <Line
            type="monotone"
            dataKey="incomeM"
            stroke="#1a5c3a"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isHighlight: boolean } }
              return (
                <Dot
                  cx={cx}
                  cy={cy}
                  r={payload.isHighlight ? 5 : 3}
                  fill={payload.isHighlight ? '#1a5c3a' : '#fff'}
                  stroke="#1a5c3a"
                  strokeWidth={2}
                />
              )
            }}
            name="매출"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="expenseM"
            stroke="#f87171"
            strokeWidth={1.5}
            dot={{ r: 2.5, fill: '#f87171' }}
            name="지출"
            strokeDasharray="4 2"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-5 justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-[#1a5c3a] rounded-full" />
          <span className="text-xs text-gray-400">매출</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-red-400 rounded-full" style={{ borderStyle: 'dashed' }} />
          <span className="text-xs text-gray-400">지출</span>
        </div>
      </div>
    </div>
  )
}
