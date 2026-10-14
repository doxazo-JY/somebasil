import type { MonthlyCell } from '@/lib/supabase/queries/attendance-admin'

// 전체 근무일지 — 직원 × 월 근무시간 · 지급액 (종이 근무일지 + QR, 기준 기록으로 합침 · 연도 넘어가도 한 표)
// 지급액 = 근무시간 × 시급 (고정급·주휴수당 같은 수기 항목은 빠짐 → 근무일지 엑셀에는 포함). 기본 접힘

function manwon(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만`
}

export default function StaffMonthlyGrid({ staffList, cells }: { staffList: { id: number; name: string; is_active: boolean }[]; cells: MonthlyCell[] }) {
  const months = [...new Set(cells.map((c) => c.ym))].sort()
  const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1
  const label = (ym: string) => (multiYear ? `${ym.slice(2, 4)}.${Number(ym.slice(5))}` : `${Number(ym.slice(5))}월`)

  const byKey = new Map(cells.map((c) => [`${c.staff_id}|${c.ym}`, c]))
  const monthTotal = (ym: string) =>
    cells.filter((c) => c.ym === ym).reduce((s, c) => ({ minutes: s.minutes + c.minutes, pay: s.pay + c.pay }), { minutes: 0, pay: 0 })

  // 재직 중 먼저
  const rows = [...staffList].sort((a, b) => Number(b.is_active) - Number(a.is_active))

  return (
    <details className="bg-white rounded-xl border border-gray-100 group">
      <summary className="px-5 py-4 cursor-pointer select-none list-none flex items-baseline justify-between gap-3">
        <span>
          <span className="text-sm font-semibold text-gray-800">
            <span className="text-gray-400 mr-1.5 group-open:hidden">▸</span>
            <span className="text-gray-400 mr-1.5 hidden group-open:inline">▾</span>
            전체 근무일지
          </span>
          <span className="block text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
            {months.length > 0 ? `${label(months[0])} ~ ${label(months[months.length - 1])}` : '기록 없음'} · 종이 근무일지와 QR을 기준 기록으로 합친 월별 근무시간 · 지급액 (고정급·주휴 제외)
          </span>
        </span>
      </summary>
      {months.length > 0 && (
        <div className="overflow-x-auto border-t border-gray-100">
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
                  <td className={`px-5 py-2.5 whitespace-nowrap ${s.is_active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{s.name}</td>
                  {months.map((ym) => {
                    const c = byKey.get(`${s.id}|${ym}`)
                    return (
                      <td key={ym} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {c ? (
                          <>
                            <span className="text-gray-700">{manwon(c.pay)}</span>
                            <span className="block text-[10px] text-gray-400">{Math.round(c.minutes / 60)}h</span>
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
                      <span className="text-gray-900 font-semibold">{manwon(t.pay)}</span>
                      <span className="block text-[10px] text-gray-400">{Math.round(t.minutes / 60)}h</span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
