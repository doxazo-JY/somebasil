'use client'

import { useRouter, usePathname } from 'next/navigation'

interface YearFilterProps {
  year: number
}

export default function YearFilter({ year }: YearFilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const years = [year - 1, year, year + 1]

  return (
    <select
      value={year}
      onChange={(e) => router.push(`${pathname}?year=${e.target.value}`)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  )
}
