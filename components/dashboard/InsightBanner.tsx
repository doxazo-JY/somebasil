// 대시보드 첫 화면 인사이트 한 줄
// - 부분월 컨텍스트 (며칠 데이터인지 / 월말까지 며칠 남았는지)
// - 이번 달 손익분기 갭 (흑자/적자 핵심 메시지)
// - 가장 악화된 신호 (DeficitSignals 로직 차용 — 헤더로 끌어올림)
// 헤더 ↔ KPI 사이에 박혀서 점장이 제일 먼저 읽는 한 줄

import Link from 'next/link'

interface InsightBannerProps {
  year: number
  month: number
  income: number
  expense: number
  profit: number
  prevIncome: number
  laborCurr: number
  laborPrev: number
  ingredientsCurr: number
  ingredientsPrev: number
  fixedCurr: number
  fixedPrev: number
  /** 어제 매출 (KST) */
  yesterdayIncome?: number
  /** 어제와 같은 요일 1주 전 매출 (전주同曜비 계산용) */
  prevWeekSameDayIncome?: number
}

const ALERT_THRESHOLD = 3
const WARN_THRESHOLD = 1.5

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

// KST 기준 오늘 날짜
function getKSTDate(): { year: number; month: number; day: number } {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  }
}

// 월말 일수
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export default function InsightBanner({
  year,
  month,
  income,
  expense,
  profit,
  prevIncome,
  laborCurr,
  laborPrev,
  ingredientsCurr,
  ingredientsPrev,
  fixedCurr,
  fixedPrev,
  yesterdayIncome,
  prevWeekSameDayIncome,
}: InsightBannerProps) {
  const today = getKSTDate()
  const isPartial = today.year === year && today.month === month
  const totalDays = daysInMonth(year, month)
  const daysRemaining = isPartial ? totalDays - today.day : 0

  // worst signal — DeficitSignals와 동일 로직 (인건비/재료비/고정비, 원가율 pending)
  const safe = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
  const signals = [
    {
      label: '인건비율',
      delta:
        prevIncome > 0 && income > 0
          ? safe(laborCurr, income) - safe(laborPrev, prevIncome)
          : null,
      href: '/staff',
    },
    {
      label: '재료비율',
      delta:
        prevIncome > 0 && income > 0
          ? safe(ingredientsCurr, income) - safe(ingredientsPrev, prevIncome)
          : null,
      href: '/expenses',
    },
    {
      label: '고정비율',
      delta:
        prevIncome > 0 && income > 0
          ? safe(fixedCurr, income) - safe(fixedPrev, prevIncome)
          : null,
      href: '/expenses',
    },
  ]
  const worst = signals
    .filter((s) => s.delta !== null && s.delta! > WARN_THRESHOLD)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]

  const isProfit = profit >= 0
  const gap = Math.abs(profit)
  const hasFinancials = income > 0 || expense > 0

  // 어제 매출 + 전주同曜比 (현재 월 보고 있을 때만 의미)
  const showYesterday =
    isPartial && yesterdayIncome !== undefined && yesterdayIncome > 0
  const yesterdayDelta =
    showYesterday && prevWeekSameDayIncome && prevWeekSameDayIncome > 0
      ? ((yesterdayIncome - prevWeekSameDayIncome) / prevWeekSameDayIncome) * 100
      : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 text-sm">
      {/* 부분월 컨텍스트 */}
      <span className="text-gray-500 [word-break:keep-all]">
        {isPartial ? (
          <>
            <span className="text-gray-700 font-medium">
              {month}월 {today.day}일까지
            </span>
            <span className="text-gray-400 ml-1.5">· 월말까지 {daysRemaining}일</span>
          </>
        ) : (
          <span className="text-gray-700 font-medium">
            {month}월 전체 ({totalDays}일)
          </span>
        )}
      </span>

      {/* 손익분기 갭 */}
      {hasFinancials && (
        <>
          <span className="hidden sm:inline text-gray-200" aria-hidden>
            |
          </span>
          {isProfit ? (
            <span className="text-[#1a5c3a] font-medium [word-break:keep-all]">
              ✓ 손익분기 <strong>+{fmt(profit)}</strong> 초과
            </span>
          ) : (
            <span className="text-red-500 font-medium [word-break:keep-all]">
              ⚠ 손익분기까지 <strong>{fmt(gap)}</strong> 부족
            </span>
          )}
        </>
      )}

      {/* 어제 매출 + 전주同曜比 — 점장 매일 첫 질문 "어제 매출 어땠나" */}
      {showYesterday && (
        <>
          <span className="hidden sm:inline text-gray-200" aria-hidden>
            |
          </span>
          <span className="text-gray-500 [word-break:keep-all]">
            어제{' '}
            <span className="text-gray-700 font-medium">{fmt(yesterdayIncome!)}</span>
            {yesterdayDelta !== null && (
              <span
                className={`ml-1.5 ${
                  yesterdayDelta >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'
                }`}
              >
                {yesterdayDelta >= 0 ? '▲' : '▼'}
                {Math.abs(yesterdayDelta).toFixed(1)}%
              </span>
            )}
            <span className="text-gray-400 text-[11px] ml-1">전주同曜比</span>
          </span>
        </>
      )}

      {/* 가장 악화된 신호 */}
      {worst && (
        <>
          <span className="hidden sm:inline text-gray-200" aria-hidden>
            |
          </span>
          {worst.href ? (
            <Link
              href={worst.href}
              className={`font-medium [word-break:keep-all] hover:underline ${
                worst.delta! >= ALERT_THRESHOLD ? 'text-red-500' : 'text-amber-600'
              }`}
            >
              {worst.label} ▲{worst.delta!.toFixed(1)}%p →
            </Link>
          ) : (
            <span
              className={`font-medium [word-break:keep-all] ${
                worst.delta! >= ALERT_THRESHOLD ? 'text-red-500' : 'text-amber-600'
              }`}
            >
              {worst.label} ▲{worst.delta!.toFixed(1)}%p
            </span>
          )}
        </>
      )}
    </div>
  )
}
