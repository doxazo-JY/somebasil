import type { IngredientRecovery } from '@/lib/supabase/queries/recipe-costs'

// 재료 회수율 — 현금 4종 매입 거래 기반
// "원두 4/15 매입 10봉(35만) → 14일 경과 / 사용 67% / 마진 56만 (160% 회수 ✓)"

function fmtMoney(v: number) {
  return `${Math.round(v / 10000)}만`
}

function fmtQty(v: number, unit: string): string {
  if (v >= 1000) return `${Math.round(v).toLocaleString()}${unit}`
  if (v >= 100) return `${Math.round(v)}${unit}`
  return `${v.toFixed(1)}${unit}`
}

function fmtDate(s: string): string {
  // "2026-04-15" → "4/15"
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!m) return s
  return `${parseInt(m[1])}/${parseInt(m[2])}`
}

export default function IngredientRecoveryTable({
  rows,
}: {
  rows: IngredientRecovery[]
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <p className="text-sm text-gray-400">
          현금 4종(원두·우유·말차·햄)의 단가 등록 + 매입 거래가 있어야 회수율이 표시됩니다.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">재료 회수율 (현금 4종)</p>
        <p className="text-[11px] text-gray-400 mt-0.5 [word-break:keep-all]">
          마지막 매입 거래 → 그 이후 ok 메뉴 마진 누적 vs 매입가 회수율. 카드 결제 재료는 시점 추적 불가
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium px-4 py-2.5">재료</th>
              <th className="text-right font-medium px-2 py-2.5">마지막 매입</th>
              <th className="text-right font-medium px-2 py-2.5">매입량</th>
              <th className="text-right font-medium px-2 py-2.5">경과</th>
              <th className="text-right font-medium px-2 py-2.5">진행률</th>
              <th className="text-right font-medium px-2 py-2.5">누적 마진</th>
              <th className="text-right font-medium px-4 py-2.5">회수율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RecoveryRow key={r.ingredientId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecoveryRow({ row: r }: { row: IngredientRecovery }) {
  const ratioColor =
    r.recoveryRatio == null
      ? 'text-gray-400'
      : r.recoveryRatio >= 1
        ? 'text-[#1a5c3a]'
        : r.recoveryRatio >= 0.5
          ? 'text-amber-600'
          : 'text-red-500'

  const progressColor =
    r.progressRatio >= 0.9
      ? 'bg-red-300'
      : r.progressRatio >= 0.6
        ? 'bg-amber-300'
        : 'bg-[#7aa68a]'

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-2.5">
        <div className="text-gray-800">{r.ingredientName}</div>
        <div className="text-[11px] text-gray-400">
          {r.counterpart} · {r.menuCount}개 메뉴
        </div>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {r.lastPurchaseDate ? fmtDate(r.lastPurchaseDate) : '-'}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {r.lastPurchaseAmount > 0 ? (
          <>
            {fmtMoney(r.lastPurchaseAmount)}
            <div className="text-[11px] text-gray-400">
              ≈ {fmtQty(r.estimatedQuantityBought, r.unit)}
            </div>
          </>
        ) : '-'}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {r.lastPurchaseDate ? `${r.daysElapsed}일` : '-'}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums">
        <div className="flex items-center justify-end gap-2">
          <span className="text-gray-700">
            {r.progressRatio > 0 ? `${(r.progressRatio * 100).toFixed(0)}%` : '-'}
          </span>
          {r.progressRatio > 0 && (
            <div className="w-12 h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${progressColor}`}
                style={{ width: `${Math.min(r.progressRatio * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
        {r.estimatedUsedQty > 0 && (
          <div className="text-[11px] text-gray-400">
            {fmtQty(r.estimatedUsedQty, r.unit)}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">
        {r.cumulativeMargin > 0 ? fmtMoney(r.cumulativeMargin) : '-'}
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${ratioColor}`}>
        {r.recoveryRatio != null
          ? `${(r.recoveryRatio * 100).toFixed(0)}%`
          : '-'}
      </td>
    </tr>
  )
}
