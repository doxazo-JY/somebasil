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

interface MonthlySummary {
  month: number
  income: number
  total_expense: number
  profit: number
}

interface TrendChartProps {
  data: MonthlySummary[]
}

function formatManwon(value: number) {
  return `${Math.round(value / 10000)}만`
}

export default function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((d) => ({
    month: `${d.month}월`,
    수입: d.income,
    지출: d.total_expense,
    이익: d.profit,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">월별 트렌드</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatManwon} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
          <Tooltip formatter={(value) => formatManwon(Number(value))} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="수입" stroke="#1a5c3a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="지출" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="이익" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
