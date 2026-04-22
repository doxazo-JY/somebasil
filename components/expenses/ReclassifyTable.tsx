'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORY_OPTIONS = [
  { value: 'ingredients', label: '재료비', color: 'text-amber-600' },
  { value: 'labor', label: '인건비', color: 'text-violet-600' },
  { value: 'fixed', label: '고정비', color: 'text-blue-600' },
  { value: 'equipment', label: '설비투자', color: 'text-sky-600' },
  { value: 'card', label: '카드대금', color: 'text-gray-500' },
  { value: 'excluded', label: '제외', color: 'text-gray-400' },
]

export interface ReclassifyItem {
  id: string
  date: string | null
  category: string
  item: string
  amount: number
}

interface Props {
  items: ReclassifyItem[]
}

export default function ReclassifyTable({ items }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let list = items
    if (filter !== 'all') {
      list = list.filter((i) => i.category === filter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.item?.toLowerCase().includes(q))
    }
    return list.sort((a, b) => b.amount - a.amount)
  }, [items, filter, search])

  async function handleChangeCategory(id: string, newCategory: string) {
    setUpdating((s) => new Set(s).add(id))
    try {
      const target = items.find((i) => i.id === id)
      if (!target) return
      const res = await fetch('/api/upload/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          item: target.item,
          amount: target.amount,
          category: newCategory,
        }),
      })
      if (!res.ok) throw new Error('update failed')
      router.refresh()
    } finally {
      setUpdating((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 거래를 삭제할까요?')) return
    setUpdating((s) => new Set(s).add(id))
    try {
      const res = await fetch('/api/upload/edit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('delete failed')
      router.refresh()
    } finally {
      setUpdating((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    }
  }

  const totalShown = filtered.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* 헤더 + 필터 */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-700">전체 거래 (재분류 가능)</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            카테고리 드롭다운으로 즉시 수정 · {filtered.length}건 · {Math.round(totalShown / 10000)}만원
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
          >
            <option value="all">모든 카테고리</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="적요 검색"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="sticky top-0 bg-gray-50 text-gray-400 font-medium">
            <tr>
              <th className="text-left px-4 py-2">날짜</th>
              <th className="text-left px-4 py-2">적요</th>
              <th className="text-right px-4 py-2">금액</th>
              <th className="text-left px-4 py-2 w-28">카테고리</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  거래 없음
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isUpdating = updating.has(row.id)
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50/50 ${isUpdating ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2 text-gray-400 tabular-nums">
                      {row.date ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-700 max-w-[240px] truncate">
                      {row.item || '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 tabular-nums">
                      {row.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-2">
                      <select
                        disabled={isUpdating}
                        value={row.category}
                        onChange={(e) => handleChangeCategory(row.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] w-full"
                      >
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        disabled={isUpdating}
                        onClick={() => handleDelete(row.id)}
                        className="text-gray-300 hover:text-red-400 text-sm px-1"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
