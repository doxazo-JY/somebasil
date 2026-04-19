'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MonthlyIncome {
  month: number
  income: number
}

interface IncomeTrendChartProps {
  data: MonthlyIncome[]
  selectedMonth: number
}

export default function IncomeTrendChart({ data, selectedMonth }: IncomeTrendChartProps) {
  const chartData = data.map((d) => ({
    month: `${d.month}월`,
    매출: d.income,
    selected: d.month === selectedMonth,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">월별 판매수입 추이</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 10000)}만`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip formatter={(value) => `${Math.round(Number(value) / 10000)}만원`} />
          <Line
            type="monotone"
            dataKey="매출"
            stroke="#1a5c3a"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              return payload.selected ? (
                <circle key={cx} cx={cx} cy={cy} r={4} fill="#1a5c3a" />
              ) : (
                <circle key={cx} cx={cx} cy={cy} r={0} fill="none" />
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
