'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '@/components/ui/chartStyles'

interface ExpenseItem {
  category: string
  amount: number
}

interface ExpenseDonutProps {
  data: ExpenseItem[]
}

const CATEGORY_LABEL: Record<string, string> = {
  ingredients: '재료비',
  labor: '인건비',
  fixed: '고정비',
  equipment: '설비투자',
  card: '카드대금',
}

const COLORS = ['#1a5c3a', '#4ade80', '#86efac', '#60a5fa', '#bbf7d0']

export default function ExpenseDonut({ data }: ExpenseDonutProps) {
  // 카테고리별 합산
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.amount
    return acc
  }, {})

  const chartData = Object.entries(grouped).map(([category, amount]) => ({
    name: CATEGORY_LABEL[category] ?? category,
    value: amount,
  }))

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">지출 비중</p>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={33}
              outerRadius={50}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${Math.round(Number(value) / 10000)}만`}
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex flex-col gap-1.5 text-xs text-gray-600">
          {chartData.map((item, i) => (
            <li key={item.name} className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span>{item.name}</span>
              <span className="ml-auto font-medium text-gray-800">
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
