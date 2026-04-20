interface MonthData {
  month: number
  income: number
  total_expense: number
  profit: number
}

interface MonthlyBreakdownTableProps {
  data: MonthData[]
  selectedMonth: number
  year: number
}

function fmt(v: number) {
  return `${Math.round(v / 10000)}만`
}

function margin(profit: number, income: number) {
  if (income === 0) return '—'
  return `${((profit / income) * 100).toFixed(1)}%`
}

export default function MonthlyBreakdownTable({ data, selectedMonth, year }: MonthlyBreakdownTableProps) {
  // 1~12월 전체 채우기 (없는 달은 0)
  const byMonth: Record<number, MonthData> = {}
  for (const d of data) byMonth[d.month] = d

  const rows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return byMonth[m] ?? { month: m, income: 0, total_expense: 0, profit: 0 }
  })

  // 누적 합계
  const totIncome = rows.reduce((s, r) => s + r.income, 0)
  const totExpense = rows.reduce((s, r) => s + r.total_expense, 0)
  const totProfit = rows.reduce((s, r) => s + r.profit, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">{year}년 월별 손익</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-400 font-medium">
            <th className="text-left px-6 py-2.5">월</th>
            <th className="text-right px-4 py-2.5">매출</th>
            <th className="text-right px-4 py-2.5">지출</th>
            <th className="text-right px-4 py-2.5">순이익</th>
            <th className="text-right px-4 py-2.5">이익률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => {
            const hasData = r.income > 0 || r.total_expense > 0
            const isSelected = r.month === selectedMonth
            return (
              <tr
                key={r.month}
                className={`${isSelected ? 'bg-[#1a5c3a]/5' : 'hover:bg-gray-50/50'}`}
              >
                <td className={`px-6 py-2.5 font-medium ${isSelected ? 'text-[#1a5c3a]' : 'text-gray-700'}`}>
                  {r.month}월
                  {isSelected && <span className="ml-1.5 text-[10px] text-[#1a5c3a]">▶</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {hasData ? fmt(r.income) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {hasData ? fmt(r.total_expense) : '—'}
                </td>
                <td className={`px-4 py-2.5 text-right font-semibold ${
                  !hasData ? 'text-gray-300'
                  : r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'
                }`}>
                  {hasData ? fmt(r.profit) : '—'}
                </td>
                <td className={`px-4 py-2.5 text-right ${
                  !hasData ? 'text-gray-300'
                  : r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'
                }`}>
                  {hasData ? margin(r.profit, r.income) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        {/* 합계 행 */}
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-100 font-semibold">
            <td className="px-6 py-2.5 text-gray-500">합계</td>
            <td className="px-4 py-2.5 text-right text-gray-700">{fmt(totIncome)}</td>
            <td className="px-4 py-2.5 text-right text-gray-700">{fmt(totExpense)}</td>
            <td className={`px-4 py-2.5 text-right ${totProfit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
              {fmt(totProfit)}
            </td>
            <td className={`px-4 py-2.5 text-right ${totProfit >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'}`}>
              {margin(totProfit, totIncome)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
