'use client'

interface FileDropZoneProps {
  accept: string
  hint: string
  onFile: (file: File) => void
  loading?: boolean
}

// 확장자만 들어온 accept에 표준 MIME 타입을 자동 보강
// (안드로이드 파일관리자는 MIME 기반 필터라 .xlsx만 주면 회색 처리됨)
function augmentAccept(accept: string): string {
  const tokens = accept.split(',').map((s) => s.trim()).filter(Boolean)
  const hasXlsx = tokens.includes('.xlsx')
  const hasXls = tokens.includes('.xls')
  const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const xlsMime = 'application/vnd.ms-excel'
  if (hasXlsx && !tokens.includes(xlsxMime)) tokens.push(xlsxMime)
  if (hasXls && !tokens.includes(xlsMime)) tokens.push(xlsMime)
  return tokens.join(',')
}

export default function FileDropZone({ accept, hint, onFile, loading }: FileDropZoneProps) {
  const acceptWithMime = augmentAccept(accept)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (loading) return
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = ''
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed border-gray-200 rounded-xl px-8 py-12 flex flex-col items-center gap-3 transition-colors ${
        loading
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:border-[#1a5c3a] hover:bg-green-50/30'
      }`}
    >
      <input
        type="file"
        accept={acceptWithMime}
        className="hidden"
        onChange={handleChange}
        disabled={loading}
      />
      <span className="text-3xl">📄</span>
      {loading ? (
        <p className="text-sm text-gray-500">파싱 중...</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-600 text-center [word-break:keep-all]">
            파일을 드래그하거나 클릭해서 선택
          </p>
          <p className="text-xs text-gray-400 text-center [word-break:keep-all]">{hint}</p>
        </>
      )}
    </label>
  )
}
