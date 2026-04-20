const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

interface Staff {
  id: number
  name: string
  role: string
}

interface SalaryEntry {
  staff_id: number
  month: number
  amount: number
}

interface LaborGridProps {
  staffList: Staff[]
  salaries: SalaryEntry[]
  year: number
}

export default function LaborGrid({ staffList, salaries, year }: LaborGridProps) {
  // staff_id + month → amount 맵
  const salaryMap: Record<string, number> = {}
  for (const s of salaries) {
    salaryMap[`${s.staff_id}-${s.month}`] = s.amount
  }

  // 월별 합계
  const monthTotals: Record<number, number> = {}
  for (const s of salaries) {
    monthTotals[s.month] = (monthTotals[s.month] ?? 0) + s.amount
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto w-full">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">인건비 현황 ({year}년)</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-400 font-medium">
            <th className="text-left px-5 py-2.5 w-24">직원</th>
            {MONTHS.map((m) => (
              <th key={m} className="text-right px-3 py-2.5 w-16">{m}월</th>
            ))}
            <th className="text-right px-4 py-2.5 w-20">합계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {staffList.map((staff) => {
            const yearTotal = MONTHS.reduce(
              (s, m) => s + (salaryMap[`${staff.id}-${m}`] ?? 0), 0
            )
            return (
              <tr key={staff.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-2.5 font-medium text-gray-700">{staff.name}</td>
                {MONTHS.map((m) => {
                  const amount = salaryMap[`${staff.id}-${m}`]
                  return (
                    <td key={m} className="px-3 py-2.5 text-right text-gray-600">
                      {amount ? `${Math.round(amount / 10000)}만` : '—'}
                    </td>
                  )
                })}
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                  {yearTotal > 0 ? `${Math.round(yearTotal / 10000)}만` : '—'}
                </td>
              </tr>
            )
          })}
          {/* 합계 행 */}
          <tr className="bg-gray-50 font-medium">
            <td className="px-5 py-2.5 text-gray-500">합계</td>
            {MONTHS.map((m) => (
              <td key={m} className="px-3 py-2.5 text-right text-gray-700">
                {monthTotals[m] ? `${Math.round(monthTotals[m] / 10000)}만` : '—'}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right text-gray-800">
              {Math.round(Object.values(monthTotals).reduce((s, v) => s + v, 0) / 10000)}만
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
