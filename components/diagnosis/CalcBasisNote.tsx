import type { DiagnosisBaseline } from '@/lib/diagnosis-calc'

// 계산 근거 — 숫자를 믿어도 되는지 판단할 수 있게 가정을 그대로 노출

interface CalcBasisNoteProps {
  baseline: DiagnosisBaseline
}

function manwon(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만`
}

export default function CalcBasisNote({ baseline: b }: CalcBasisNoteProps) {
  const periodLabel = b.months.map((m) => `${String(m.year).slice(2)}.${m.month}`).join(' · ')

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-4 text-xs text-gray-500 space-y-1.5 [word-break:keep-all]">
      <p className="font-semibold text-gray-700 text-sm mb-1">계산 근거</p>
      <p>
        기준 기간: 최근 {b.months.length}개월 평균 ({periodLabel}) — 이번 달과 통장 미업로드 월은 제외
      </p>
      <p>
        변동비 = 재료비(현금+카드) 월 {manwon(b.variableCost)} · 고정비 = 인건비 {manwon(b.labor)} + 고정비{' '}
        {manwon(b.fixed)}
      </p>
      <p>
        설비투자(월평균 {manwon(b.equipment)})는 일회성이라 제외 · 사장 개인 지출(제외 카테고리)도 제외
      </p>
      <p>
        고객 수 = POS 주문(영수증) 건수. 여럿이 한 번에 결제하면 1명으로 잡혀 실제 방문객보다 적게 나옴
      </p>
      <p>매출 = POS 판매 금액 기준 · 영업일 = 월평균 {b.operatingDays.toFixed(1)}일</p>
    </div>
  )
}
