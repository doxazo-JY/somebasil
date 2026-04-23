'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ManualAdjustment } from '@/lib/supabase/queries/adjustments'

interface Props {
  items: ManualAdjustment[]
}

export default function ManualAdjustments({ items }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState<{
    date: string
    type: 'income' | 'expense'
    direction: 'add' | 'subtract'
    amount: string
    memo: string
  }>({
    date: today,
    type: 'expense',
    direction: 'subtract',
    amount: '',
    memo: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount.replace(/,/g, ''))
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          type: form.type,
          direction: form.direction,
          amount,
          memo: form.memo.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setForm({ date: today, type: 'expense', direction: 'subtract', amount: '', memo: '' })
      setAdding(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 조정 항목을 삭제할까요?')) return
    await fetch('/api/adjustments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  const totalIncomeAdd = items
    .filter((i) => i.type === 'income' && i.direction === 'add')
    .reduce((s, i) => s + i.amount, 0)
  const totalIncomeSub = items
    .filter((i) => i.type === 'income' && i.direction === 'subtract')
    .reduce((s, i) => s + i.amount, 0)
  const totalExpenseAdd = items
    .filter((i) => i.type === 'expense' && i.direction === 'add')
    .reduce((s, i) => s + i.amount, 0)
  const totalExpenseSub = items
    .filter((i) => i.type === 'expense' && i.direction === 'subtract')
    .reduce((s, i) => s + i.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">수동 조정</p>
          <p className="text-xs text-gray-400 mt-0.5">
            자동 분류가 안 된 수입·지출을 월별 집계에 수동으로 가감
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] transition-colors"
          >
            + 추가
          </button>
        )}
      </div>

      {/* 요약 */}
      <div className="px-5 py-3 border-b border-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-gray-400">수입 추가</p>
          <p className="font-semibold text-[#1a5c3a] mt-0.5">
            +{Math.round(totalIncomeAdd / 10000)}만
          </p>
        </div>
        <div>
          <p className="text-gray-400">수입 차감</p>
          <p className="font-semibold text-gray-600 mt-0.5">
            -{Math.round(totalIncomeSub / 10000)}만
          </p>
        </div>
        <div>
          <p className="text-gray-400">지출 추가</p>
          <p className="font-semibold text-red-500 mt-0.5">
            +{Math.round(totalExpenseAdd / 10000)}만
          </p>
        </div>
        <div>
          <p className="text-gray-400">지출 차감</p>
          <p className="font-semibold text-gray-600 mt-0.5">
            -{Math.round(totalExpenseSub / 10000)}만
          </p>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-50 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
            </select>
            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as 'add' | 'subtract' })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            >
              <option value="add">+ 추가</option>
              <option value="subtract">- 차감</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="금액"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
            <input
              type="text"
              placeholder="메모 (예: 장천섭 상환 100만 서비스)"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </form>
      )}

      <div className="max-h-[480px] overflow-auto">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">조정 내역 없음</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-400 font-medium">
              <tr>
                <th className="text-left px-4 py-2">날짜</th>
                <th className="text-left px-4 py-2">구분</th>
                <th className="text-right px-4 py-2">금액</th>
                <th className="text-left px-4 py-2">메모</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row) => {
                const sign = row.direction === 'add' ? '+' : '-'
                const isIncomeAdd = row.type === 'income' && row.direction === 'add'
                const isExpenseAdd = row.type === 'expense' && row.direction === 'add'
                const color = isIncomeAdd
                  ? 'text-[#1a5c3a]'
                  : isExpenseAdd
                    ? 'text-red-500'
                    : 'text-gray-600'
                return (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-400 tabular-nums">{row.date}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {row.type === 'income' ? '수입' : '지출'} {row.direction === 'add' ? '추가' : '차감'}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${color}`}>
                      {sign}{row.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-[280px] truncate">
                      {row.memo || '—'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-gray-300 hover:text-red-400 text-sm px-1"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
