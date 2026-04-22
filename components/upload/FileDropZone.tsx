'use client'

import { useRef } from 'react'

interface FileDropZoneProps {
  accept: string
  hint: string
  onFile: (file: File) => void
  loading?: boolean
}

export default function FileDropZone({ accept, hint, onFile, loading }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-200 rounded-xl px-8 py-12 flex flex-col items-center gap-3 cursor-pointer hover:border-[#1a5c3a] hover:bg-green-50/30 transition-colors"
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
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
    </div>
  )
}
