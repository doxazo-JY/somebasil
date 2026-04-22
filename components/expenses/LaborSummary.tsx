import Link from 'next/link'

interface LaborItem {
  id: string
  item: string   // 적요 (예: "리아급여", "점장급여")
  amount: number
}

interface LaborSummaryProps {
  data: LaborItem[]
}

export default function LaborSummary({ data }: LaborSummaryProps) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">인건비 요약</p>
          <p className="text-xs text-gray-400 mt-0.5">
            이번달 총{' '}
            <span className="font-medium text-gray-700">
              {Math.round(total / 10000)}만원
            </span>
          </p>
        </div>
        <Link href="/staff" className="text-xs text-[#1a5c3a] hover:underline font-medium">
          직원 관리 →
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">
          인건비 데이터가 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {data.map((item) => (
            <li key={item.id} className="flex items-center px-6 py-3">
              <span className="text-sm text-gray-700 flex-1">{item.item}</span>
              <span className="text-sm font-medium text-gray-700">
                {item.amount.toLocaleString()}원
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
