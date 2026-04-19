const FILE_TYPE_LABEL: Record<string, string> = {
  daily_sales: '일별 매출',
  bank_transaction: '통장 거래내역',
}

interface HistoryItem {
  id: string
  file_name: string
  file_type: string
  status: string
  uploaded_at: string
}

interface UploadHistoryProps {
  data: HistoryItem[]
}

export default function UploadHistory({ data }: UploadHistoryProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
        업로드 내역이 없습니다.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">업로드 히스토리</p>
      </div>
      <ul className="divide-y divide-gray-50">
        {data.map((item) => (
          <li key={item.id} className="flex items-center px-6 py-3 gap-4 text-xs">
            <span className="text-gray-400 w-36 shrink-0">
              {new Date(item.uploaded_at).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span className="flex-1 text-gray-700 truncate">{item.file_name}</span>
            <span className="text-gray-400">{FILE_TYPE_LABEL[item.file_type] ?? item.file_type}</span>
            <span className={item.status === 'success' ? 'text-[#1a5c3a]' : 'text-red-400'}>
              {item.status === 'success' ? '✓ 완료' : '✕ 실패'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
