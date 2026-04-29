'use client'

import { useState } from 'react'

const CATEGORY_OPTIONS_EXPENSE = [
  { value: 'ingredients_cash', label: '재료비(현금)' },
  { value: 'ingredients_card', label: '재료비(카드)' },
  { value: 'labor', label: '인건비' },
  { value: 'fixed', label: '고정비' },
  { value: 'equipment', label: '설비투자' },
  { value: 'excluded', label: '제외' },
]

const CATEGORY_OPTIONS_INCOME = [
  { value: 'income', label: '수입' },
]

export interface PreviewRow {
  date: string
  memo: string
  amount: number
  category: string
  type: 'income' | 'expense'
}

interface PreviewTableProps {
  rows: PreviewRow[]
  onSave: (rows: PreviewRow[]) => void
  saving?: boolean
}

export default function PreviewTable({ rows, onSave, saving }: PreviewTableProps) {
  const [editedRows, setEditedRows] = useState<PreviewRow[]>(rows)

  function handleCategoryChange(index: number, category: string) {
    setEditedRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, category } : r))
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          미리보기 <span className="text-gray-400 font-normal">({editedRows.length}건)</span>
        </p>
        <button
          onClick={() => onSave(editedRows)}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-400 font-medium">날짜</th>
              <th className="text-left px-4 py-2.5 text-gray-400 font-medium">항목</th>
              <th className="text-right px-4 py-2.5 text-gray-400 font-medium">금액</th>
              <th className="text-left px-4 py-2.5 text-gray-400 font-medium">카테고리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {editedRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 text-gray-500">{row.date}</td>
                <td className="px-4 py-2.5 text-gray-700">{row.memo}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">
                  {row.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={row.category}
                    onChange={(e) => handleCategoryChange(i, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                  >
                    {(row.type === 'income'
                      ? CATEGORY_OPTIONS_INCOME
                      : CATEGORY_OPTIONS_EXPENSE
                    ).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
