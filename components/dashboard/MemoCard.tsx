'use client'

import { useState } from 'react'

interface MemoCardProps {
  initialContent: string
  year: number
  month: number
}

export default function MemoCard({ initialContent, year, month }: MemoCardProps) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/memo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, content }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">이번 달 메모</p>
      <textarea
        className="w-full h-24 text-sm text-gray-700 resize-none border border-gray-100 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] placeholder:text-gray-300"
        placeholder="이번 달 특이사항이나 메모를 남겨보세요."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors"
        >
          {saved ? '저장됨' : saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
