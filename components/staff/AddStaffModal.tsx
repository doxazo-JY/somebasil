'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AddStaffModalProps {
  onClose: () => void
}

export default function AddStaffModal({ onClose }: AddStaffModalProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    role: 'part_time',
    hire_date: '',
    hourly_pay: '',
    sunday_hourly_pay: '',
    tax_rate: '3.3',
  })
  const [saving, setSaving] = useState(false)
  const [useCustomTax, setUseCustomTax] = useState(false)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        hire_date: form.hire_date,
        hourly_pay: Number(form.hourly_pay),
        sunday_hourly_pay: form.sunday_hourly_pay ? Number(form.sunday_hourly_pay) : null,
        tax_rate: Number(form.tax_rate),
      }),
    })

    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">직원 추가</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* 이름 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">이름</label>
            <input
              required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>

          {/* 직책 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">직책</label>
            <select
              value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            >
              <option value="manager">점장</option>
              <option value="assistant">매니저</option>
              <option value="part_time">알바생</option>
            </select>
          </div>

          {/* 입사일 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">입사일</label>
            <input
              type="date" required value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>

          {/* 시급 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시급 (월~토)</label>
              <div className="relative">
                <input
                  type="number" required value={form.hourly_pay} onChange={(e) => set('hourly_pay', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                  placeholder="10,030"
                />
                <span className="absolute right-2.5 top-2 text-xs text-gray-400">원</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시급 (일요일)</label>
              <div className="relative">
                <input
                  type="number" value={form.sunday_hourly_pay} onChange={(e) => set('sunday_hourly_pay', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                  placeholder="미입력 시 동일"
                />
                <span className="absolute right-2.5 top-2 text-xs text-gray-400">원</span>
              </div>
            </div>
          </div>

          {/* 세금 공제율 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">세금 공제율</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setUseCustomTax(false); set('tax_rate', '3.3') }}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                  !useCustomTax ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'border-gray-200 text-gray-500'
                }`}
              >
                3.3%
              </button>
              <button
                type="button"
                onClick={() => setUseCustomTax(true)}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                  useCustomTax ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'border-gray-200 text-gray-500'
                }`}
              >
                직접 입력
              </button>
            </div>
            {useCustomTax && (
              <div className="relative mt-2">
                <input
                  type="number" step="0.1" value={form.tax_rate} onChange={(e) => set('tax_rate', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
                  placeholder="0.0"
                />
                <span className="absolute right-2.5 top-2 text-xs text-gray-400">%</span>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm bg-[#1a5c3a] text-white rounded-lg hover:bg-[#154d30] disabled:opacity-50"
            >
              {saving ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
