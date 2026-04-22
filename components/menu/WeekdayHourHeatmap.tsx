'use client'

import { useState } from 'react'
import type { HeatmapCell } from '@/lib/supabase/queries/menu'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface WeekdayHourHeatmapProps {
  cells: HeatmapCell[]
  /** 보여줄 시간대 범위 (기본 9-22시 — 영업시간) */
  startHour?: number
  endHour?: number
  /** 기간 레이블 (우측 상단 표시용) */
  rangeLabel?: string
}

function heatColor(ratio: number): string {
  if (ratio === 0) return 'bg-gray-50 text-gray-300'
  if (ratio < 0.1) return 'bg-[#d4eddf] text-gray-500'
  if (ratio < 0.25) return 'bg-[#a8dab8] text-gray-700'
  if (ratio < 0.5) return 'bg-[#65b889] text-white'
  if (ratio < 0.75) return 'bg-[#2d7a52] text-white'
  return 'bg-[#1a5c3a] text-white'
}

export default function WeekdayHourHeatmap({
  cells,
  startHour = 9,
  endHour = 22,
  rangeLabel,
}: WeekdayHourHeatmapProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null)

  const byKey = new Map<string, HeatmapCell>()
  let maxOrder = 0
  for (const c of cells) {
    byKey.set(`${c.weekday}|${c.hour}`, c)
    if (c.hour >= startHour && c.hour <= endHour && c.orderCount > maxOrder) {
      maxOrder = c.orderCount
    }
  }

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-baseline gap-2 [word-break:keep-all]">
          <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">요일 × 시간대 매출</p>
          {rangeLabel && (
            <span className="text-[11px] text-gray-400 whitespace-nowrap">· {rangeLabel}</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">색이 진할수록 주문 많음</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-1 table-fixed">
          <colgroup>
            <col className="w-8" />
            {hours.map((h) => (
              <col key={h} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} className="text-gray-400 font-medium text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdayOrder.map((w) => (
              <tr key={w}>
                <td
                  className={`text-center font-medium pr-2 ${
                    w === 0 ? 'text-red-400' : w === 6 ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  {WEEKDAY_LABELS[w]}
                </td>
                {hours.map((h) => {
                  const cell = byKey.get(`${w}|${h}`)
                  const orders = cell?.orderCount ?? 0
                  const ratio = maxOrder > 0 ? orders / maxOrder : 0
                  const isHovered =
                    hovered?.weekday === w && hovered?.hour === h
                  return (
                    <td
                      key={h}
                      onMouseEnter={() =>
                        setHovered(cell ?? { weekday: w, hour: h, amount: 0, orderCount: 0 })
                      }
                      onMouseLeave={() => setHovered(null)}
                      className={`h-9 rounded text-center text-[10px] tabular-nums cursor-default transition-all ${heatColor(
                        ratio,
                      )} ${isHovered ? 'ring-2 ring-offset-1 ring-[#1a5c3a]' : ''}`}
                    >
                      {orders > 0 ? orders : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 상세 영역 — 호버 시 실시간 표시 */}
      <div className="mt-3 min-h-[22px] text-[11px]">
        {hovered ? (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-700">
              {WEEKDAY_LABELS[hovered.weekday]} {hovered.hour}시
            </span>
            <span className="text-gray-500">
              주문 <span className="text-gray-800 font-medium">{hovered.orderCount}건</span>
            </span>
            <span className="text-gray-500">
              매출{' '}
              <span className="text-gray-800 font-medium">
                {hovered.amount.toLocaleString()}원
              </span>
            </span>
            {hovered.orderCount > 0 && (
              <span className="text-gray-500">
                객단가{' '}
                <span className="text-gray-800 font-medium">
                  {Math.round(hovered.amount / hovered.orderCount).toLocaleString()}원
                </span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400">셀에 마우스를 올리면 상세가 표시됩니다</span>
        )}
      </div>
    </div>
  )
}
