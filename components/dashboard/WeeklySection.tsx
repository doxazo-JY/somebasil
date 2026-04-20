'use client'

// 주간 현황 섹션 — 대시보드 주간보고용
import { WeekData } from '@/lib/supabase/queries/weekly'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'

interface WeeklySectionProps {
  data: WeekData[]
}

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function DiffBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null
  const diff = current - prev
  const pct = Math.round((diff / Math.abs(prev)) * 100)
  const up = diff >= 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

// 툴팁 커스텀
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as WeekData
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-700 mb-1">{d.label} ({d.weekStart} ~ {d.weekEnd})</p>
      <p className="text-[#1a5c3a]">매출 {fmt(d.income)}</p>
      {d.hasExpenseData && <p className="text-red-400">지출 {fmt(d.expense)}</p>}
      {d.hasExpenseData && (
        <p className={d.profit >= 0 ? 'text-[#1a5c3a] font-semibold' : 'text-red-500 font-semibold'}>
          손익 {fmt(d.profit)}
        </p>
      )}
      {!d.hasExpenseData && (
        <p className="text-gray-400">지출 데이터 없음</p>
      )}
    </div>
  )
}

export default function WeeklySection({ data }: WeeklySectionProps) {
  if (!data.length) return null

  const thisWeek = data[data.length - 1]
  const lastWeek = data[data.length - 2]

  // 차트 데이터
  const chartData = data.map((d) => ({
    ...d,
    incomeM: Math.round(d.income / 10000),
    expenseM: d.hasExpenseData ? Math.round(d.expense / 10000) : null,
    profitM: d.hasExpenseData ? Math.round(d.profit / 10000) : null,
  }))

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        주간 현황
      </p>

      {/* 이번 주 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* 이번 주 매출 */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-400 mb-1">이번 주 매출</p>
          <p className="text-xl font-bold text-gray-800">{fmt(thisWeek.income)}</p>
          {lastWeek && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-400">전주比</span>
              <DiffBadge current={thisWeek.income} prev={lastWeek.income} />
            </div>
          )}
        </div>

        {/* 이번 주 지출 */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-400 mb-1">이번 주 지출</p>
          {thisWeek.hasExpenseData ? (
            <>
              <p className="text-xl font-bold text-gray-800">{fmt(thisWeek.expense)}</p>
              {lastWeek?.hasExpenseData && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-400">전주比</span>
                  <DiffBadge current={thisWeek.expense} prev={lastWeek.expense} />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-300 mt-1">데이터 없음</p>
          )}
        </div>

        {/* 이번 주 손익 */}
        <div className={`rounded-xl border px-4 py-4 ${thisWeek.hasExpenseData
          ? thisWeek.profit >= 0
            ? 'bg-green-50/50 border-[#1a5c3a]/20'
            : 'bg-red-50/30 border-red-100'
          : 'bg-white border-gray-100'
          }`}>
          <p className="text-xs text-gray-400 mb-1">이번 주 손익</p>
          {thisWeek.hasExpenseData ? (
            <p className={`text-xl font-bold ${thisWeek.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
              {fmt(thisWeek.profit)}
            </p>
          ) : (
            <p className="text-sm text-gray-300 mt-1">데이터 없음</p>
          )}
        </div>

        {/* 기간 */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-4 flex flex-col justify-center">
          <p className="text-xs text-gray-400 mb-1">집계 기간</p>
          <p className="text-sm font-semibold text-gray-700">{thisWeek.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{thisWeek.weekStart} ~ {thisWeek.weekEnd}</p>
        </div>
      </div>

      {/* 주간 추이 차트 */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">최근 {data.length}주 추이</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={56}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}만`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="incomeM"
              stroke="#1a5c3a"
              strokeWidth={2}
              dot={{ r: 3, fill: '#1a5c3a' }}
              name="매출"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="expenseM"
              stroke="#f87171"
              strokeWidth={2}
              dot={{ r: 3, fill: '#f87171' }}
              name="지출"
              strokeDasharray="4 2"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="flex items-center gap-5 justify-center mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-[#1a5c3a] rounded-full" />
            <span className="text-xs text-gray-400">매출</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-red-400 rounded-full border-dashed" />
            <span className="text-xs text-gray-400">지출 (통장 업로드 시 반영)</span>
          </div>
        </div>
      </div>

      {/* 주별 테이블 */}
      <div className="mt-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">주차</th>
              <th className="px-4 py-3 text-right font-medium">매출</th>
              <th className="px-4 py-3 text-right font-medium">지출</th>
              <th className="px-4 py-3 text-right font-medium">손익</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((w, i) => {
              const isThis = i === 0
              return (
                <tr
                  key={w.weekStart}
                  className={`border-b border-gray-50 last:border-0 ${isThis ? 'bg-gray-50/50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isThis ? 'text-gray-800' : 'text-gray-600'}`}>
                      {w.label}
                    </span>
                    {isThis && (
                      <span className="ml-2 text-[10px] bg-[#1a5c3a]/10 text-[#1a5c3a] rounded px-1.5 py-0.5">
                        이번 주
                      </span>
                    )}
                    <span className="block text-[10px] text-gray-400">{w.weekStart} ~ {w.weekEnd}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {fmt(w.income)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {w.hasExpenseData ? fmt(w.expense) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${!w.hasExpenseData ? 'text-gray-300' : w.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
                    {w.hasExpenseData ? fmt(w.profit) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
