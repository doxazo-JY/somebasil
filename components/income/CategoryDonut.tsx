'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피류',
  matcha: '말차류',
  beverage: '음료류',
  dessert: '디저트',
}

const COLORS = ['#1a5c3a', '#2d7a52', '#4a9e72', '#86c9a4', '#d4eddf']

interface CategoryItem {
  category: string
  amount: number
}

interface CategoryDonutProps {
  data: CategoryItem[]
}

export default function CategoryDonut({ data }: CategoryDonutProps) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  const chartData = data.map((d) => ({
    name: CATEGORY_LABEL[d.category] ?? d.category,
    value: d.amount,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">카테고리별 비중</p>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={58}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex flex-col gap-2 text-xs text-gray-600 flex-1">
          {chartData.map((item, i) => (
            <li key={item.name} className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="flex-1">{item.name}</span>
              <span className="font-medium text-gray-800">
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </span>
              <span className="text-gray-400 w-12 text-right">
                {Math.round(item.value / 10000)}만
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
