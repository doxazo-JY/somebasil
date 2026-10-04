'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '@/components/ui/chartStyles'
import type { DayType, HourlyLaborResult } from '@/lib/supabase/queries/labor'

// 시간대별 매출 vs 근무 인원 — 손님 없는 시간에 사람이 많은지 확인

interface HourlyLaborSectionProps {
  data: HourlyLaborResult
}

const DAY_LABEL: Record<DayType, string> = { weekday: '평일', weekend: '주말' }

function won(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}만` : `${Math.round(v / 1000)}천`
}

export default function HourlyLaborSection({ data }: HourlyLaborSectionProps) {
  const [type, setType] = useState<DayType>('weekday')
  const cells = data.cells[type]

  const chartData = cells.map((c) => ({
    label: `${c.hour}시`,
    매출: Math.round(c.sales),
    '알바 인원': Math.round(c.staff * 10) / 10,
  }))

  // 사람이 있는 시간 중 인건비율이 가장 높은 시간 (= 매출 대비 사람이 많은 시간)
  const staffed = cells.filter((c) => c.staff >= 0.3)
  const worst = [...staffed]
    .map((c) => ({ ...c, ratio: c.sales > 0 ? c.laborCost / c.sales : Infinity }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 2)
  const totalSales = cells.reduce((s, c) => s + c.sales, 0)
  const totalCost = cells.reduce((s, c) => s + c.laborCost, 0)

  const period = data.months.map((m) => `${m.month}월`).join('·')

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-700">시간대별 매출 vs 알바 인원</p>
          <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
            {period} 근무일지 기준 · 하루 평균 ({DAY_LABEL[type]} {data.days[type]}일)
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 shrink-0">
          {(['weekday', 'weekend'] as DayType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {DAY_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 한 줄 요약 */}
      {worst.length > 0 && totalSales > 0 && (
        <p className="text-sm text-gray-600 mt-3 mb-4 [word-break:keep-all]">
          {DAY_LABEL[type]} 알바 인건비는 매출의{' '}
          <strong className="text-gray-900">{((totalCost / totalSales) * 100).toFixed(0)}%</strong>. 매출에 비해
          사람이 가장 많은 시간은{' '}
          {worst.map((w, i) => (
            <span key={w.hour}>
              {i > 0 && ', '}
              <strong className="text-red-500">{w.hour}시</strong>
              <span className="text-gray-400">
                {' '}
                ({w.staff.toFixed(1)}명 · 매출 {won(w.sales)})
              </span>
            </span>
          ))}
        </p>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="sales"
            tickFormatter={(v) => won(Number(v))}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="staff"
            orientation="right"
            tickFormatter={(v) => `${v}명`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value, name) =>
              name === '매출' ? `${Number(value).toLocaleString()}원` : `${value}명`
            }
            contentStyle={tooltipContentStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="sales" type="monotone" dataKey="매출" stroke="#1a5c3a" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="staff" type="stepAfter" dataKey="알바 인원" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-gray-400 mt-3 [word-break:keep-all]">
        근무일지에 있는 알바만 집계 (점장·매니저·사장님 제외) · 인건비 = 근무시간 × 시급, 주휴수당 제외 · 토·일 = 주말
      </p>
    </div>
  )
}
