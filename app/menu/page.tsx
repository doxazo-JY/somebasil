import PageTabs from '@/components/ui/PageTabs'
import WeekdayHourHeatmap from '@/components/menu/WeekdayHourHeatmap'
import HeatmapRangeSelector, {
  RANGE_LABELS,
  type HeatmapRange,
} from '@/components/menu/HeatmapRangeSelector'
import DeadMenuList from '@/components/menu/DeadMenuList'
import {
  getWeekdayHourHeatmap,
  getDeadMenus,
} from '@/lib/supabase/queries/menu'

// 배포 환경에서 캐시 회피 — 매 요청마다 최신 데이터 로드
export const dynamic = 'force-dynamic'

// KST 기준 오늘 → UTC 자정 Date
function getKSTTodayUTC(): Date {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
}

function toDateStr(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 히트맵 range → sinceDate 변환 (KST 기준)
function heatmapSinceDate(range: HeatmapRange): string {
  const today = getKSTTodayUTC()
  if (range === '4w') {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - 28)
    return toDateStr(d)
  }
  if (range === '8w') {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - 56)
    return toDateStr(d)
  }
  if (range === '12w') {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - 84)
    return toDateStr(d)
  }
  if (range === 'month') {
    return toDateStr(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
    )
  }
  // all (12개월)
  const d = new Date(today)
  d.setUTCMonth(d.getUTCMonth() - 12)
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
    : 'all'

  const heatmapSinceStr = heatmapSinceDate(heatmapRange)

  // 죽은 메뉴도 같은 기간 적용 — selector 한 번 바꾸면 둘 다 갱신
  const [heatmap, dead] = await Promise.all([
    getWeekdayHourHeatmap(heatmapSinceStr),
    getDeadMenus(heatmapSinceStr, { limit: 30 }),
  ])

  const rangeLabel = RANGE_LABELS[heatmapRange]

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="settlement" />
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">메뉴 분석</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          요일·시간 패턴 / 죽은 메뉴 — 메뉴판 정리·발주·스케줄 의사결정용
        </p>
      </div>

      {/* 히트맵 + 죽은 메뉴 (2열) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <HeatmapRangeSelector current={heatmapRange} />
          <WeekdayHourHeatmap
            cells={heatmap}
            startHour={9}
            endHour={22}
            rangeLabel={rangeLabel}
          />
        </div>
        <DeadMenuList menus={dead} periodLabel={rangeLabel} />
      </div>
    </div>
  )
}
