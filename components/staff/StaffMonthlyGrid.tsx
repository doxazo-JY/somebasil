import type { StaffMonthCell } from '@/lib/supabase/queries/staff'

// 직원 × 월 근무시간 · 지급액 표 (근무일지 기준, 연도 넘어가도 한 표로)

interface StaffMonthlyGridProps {
  staffList: { id: number; name: string; is_active: boolean }[]
  cells: StaffMonthCell[]
}

function manwon(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만`
}

export default function StaffMonthlyGrid({ staffList, cells }: StaffMonthlyGridProps) {
  const months = [...new Set(cells.map((c) => c.ym))].sort()
  const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1
  const label = (ym: string) => (multiYear ? `${ym.slice(2, 4)}.${Number(ym.slice(5))}` : `${Number(ym.slice(5))}월`)

  const byKey = new Map(cells.map((c) => [`${c.staff_id}|${c.ym}`, c]))
  const monthTotal = (ym: string) =>
    cells.filter((c) => c.ym === ym).reduce((s, c) => ({ hours: s.hours + c.hours, amount: s.amount + c.amount }), { hours: 0, amount: 0 })

  // 재직 중 먼저
  const rows = [...staffList].sort((a, b) => Number(b.is_active) - Number(a.is_active))

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">월별 근무시간 · 지급액</p>
        <p className="text-xs text-gray-400 mt-0.5">근무일지 업로드 기준 · 지급액 = 근무시간 × 시급 (주휴수당 제외)</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-400">
            <th className="text-left font-medium px-5 py-2.5 whitespace-nowrap">직원</th>
            {months.map((ym) => (
              <th key={ym} className="text-right font-medium px-3 py-2.5 whitespace-nowrap">
                {label(ym)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className={`px-5 py-2.5 whitespace-nowrap ${s.is_active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                {s.name}
              </td>
              {months.map((ym) => {
                const c = byKey.get(`${s.id}|${ym}`)
                return (
                  <td key={ym} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {c ? (
                      <>
                        <span className="text-gray-700">{manwon(c.amount)}</span>
                        <span className="block text-[10px] text-gray-400">{Math.round(c.hours)}h</span>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-gray-50">
            <td className="px-5 py-2.5 text-gray-500 font-medium">합계</td>
            {months.map((ym) => {
              const t = monthTotal(ym)
              return (
                <td key={ym} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  <span className="text-gray-900 font-semibold">{manwon(t.amount)}</span>
                  <span className="block text-[10px] text-gray-400">{Math.round(t.hours)}h</span>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
