interface MonthData {
  month: number
  income: number
  total_expense: number
  profit: number
}

interface MonthlyBreakdownTableProps {
  data: MonthData[]
  year: number
  /** 하이라이트할 월 (옵션) */
  selectedMonth?: number
}

function fmt(v: number) {
  return `${Math.round(v / 10000)}만`
}

function margin(profit: number, income: number) {
  if (income === 0) return '—'
  return `${((profit / income) * 100).toFixed(1)}%`
}

export default function MonthlyBreakdownTable({ data, selectedMonth, year }: MonthlyBreakdownTableProps) {
  // 데이터 있는 월만 표시 (매출 또는 지출 존재)
  const rows = data
    .filter((d) => d.income > 0 || d.total_expense > 0)
    .sort((a, b) => a.month - b.month)

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
                <td className="px-4 py-2.5 text-right text-gray-600">{fmt(r.income)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{fmt(r.total_expense)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${
                  r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'
                }`}>
                  {fmt(r.profit)}
                </td>
                <td className={`px-4 py-2.5 text-right ${
                  r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'
                }`}>
                  {margin(r.profit, r.income)}
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
