import type { ProfitTarget } from '@/lib/diagnosis-calc'

// 목표 순이익별 필요 매출 — 손익분기 / 월 300만 / 월 500만

interface ProfitTargetTableProps {
  targets: ProfitTarget[]
  currentDailySales: number
}

function manwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs.toLocaleString()}만`
}

export default function ProfitTargetTable({ targets, currentDailySales }: ProfitTargetTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700">목표 이익별 필요 매출</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-4 [word-break:keep-all]">
        지금 비용 구조·객단가가 유지된다고 가정
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left font-medium pb-2">목표</th>
            <th className="text-right font-medium pb-2">월매출</th>
            <th className="text-right font-medium pb-2">하루 매출</th>
            <th className="text-right font-medium pb-2">하루 고객</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => {
            const hit = t.dailySales !== null && currentDailySales >= t.dailySales
            return (
              <tr key={t.label} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 text-gray-600">
                  {t.label}
                  {hit && <span className="ml-1.5 text-xs text-[#1a5c3a]">달성 중</span>}
                </td>
                <td className="py-2.5 text-right text-gray-500">
                  {t.monthlySales !== null ? manwon(t.monthlySales) : '-'}
                </td>
                <td className="py-2.5 text-right font-semibold text-gray-900">
                  {t.dailySales !== null ? manwon(t.dailySales) : '-'}
                </td>
                <td className="py-2.5 text-right text-gray-500">
                  {t.dailyCustomers !== null ? `${Math.ceil(t.dailyCustomers)}명` : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
