import StatCard from '@/components/ui/StatCard'
import type { DiagnosisBaseline, DiagnosisResult } from '@/lib/diagnosis-calc'

// 손익분기 핵심 숫자 4개 — "흑자가 되려면 하루 몇 명, 얼마"

interface BreakEvenCardsProps {
  baseline: DiagnosisBaseline
  result: DiagnosisResult
}

function manwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs.toLocaleString()}만`
}

function won(v: number) {
  return `${Math.round(v).toLocaleString()}원`
}

export default function BreakEvenCards({ baseline, result: r }: BreakEvenCardsProps) {
  // 변동비율 100% 이상 → 팔수록 손해. 손익분기 자체가 없음
  if (r.breakEvenSales === null) {
    return (
      <div className="bg-red-50/40 border border-red-100 rounded-xl px-6 py-5 mb-4 text-sm text-red-600 [word-break:keep-all]">
        재료비가 매출의 {(r.variableRatio * 100).toFixed(0)}%라 팔수록 손해인 구조입니다.
        매출을 늘려도 흑자가 나지 않으므로 원가부터 점검이 필요합니다.
      </div>
    )
  }

  const reached = baseline.sales >= r.breakEvenSales
  const gapPct = ((r.breakEvenSales - baseline.sales) / baseline.sales) * 100

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <StatCard
        label="손익분기 월매출"
        value={manwon(r.breakEvenSales)}
        subLabel={
          reached
            ? `현재 ${manwon(baseline.sales)} · 넘음`
            : `현재 ${manwon(baseline.sales)} · ${gapPct.toFixed(0)}% 부족`
        }
        highlight={reached ? 'positive' : 'negative'}
      />
      <StatCard
        label="하루 매출 목표"
        value={manwon(r.breakEvenDailySales ?? 0)}
        subLabel={`현재 하루 ${manwon(r.dailySales)}`}
      />
      <StatCard
        label="하루 필요 고객"
        value={r.breakEvenDailyCustomers !== null ? `${Math.ceil(r.breakEvenDailyCustomers)}명` : '-'}
        subLabel={`현재 ${Math.round(r.dailyCustomers)}명 · 객단가 ${won(r.aov)}`}
      />
      <StatCard
        label="월 고정비 · 변동비율"
        value={manwon(r.fixedCost)}
        subLabel={`재료비 ${(r.variableRatio * 100).toFixed(1)}%`}
      />
    </div>
  )
}
