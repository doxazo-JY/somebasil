import WeekdayHourHeatmap from '@/components/menu/WeekdayHourHeatmap'
import HeatmapRangeSelector, {
  RANGE_LABELS,
  type HeatmapRange,
} from '@/components/menu/HeatmapRangeSelector'
import CategoryMixChart from '@/components/menu/CategoryMixChart'
import HotIceChart from '@/components/menu/HotIceChart'
import DeadMenuList from '@/components/menu/DeadMenuList'
import {
  getWeekdayHourHeatmap,
  getMonthlyCategoryMix,
  getMonthlyHotIceRatio,
  getDeadMenus,
} from '@/lib/supabase/queries/menu'

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 히트맵 range → sinceDate 변환
function heatmapSinceDate(range: HeatmapRange): string {
  const today = new Date()
  if (range === '4w') {
    const d = new Date(today)
    d.setDate(d.getDate() - 28)
    return toDateStr(d)
  }
  if (range === '8w') {
    const d = new Date(today)
    d.setDate(d.getDate() - 56)
    return toDateStr(d)
  }
  if (range === '12w') {
    const d = new Date(today)
    d.setDate(d.getDate() - 84)
    return toDateStr(d)
  }
  if (range === 'month') {
    return toDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
  }
  // all
  const d = new Date(today)
  d.setMonth(d.getMonth() - 12)
  return toDateStr(d)
}

interface PageProps {
  searchParams: Promise<{ heatmap?: string }>
}

const VALID_RANGES: HeatmapRange[] = ['4w', '8w', '12w', 'month', 'all']

export default async function MenuAnalysisPage({ searchParams }: PageProps) {
  const params = await searchParams
  const heatmapRange: HeatmapRange = VALID_RANGES.includes(params.heatmap as HeatmapRange)
    ? (params.heatmap as HeatmapRange)
    : '4w'

  const today = new Date()
  const since12m = new Date(today)
  since12m.setMonth(since12m.getMonth() - 12)
  const since2m = new Date(today)
  since2m.setMonth(since2m.getMonth() - 2)

  const since12mStr = toDateStr(since12m)
  const since2mStr = toDateStr(since2m)
  const heatmapSinceStr = heatmapSinceDate(heatmapRange)

  const [heatmap, mix, hotIce, dead] = await Promise.all([
    getWeekdayHourHeatmap(heatmapSinceStr),
    getMonthlyCategoryMix(since12mStr),
    getMonthlyHotIceRatio(since12mStr),
    getDeadMenus(since2mStr, { qtyThreshold: 10, limit: 30 }),
  ])

  // 히트맵 기간 표시 (사용자에게 "어떤 범위인지" 명확히)
  const rangeLabel = RANGE_LABELS[heatmapRange]

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">메뉴 분석</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          요일·시간 패턴, 제품 믹스, 죽은 메뉴 — 주간 보고 / 월간 의사결정용
        </p>
      </div>

      {/* 히트맵 + 죽은 메뉴 (2열) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-3">
          <HeatmapRangeSelector current={heatmapRange} />
          <WeekdayHourHeatmap
            cells={heatmap}
            startHour={9}
            endHour={22}
            rangeLabel={rangeLabel}
          />
        </div>
        <DeadMenuList menus={dead} periodLabel="최근 2개월" />
      </div>

      {/* 제품 믹스 + HOT/ICE (2열) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryMixChart data={mix.data} categories={mix.categories} mode="percent" />
        <HotIceChart data={hotIce} />
      </div>
    </div>
  )
}
