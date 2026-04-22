'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { WeekOption } from '@/lib/supabase/queries/weekly'

interface WeekSelectorProps {
  options: WeekOption[]
  currentWeekStart: string
}

export default function WeekSelector({ options, currentWeekStart }: WeekSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={currentWeekStart}
      onChange={(e) => router.push(`${pathname}?week=${e.target.value}`)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
    >
      {options.map((w) => {
        const suffix = w.isCurrent ? ' (이번 주 · 진행 중)' : w.isLast ? ' (지난 주)' : ''
        return (
          <option key={w.weekStart} value={w.weekStart}>
            {w.label} · {w.weekStart.slice(5)} ~ {w.weekEnd.slice(5)}
            {suffix}
          </option>
        )
      })}
    </select>
  )
}
