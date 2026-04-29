import StatCard from '@/components/ui/StatCard'

function formatManwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function profitMargin(profit: number, income: number) {
  if (income === 0) return '—'
  return `${((profit / income) * 100).toFixed(1)}%`
}

interface ProfitStatCardsProps {
  /** YTD 누적 값 */
  ytdIncome: number
  ytdExpense: number
  ytdProfit: number
  /** 데이터가 있는 월 수 (평균 계산용) */
  monthsWithData: number
  /** YTD 추정 자재비 (메뉴 원가 데이터 기반) — 0이면 카드 안 표시 */
  ytdMaterialCost?: number
}

export default function ProfitStatCards({
  ytdIncome,
  ytdExpense,
  ytdProfit,
  monthsWithData,
  ytdMaterialCost,
}: ProfitStatCardsProps) {
  const margin = profitMargin(ytdProfit, ytdIncome)
  const avgProfit = monthsWithData > 0 ? ytdProfit / monthsWithData : 0
  const hasData = ytdIncome > 0 || ytdExpense > 0
  const hasMaterial = (ytdMaterialCost ?? 0) > 0
  const grossMargin = hasMaterial ? ytdIncome - (ytdMaterialCost ?? 0) : 0
  const grossRatio =
    hasMaterial && ytdIncome > 0 ? grossMargin / ytdIncome : 0

  return (
    <>
      <StatCard
        label="YTD 누적 순이익"
        value={hasData ? formatManwon(ytdProfit) : '—'}
        subLabel={monthsWithData > 0 ? `월평균 ${formatManwon(avgProfit)}` : undefined}
        highlight={ytdProfit >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="YTD 이익률"
        value={margin}
        subLabel="순이익 / 매출"
        highlight={ytdProfit >= 0 ? 'positive' : 'negative'}
      />
      {hasMaterial ? (
        <>
          <StatCard
            label="YTD 그로스 마진"
            value={formatManwon(grossMargin)}
            subLabel={`마진율 ${(grossRatio * 100).toFixed(1)}% · 자재비 ${formatManwon(ytdMaterialCost ?? 0)}`}
            highlight="neutral"
          />
        </>
      ) : (
        <StatCard
          label="YTD 손익분기"
          value={ytdIncome >= ytdExpense ? '흑자' : '적자'}
          subLabel={`매출 ${formatManwon(ytdIncome)} · 지출 ${formatManwon(ytdExpense)}`}
          highlight={ytdIncome >= ytdExpense ? 'positive' : 'negative'}
          className="col-span-2 sm:col-span-1"
        />
      )}
    </>
  )
}
