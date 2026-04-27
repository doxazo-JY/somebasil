import Link from 'next/link'

interface StatCardProps {
  label: string
  value: string
  subLabel?: string
  change?: number // 전월 대비 % (양수=증가, 음수=감소)
  yoyChange?: number // 작년 동월 대비 %
  highlight?: 'positive' | 'negative' | 'neutral'
  className?: string
  /** 카드 클릭 시 점프할 경로 (있으면 hover 효과 + Link 래핑) */
  href?: string
}

export default function StatCard({
  label,
  value,
  subLabel,
  change,
  yoyChange,
  highlight,
  className,
  href,
}: StatCardProps) {
  const valueColor =
    highlight === 'positive'
      ? 'text-[#1a5c3a]'
      : highlight === 'negative'
      ? 'text-red-500'
      : 'text-gray-900'

  const baseClass = `bg-white rounded-xl border border-gray-100 px-6 py-5 flex flex-col gap-2 ${className ?? ''}`
  const interactiveClass = href ? 'transition-shadow hover:shadow-sm hover:border-gray-200 cursor-pointer' : ''

  const inner = (
    <>
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {(change !== undefined || subLabel) && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {change !== undefined && (
            <span className={change >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {subLabel && <span>{subLabel}</span>}
        </div>
      )}
      {yoyChange !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className={yoyChange >= 0 ? 'text-[#1a5c3a]' : 'text-red-400'}>
            {yoyChange >= 0 ? '▲' : '▼'} {Math.abs(yoyChange).toFixed(1)}%
          </span>
          <span>작년比</span>
        </div>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`${baseClass} ${interactiveClass}`}>
        {inner}
      </Link>
    )
  }
  return <div className={baseClass}>{inner}</div>
}
