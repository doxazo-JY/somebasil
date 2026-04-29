import Link from 'next/link'

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
  /** 월별 메모 (대시보드에서 입력한 한 줄 코멘트) */
  memos?: Record<number, string>
  /** 월별 추정 자재비 (메뉴 원가 데이터 기반) — 비어있으면 컬럼 숨김 */
  materialByMonth?: Map<number, number>
}

function fmt(v: number) {
  return `${Math.round(v / 10000)}만`
}

function margin(profit: number, income: number) {
  if (income === 0) return '—'
  return `${((profit / income) * 100).toFixed(1)}%`
}

export default function MonthlyBreakdownTable({
  data,
  selectedMonth,
  year,
  memos,
  materialByMonth,
}: MonthlyBreakdownTableProps) {
  const rows = data
    .filter((d) => d.income > 0 || d.total_expense > 0)
    .sort((a, b) => a.month - b.month)

  const totIncome = rows.reduce((s, r) => s + r.income, 0)
  const totExpense = rows.reduce((s, r) => s + r.total_expense, 0)
  const totProfit = rows.reduce((s, r) => s + r.profit, 0)

  // 자재비 컬럼 표시 여부 — 데이터 1개라도 있으면 표시
  const showMaterial =
    materialByMonth != null &&
    [...materialByMonth.values()].some((v) => v > 0)
  const totMaterial = showMaterial
    ? rows.reduce((s, r) => s + (materialByMonth!.get(r.month) ?? 0), 0)
    : 0

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
            {showMaterial && <th className="text-right px-4 py-2.5">자재비</th>}
            <th className="text-right px-4 py-2.5">지출</th>
            <th className="text-right px-4 py-2.5">순이익</th>
            <th className="text-right px-4 py-2.5">이익률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => {
            const isSelected = r.month === selectedMonth
            const memo = memos?.[r.month]
            const material = materialByMonth?.get(r.month) ?? 0
            return (
              <tr
                key={r.month}
                className={`${isSelected ? 'bg-[#1a5c3a]/5' : 'hover:bg-gray-50/50'}`}
              >
                <td className={`px-6 py-2.5 font-medium align-top ${isSelected ? 'text-[#1a5c3a]' : 'text-gray-700'}`}>
                  <Link
                    href={`/?year=${year}&month=${r.month}`}
                    className="hover:underline"
                    title="대시보드에서 이 달 자세히 보기"
                  >
                    {r.month}월
                    {isSelected && <span className="ml-1.5 text-[10px] text-[#1a5c3a]">▶</span>}
                  </Link>
                  {memo && (
                    <p className="text-[10px] text-gray-400 font-normal mt-0.5 max-w-[180px] [word-break:keep-all] line-clamp-2">
                      {memo}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 align-top">{fmt(r.income)}</td>
                {showMaterial && (
                  <td className="px-4 py-2.5 text-right text-gray-500 align-top">
                    {material > 0 ? fmt(material) : '—'}
                    {material > 0 && r.income > 0 && (
                      <div className="text-[10px] text-gray-400">
                        {((material / r.income) * 100).toFixed(0)}%
                      </div>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5 text-right text-gray-600 align-top">{fmt(r.total_expense)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold align-top ${
                  r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-500'
                }`}>
                  {fmt(r.profit)}
                </td>
                <td className={`px-4 py-2.5 text-right align-top ${
                  r.profit >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'
                }`}>
                  {margin(r.profit, r.income)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-100 font-semibold">
            <td className="px-6 py-2.5 text-gray-500">합계</td>
            <td className="px-4 py-2.5 text-right text-gray-700">{fmt(totIncome)}</td>
            {showMaterial && (
              <td className="px-4 py-2.5 text-right text-gray-700">
                {totMaterial > 0 ? fmt(totMaterial) : '—'}
              </td>
            )}
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
