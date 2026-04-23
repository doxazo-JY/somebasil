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
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '@/components/ui/chartStyles'

interface MonthlyExpense {
  month: number
  ingredients: number
  ingredients_cash: number
  ingredients_card: number
  labor: number
  fixed: number
  equipment: number
  card: number
}

interface ExpenseTrendChartProps {
  data: MonthlyExpense[]
  selectedMonth: number
}

export default function ExpenseTrendChart({ data, selectedMonth }: ExpenseTrendChartProps) {
  const chartData = data.map((d) => ({
    month: `${d.month}월`,
    인건비: d.labor,
    '재료비(현금)': d.ingredients_cash,
    '재료비(카드)': d.ingredients_card,
    고정비: d.fixed,
    설비투자: d.equipment,
    카드대금: d.card,
    selected: d.month === selectedMonth,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">항목별 지출 추이</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 10000)}만`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value) => `${Math.round(Number(value) / 10000)}만원`}
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="인건비" stroke="#1a5c3a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="재료비(현금)" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="재료비(카드)" stroke="#fcd34d" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="고정비" stroke="#6b7280" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="설비투자" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
          <Line type="monotone" dataKey="카드대금" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
