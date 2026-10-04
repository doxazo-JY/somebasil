'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '@/components/ui/chartStyles'

// 매출 = 고객 수 × 객단가 — 둘을 갈라서 매출 변화의 원인 확인

interface CustomerAovChartProps {
  data: { year: number; month: number; dailyCustomers: number; aov: number }[]
}

export default function CustomerAovChart({ data }: CustomerAovChartProps) {
  // 연도가 섞이면 "25.12" 형태로 표기
  const multiYear = new Set(data.map((d) => d.year)).size > 1
  const chartData = data.map((d) => ({
    label: multiYear ? `${String(d.year).slice(2)}.${d.month}` : `${d.month}월`,
    '하루 고객': Math.round(d.dailyCustomers),
    객단가: Math.round(d.aov),
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700">하루 고객 수 × 객단가 추이</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-4 [word-break:keep-all]">
        매출이 변했다면 손님이 줄었는지, 덜 쓰고 갔는지 구분
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="customers"
            tickFormatter={(v) => `${v}명`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="aov"
            orientation="right"
            tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}천`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value, name) =>
              name === '객단가' ? `${Number(value).toLocaleString()}원` : `${value}명`
            }
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="customers" type="monotone" dataKey="하루 고객" stroke="#1a5c3a" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="aov" type="monotone" dataKey="객단가" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
