// 적자 원인 신호 카드 — 전월/평월 대비 변화율 신호등
// 절대 임계 (예: 인건비 35%) 대신 "유의미한 변화"만 색칠 — 운영 데이터 충분히 쌓인 후 절대 임계 도입 예정
// 카드 클릭 → 해당 도메인 상세 페이지로 점프 (적자 원인 발견 → 즉시 깊이 파기)

import Link from 'next/link'

interface DeficitSignalsProps {
  income: number
  laborCurr: number
  ingredientsCurr: number
  fixedCurr: number
  prevIncome: number
  laborPrev: number
  ingredientsPrev: number
  fixedPrev: number
}

interface SignalRow {
  label: string
  ratio: number // 매출 대비 비율 (현재 월)
  delta: number | null // 전월 대비 변화 %p (포인트, 비율 기준)
  amount: number
  pending?: boolean // 계산 방식 미정 — 메뉴 원가 룰 도입 후 활성
  href?: string // 클릭 점프 대상
}

const ALERT_THRESHOLD = 3 // 비율 +3%p 이상 변화 = 경고
const WARN_THRESHOLD = 1.5 // 비율 +1.5%p 이상 변화 = 주의

function fmt(v: number) {
  return `${Math.round(v / 10000)}만`
}

export default function DeficitSignals({
  income,
  laborCurr,
  ingredientsCurr,
  fixedCurr,
  prevIncome,
  laborPrev,
  ingredientsPrev,
  fixedPrev,
}: DeficitSignalsProps) {
  const safe = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)

  const rows: SignalRow[] = [
    {
      label: '인건비율',
      amount: laborCurr,
      ratio: safe(laborCurr, income),
      delta:
        prevIncome > 0 && income > 0
          ? safe(laborCurr, income) - safe(laborPrev, prevIncome)
          : null,
      href: '/staff',
    },
    {
      label: '재료비율',
      amount: ingredientsCurr,
      ratio: safe(ingredientsCurr, income),
      delta:
        prevIncome > 0 && income > 0
          ? safe(ingredientsCurr, income) - safe(ingredientsPrev, prevIncome)
          : null,
      href: '/expenses',
    },
    {
      // 메뉴별 원가 룰(/recipes 등록률 80%+) 도입 후 활성
      label: '원가율',
      amount: 0,
      ratio: 0,
      delta: null,
      pending: true,
    },
    {
      label: '고정비율',
      amount: fixedCurr,
      ratio: safe(fixedCurr, income),
      delta:
        prevIncome > 0 && income > 0
          ? safe(fixedCurr, income) - safe(fixedPrev, prevIncome)
          : null,
      href: '/expenses',
    },
  ]

  // worst 강조는 헤더 InsightBanner로 끌어올렸음 — 카드 안에선 색깔로만 표시

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">
          적자 원인 신호
          <span className="text-xs text-gray-400 font-normal ml-2">
            % = 카테고리 ÷ 이번달 매출 ({fmt(income)})
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map((r) => {
          if (r.pending) {
            return (
              <div
                key={r.label}
                className="rounded-lg border border-gray-100 border-dashed px-3 py-3 bg-gray-50"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <p className="text-[11px] text-gray-500 font-medium">{r.label}</p>
                </div>
                <p className="text-lg font-bold text-gray-300">—</p>
                <p className="text-[11px] text-gray-400 mt-0.5">계산 방식 도입 후</p>
              </div>
            )
          }
          const d = r.delta
          const color =
            d === null
              ? { bg: 'bg-gray-50', text: 'text-gray-400', dot: 'bg-gray-300' }
              : d >= ALERT_THRESHOLD
                ? { bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' }
                : d >= WARN_THRESHOLD
                  ? { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' }
                  : d <= -WARN_THRESHOLD
                    ? { bg: 'bg-green-50', text: 'text-[#1a5c3a]', dot: 'bg-[#1a5c3a]' }
                    : { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-300' }

          const inner = (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                <p className="text-[11px] text-gray-500 font-medium">{r.label}</p>
              </div>
              <p className={`text-lg font-bold ${color.text}`}>
                {r.ratio.toFixed(1)}%
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                {fmt(r.amount)}
                {d !== null && (
                  <span className={`ml-1.5 ${color.text}`}>
                    {d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(1)}%p
                  </span>
                )}
              </p>
            </>
          )
          const className = `rounded-lg border border-gray-100 px-3 py-3 ${color.bg} block transition-shadow hover:shadow-sm`
          return r.href ? (
            <Link key={r.label} href={r.href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={r.label} className={className}>{inner}</div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        ※ ±1.5%p 이상 변화 시 색칠. 원가율은 메뉴별 원가 룰 도입 후 활성화 예정.
      </p>
    </div>
  )
}
