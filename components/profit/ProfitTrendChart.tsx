'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface MonthData {
  month: number
  income: number
  total_expense: number
  profit: number
}

interface ProfitTrendChartProps {
  data: MonthData[]
  selectedMonth: number
}

function formatManwon(value: number) {
  return `${Math.round(value / 10000)}만`
}

export default function ProfitTrendChart({ data, selectedMonth }: ProfitTrendChartProps) {
  const chartData = data.map((d) => ({
    month: `${d.month}월`,
    수입: d.income,
    지출: d.total_expense,
    순이익: d.profit,
    _selected: d.month === selectedMonth,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">수입 · 지출 · 이익 추이</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatManwon} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={(value) => formatManwon(Number(value))} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="수입" stroke="#1a5c3a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="지출" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="순이익" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
