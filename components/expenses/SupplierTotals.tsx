// 거래처별 재료비 누적 — 이번 달 + YTD
// 사장 단골 질문 "이번 달 원두값 얼마?"에 즉답 가능
// 데이터 소스: monthly_expenses.item(memo)에서 SUPPLIERS 이름 매칭

import type { SupplierRow } from '@/lib/supabase/queries/expenses'

interface Props {
  data: SupplierRow[]
  monthLabel: string // "4월"
  yearLabel: string // "2026년"
}

function fmt(v: number) {
  if (v >= 10000) return `${Math.round(v / 10000)}만`
  return v.toLocaleString()
}

export default function SupplierTotals({ data, monthLabel, yearLabel }: Props) {
  const totalMonthly = data.reduce((s, r) => s + r.monthly, 0)
  const totalYtd = data.reduce((s, r) => s + r.ytd, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">
          거래처별 재료비
        </p>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">
          정기 공급처 — 이번 달 / 누적
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          매칭된 거래처 없음
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((r) => {
            const ratio = totalYtd > 0 ? r.ytd / totalYtd : 0
            return (
              <li key={r.label} className="flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-gray-800">
                  {r.label}
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums shrink-0 w-14 text-right">
                  {monthLabel} <strong className="text-gray-700">{fmt(r.monthly)}</strong>
                </span>
                <div className="hidden sm:block w-20 h-1 bg-gray-100 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 tabular-nums shrink-0 w-16 text-right">
                  YTD <strong className="text-gray-700">{fmt(r.ytd)}</strong>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-baseline justify-between text-xs">
        <span className="text-gray-400">합계</span>
        <span className="text-gray-700 tabular-nums">
          {monthLabel} <strong>{fmt(totalMonthly)}</strong>
          <span className="text-gray-400 ml-3">{yearLabel} 누적 <strong className="text-gray-700">{fmt(totalYtd)}</strong></span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        ※ 적요(memo) 기반 매칭. 새 공급처는 코드에 추가 필요. 비정기 카드 구매(쿠팡·이마트 등)는 제외.
      </p>
    </div>
  )
}
