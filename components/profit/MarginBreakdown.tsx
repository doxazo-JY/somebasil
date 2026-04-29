// 매출 → 자재비 → 그로스 마진 → 인건비/고정비/카드 → 순이익 흐름 시각화
// 사장 보고용 핵심 카드 — "이번 달 마진으로 얼마 벌었나" 한눈에

interface Props {
  income: number
  material: number       // 추정 자재비 (메뉴 원가 데이터 기반)
  totalExpense: number   // 모든 지출 (재료비/인건비/고정비/카드/설비/excluded 포함)
  okSalesRatio: number   // 자재비 추정 신뢰도 (등록 메뉴 매출 / 전체 매출)
}

function manwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

export default function MarginBreakdown({ income, material, totalExpense, okSalesRatio }: Props) {
  const grossMargin = income - material
  const otherExpense = totalExpense - material  // 자재비 외 지출 (인건비+고정비+카드+...)
  const netProfit = grossMargin - otherExpense
  const grossRatio = income > 0 ? grossMargin / income : 0

  const incomeBar = 100
  const materialBar = income > 0 ? (material / income) * 100 : 0
  const grossBar = income > 0 ? (grossMargin / income) * 100 : 0
  const otherBar = income > 0 ? Math.min((otherExpense / income) * 100, 100) : 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">마진 분해</p>
        <p className="text-[11px] text-gray-400 [word-break:keep-all]">
          매출에서 자재비 빼면 그로스 마진. 거기서 인건비·고정비 빼고 남는 게 순이익
        </p>
      </div>

      <div className="space-y-3">
        {/* 매출 */}
        <Row label="매출" value={income} percent={incomeBar} barClass="bg-[#1a5c3a]" />

        {/* 자재비 (마이너스) */}
        <Row
          label="└ 자재비 (메뉴 원가 추정)"
          value={-material}
          percent={materialBar}
          barClass="bg-amber-300"
          indent
        />

        {/* 그로스 마진 */}
        <Row
          label="그로스 마진"
          value={grossMargin}
          percent={grossBar}
          barClass="bg-[#7aa68a]"
          emphasis
        />

        {/* 그 외 지출 */}
        <Row
          label="└ 인건비·고정비·카드 등"
          value={-otherExpense}
          percent={otherBar}
          barClass="bg-gray-300"
          indent
        />

        {/* 순이익 */}
        <Row
          label="순이익"
          value={netProfit}
          percent={income > 0 ? Math.abs((netProfit / income) * 100) : 0}
          barClass={netProfit >= 0 ? 'bg-[#1a5c3a]' : 'bg-red-400'}
          emphasis
        />
      </div>

      <p className="text-[11px] text-gray-400 mt-4 [word-break:keep-all]">
        💡 자재비는 원가 등록된 메뉴들 매출({(okSalesRatio * 100).toFixed(1)}% 비중) 기준 추정.
        나머지 메뉴 단가도 등록되면 자재비가 더 정확해집니다. 그로스 마진율 {(grossRatio * 100).toFixed(1)}%.
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  percent,
  barClass,
  indent,
  emphasis,
}: {
  label: string
  value: number
  percent: number
  barClass: string
  indent?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={indent ? 'pl-4' : ''}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span
          className={`text-sm ${
            emphasis ? 'font-semibold text-gray-800' : 'text-gray-500'
          }`}
        >
          {label}
        </span>
        <span
          className={`text-sm tabular-nums ${
            emphasis ? 'font-semibold text-gray-800' : 'text-gray-500'
          }`}
        >
          {manwon(value)}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full ${barClass} rounded`}
          style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
        />
      </div>
    </div>
  )
}
