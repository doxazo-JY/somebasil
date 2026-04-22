'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SalaryEntry {
  year: number
  month: number
  amount: number
}

interface PastSalarySectionProps {
  staffId: number
  salaries: SalaryEntry[]
}

export default function PastSalarySection({ staffId, salaries }: PastSalarySectionProps) {
  const router = useRouter()
  const now = new Date()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    amount: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/staff-salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        year: Number(form.year),
        month: Number(form.month),
        amount: Number(form.amount.replace(/,/g, '')),
      }),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ year: String(now.getFullYear()), month: String(now.getMonth() + 1), amount: '' })
    router.refresh()
  }

  async function handleDelete(year: number, month: number) {
    await fetch('/api/staff-salary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, year, month }),
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">인건비 이력</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
        >
          + 직접 입력
        </button>
      </div>

      {/* 직접 입력 폼 */}
      {showForm && (
        <form onSubmit={handleAdd} className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500 mb-2">근무 기록 없이 급여를 직접 입력합니다.</p>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">연도</label>
              <select
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] bg-white"
              >
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">월</label>
              <select
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 mb-1 block">지급 금액 (세전)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] bg-white"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-gray-400">원</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 hover:bg-white"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-[#1a5c3a] text-white rounded-lg hover:bg-[#154d30] disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 인건비 목록 */}
      {salaries.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          인건비 이력이 없습니다.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-400 font-medium">
              <th className="text-left px-5 py-2.5">기간</th>
              <th className="text-right px-4 py-2.5">세전 급여</th>
              <th className="px-4 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {salaries.map((s) => (
              <tr key={`${s.year}-${s.month}`} className="hover:bg-gray-50/50">
                <td className="px-5 py-2.5 text-gray-700">
                  {s.year}년 {s.month}월
                </td>
                <td className="px-4 py-2.5 text-right text-gray-800 font-medium">
                  {s.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(s.year, s.month)}
                    className="text-gray-300 hover:text-red-400"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
