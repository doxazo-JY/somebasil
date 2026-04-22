interface StatCardProps {
  label: string
  value: string
  subLabel?: string
  change?: number // 전월 대비 % (양수=증가, 음수=감소)
  highlight?: 'positive' | 'negative' | 'neutral'
}

export default function StatCard({ label, value, subLabel, change, highlight }: StatCardProps) {
  const valueColor =
    highlight === 'positive'
      ? 'text-[#1a5c3a]'
      : highlight === 'negative'
      ? 'text-red-500'
      : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5 flex flex-col gap-2">
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
    </div>
  )
}
