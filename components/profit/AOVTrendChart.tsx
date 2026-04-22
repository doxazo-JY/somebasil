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
import type { MonthlyAOVPoint } from '@/lib/supabase/queries/income'
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from '@/components/ui/chartStyles'

interface AOVTrendChartProps {
  data: MonthlyAOVPoint[]
  selectedMonth?: number
}

export default function AOVTrendChart({ data }: AOVTrendChartProps) {
  // selectedMonth 제거 — 연간 전략 뷰에서는 참조선 불필요
  // 데이터 없는 월(0원)은 null로 처리해서 라인 끊기
  const chartData = data.map((p) => ({
    month: `${p.month}월`,
    monthNum: p.month,
    객단가: p.aov > 0 ? p.aov : null,
    주문건수: p.orderCount > 0 ? p.orderCount : null,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">월별 객단가 · 주문 건수</p>
        <p className="text-[11px] text-gray-400">업셀 추적 · 듀얼 축</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="aov"
            orientation="left"
            tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}천`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tickFormatter={(v) => `${v}건`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === '객단가') return [`${Number(value).toLocaleString()}원`, name]
              return [`${Number(value).toLocaleString()}건`, name]
            }}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="aov"
            type="monotone"
            dataKey="객단가"
            stroke="#1a5c3a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="주문건수"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2.5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
