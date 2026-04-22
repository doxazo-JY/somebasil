'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { HotIceRow } from '@/lib/supabase/queries/menu'
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '@/components/ui/chartStyles'

interface HotIceChartProps {
  data: HotIceRow[]
}

export default function HotIceChart({ data }: HotIceChartProps) {
  const chartData = data.map((r) => {
    const total = r.hot + r.ice + r.other
    return {
      yearMonth: r.yearMonth,
      HOT: total > 0 ? (r.hot / total) * 100 : 0,
      ICE: total > 0 ? (r.ice / total) * 100 : 0,
    }
  })

  function formatMonth(ym: string) {
    const m = Number(ym.slice(5, 7))
    return `${m}월`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">HOT / ICE 비율 월별</p>
        <p className="text-[11px] text-gray-400">음료만 (디저트/조정 제외)</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="yearMonth"
            tickFormatter={formatMonth}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            labelFormatter={(l) => formatMonth(String(l))}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="HOT"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="ICE"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
