import type { DiagnosisBaseline, DiagnosisResult } from '@/lib/diagnosis-calc'

// "하나만 바꾼다면" — 나머지는 그대로 두고 한 가지만 움직여서 손익분기를 맞추려면

interface LeverTableProps {
  baseline: DiagnosisBaseline
  result: DiagnosisResult
}

function manwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs.toLocaleString()}만`
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function change(from: number, to: number) {
  if (from === 0) return ''
  const p = ((to - from) / from) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`
}

interface Row {
  lever: string
  current: string
  required: string
  delta: string
  impossible?: boolean
}

export default function LeverTable({ baseline: b, result: r }: LeverTableProps) {
  if (r.breakEvenSales === null) return null

  // 이미 흑자면 안전마진만 안내
  if (b.sales >= r.breakEvenSales) {
    const safety = (b.sales - r.breakEvenSales) / b.sales
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">안전 여유</p>
        <p className="text-sm text-gray-500 [word-break:keep-all]">
          매출이 <strong className="text-[#1a5c3a]">{pct(safety)}</strong> 줄어도 손익분기를 지킵니다
          (월 {manwon(b.sales - r.breakEvenSales)} 여유).
        </p>
      </div>
    )
  }

  const customersPerDay = b.orderCount / b.operatingDays
  const requiredCustomers = r.breakEvenDailyCustomers ?? 0
  const varImpossible = r.requiredVariableRatio === null || r.requiredVariableRatio <= 0

  const rows: Row[] = [
    {
      lever: '하루 고객 수',
      current: `${Math.round(customersPerDay)}명`,
      required: `${Math.ceil(requiredCustomers)}명`,
      delta: change(customersPerDay, requiredCustomers),
    },
    {
      lever: '객단가',
      current: `${Math.round(r.aov).toLocaleString()}원`,
      required: `${Math.round(r.requiredAov ?? 0).toLocaleString()}원`,
      delta: change(r.aov, r.requiredAov ?? 0),
    },
    {
      lever: '재료비율',
      current: pct(r.variableRatio),
      required: varImpossible ? '불가' : pct(r.requiredVariableRatio ?? 0),
      delta: varImpossible
        ? '재료비 0이어도 적자'
        : `${((r.requiredVariableRatio! - r.variableRatio) * 100).toFixed(1)}%p`,
      impossible: varImpossible,
    },
    {
      lever: '월 고정비 (인건비+고정비)',
      current: manwon(r.fixedCost),
      required: manwon(r.requiredFixedCost),
      delta: `${manwon(r.requiredFixedCost - r.fixedCost)}`,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700">흑자가 되려면 — 하나만 바꾼다면</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-4 [word-break:keep-all]">
        나머지는 지금 그대로 두고 이 항목 하나만 움직였을 때 손익분기선
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left font-medium pb-2">항목</th>
            <th className="text-right font-medium pb-2">현재</th>
            <th className="text-right font-medium pb-2">필요</th>
            <th className="text-right font-medium pb-2">변화</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.lever} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 text-gray-600">{row.lever}</td>
              <td className="py-2.5 text-right text-gray-500">{row.current}</td>
              <td className="py-2.5 text-right font-semibold text-gray-900">{row.required}</td>
              <td className={`py-2.5 text-right text-xs ${row.impossible ? 'text-red-500' : 'text-gray-400'}`}>
                {row.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
