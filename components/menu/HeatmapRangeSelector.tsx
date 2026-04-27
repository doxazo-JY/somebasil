import Link from 'next/link'

export type HeatmapRange = '4w' | '8w' | '12w' | 'month' | 'all'

export const RANGE_LABELS: Record<HeatmapRange, string> = {
  '4w': '최근 4주',
  '8w': '최근 8주',
  '12w': '최근 12주',
  month: '이번 달',
  all: '전체 (12개월)',
}

const RANGE_ORDER: HeatmapRange[] = ['all', '4w', '8w', '12w', 'month']

interface Props {
  current: HeatmapRange
}

export default function HeatmapRangeSelector({ current }: Props) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
      {RANGE_ORDER.map((r) => {
        const active = current === r
        return (
          <Link
            key={r}
            href={`?heatmap=${r}`}
            scroll={false}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap [word-break:keep-all] ${
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {RANGE_LABELS[r]}
          </Link>
        )
      })}
    </div>
  )
}
