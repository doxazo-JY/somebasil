// 비용 비율 카드 — 매출 대비 각 항목 비율 + 경고 신호

interface CostRatioCardsProps {
  income: number
  labor: number
  ingredients: number
  fixed: number
  card: number
}

interface RatioItem {
  label: string
  amount: number
  ratio: number
  // 임계값: warning / danger
  warnAt: number
  dangerAt: number
  note?: string
}

function getRatioColor(ratio: number, warnAt: number, dangerAt: number) {
  if (ratio >= dangerAt) return { dot: 'bg-red-400', text: 'text-red-500', bg: 'bg-red-50' }
  if (ratio >= warnAt) return { dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' }
  return { dot: 'bg-[#1a5c3a]', text: 'text-[#1a5c3a]', bg: 'bg-green-50' }
}

function fmt(v: number) {
  return `${Math.round(v / 10000)}만`
}

export default function CostRatioCards({ income, labor, ingredients, fixed, card }: CostRatioCardsProps) {
  if (income === 0) return null

  const items: RatioItem[] = [
    {
      label: '인건비율',
      amount: labor,
      ratio: (labor / income) * 100,
      warnAt: 35,
      dangerAt: 45,
      note: '업종 평균 25~30%',
    },
    {
      label: '원가율',
      amount: ingredients,
      ratio: (ingredients / income) * 100,
      warnAt: 30,
      dangerAt: 40,
      note: '하이엔드 기준 30~35%',
    },
    {
      label: '고정비율',
      amount: fixed,
      ratio: (fixed / income) * 100,
      warnAt: 20,
      dangerAt: 30,
      note: '업종 평균 15~20%',
    },
    {
      label: '카드대금',
      amount: card,
      ratio: (card / income) * 100,
      warnAt: 15,
      dangerAt: 25,
      note: '기타 지출',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const color = getRatioColor(item.ratio, item.warnAt, item.dangerAt)
        const label =
          item.ratio >= item.dangerAt ? '높음' :
          item.ratio >= item.warnAt ? '주의' : '정상'

        return (
          <div key={item.label} className={`rounded-xl border border-gray-100 px-4 py-4 ${color.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{item.label}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color.text} bg-white/80`}>
                {label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${color.text}`}>
              {item.ratio.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">{fmt(item.amount)}</p>
            {item.note && (
              <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
