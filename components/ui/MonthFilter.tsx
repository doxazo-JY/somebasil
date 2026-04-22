'use client'

import { useRouter, usePathname } from 'next/navigation'

interface MonthFilterProps {
  year: number
  month: number
}

export default function MonthFilter({ year, month }: MonthFilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  function handleChange(newYear: number, newMonth: number) {
    router.push(`${pathname}?year=${newYear}&month=${newMonth}`)
  }

  const years = [year - 1, year, year + 1]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2">
      <select
        value={year}
        onChange={(e) => handleChange(Number(e.target.value), month)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}년</option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => handleChange(year, Number(e.target.value))}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
      >
        {months.map((m) => (
          <option key={m} value={m}>{m}월</option>
        ))}
      </select>
    </div>
  )
}
