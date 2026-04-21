'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORY_OPTIONS = [
  { value: 'ingredients', label: '재료비' },
  { value: 'labor', label: '인건비' },
  { value: 'fixed', label: '고정비' },
  { value: 'equipment', label: '설비투자' },
  { value: 'card', label: '카드대금' },
  { value: 'excluded', label: '제외' },
]

const CATEGORY_LABEL: Record<string, string> = {
  ingredients: '재료비',
  labor: '인건비',
  fixed: '고정비',
  equipment: '설비투자',
  card: '카드대금',
  excluded: '제외',
}

interface ExpenseRow {
  id: string
  category: string
  item: string
  amount: number
}

interface DataEditorProps {
  data: ExpenseRow[]
  year: number
  month: number
}

export default function DataEditor({ data, year, month }: DataEditorProps) {
  const router = useRouter()
  const [rows, setRows] = useState<ExpenseRow[]>(data)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  function startEdit(id: string) {
    setEditingId(id)
  }

  function cancelEdit() {
    setEditingId(null)
    setRows(data) // 원래 데이터로 복원
  }

  function updateRow(id: string, field: keyof ExpenseRow, value: string | number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return

    setSaving(id)
    await fetch('/api/upload/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, item: row.item, category: row.category, amount: row.amount }),
    })
    setSaving(null)
    setEditingId(null)
    router.refresh()
  }

  async function deleteRow(id: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    setSaving(id)
    await fetch('/api/upload/edit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRows((prev) => prev.filter((r) => r.id !== id))
    setSaving(null)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">
          {year}년 {month}월 지출 데이터
          <span className="ml-2 text-gray-400 font-normal">({rows.length}건)</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">데이터가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-gray-400 font-medium w-28">카테고리</th>
                <th className="text-left px-4 py-2.5 text-gray-400 font-medium w-64">항목</th>
                <th className="text-right px-4 py-2.5 text-gray-400 font-medium w-36">금액</th>
                <th className="px-4 py-2.5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const isEditing = editingId === row.id
                const isSaving = saving === row.id

                return (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <select
                          value={row.category}
                          onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                        >
                          {CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-500">{CATEGORY_LABEL[row.category] ?? row.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          value={row.item}
                          onChange={(e) => updateRow(row.id, 'item', e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                        />
                      ) : (
                        <span className="text-gray-700">{row.item || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, 'amount', Number(e.target.value))}
                          className="text-xs border border-gray-200 rounded px-2 py-1 w-full text-right focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                        />
                      ) : (
                        <span className="text-gray-700">{row.amount.toLocaleString()}원</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveRow(row.id)}
                              disabled={isSaving}
                              className="text-[10px] px-2.5 py-1 rounded bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50"
                            >
                              {isSaving ? '저장중' : '저장'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-[10px] px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(row.id)}
                              className="text-[10px] px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => deleteRow(row.id)}
                              disabled={isSaving}
                              className="text-[10px] px-2.5 py-1 rounded border border-red-100 text-red-400 hover:bg-red-50 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
