'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WorkLog {
  id: number
  date: string
  start_time: string
  end_time: string
  hours_worked: number
}

interface WorkLogSectionProps {
  staffId: number
  hourlyPay: number
  sundayHourlyPay: number | null
  taxRate: number
  logs: WorkLog[]
  year: number
  month: number
}

export default function WorkLogSection({
  staffId, hourlyPay, sundayHourlyPay, taxRate, logs, year, month
}: WorkLogSectionProps) {
  const router = useRouter()
  const [form, setForm] = useState({ date: '', start_time: '', end_time: '' })
  const [saving, setSaving] = useState(false)

  // 급여 계산
  function calcPay() {
    let base = 0
    for (const log of logs) {
      const dow = new Date(log.date).getDay()
      const rate = dow === 0 && sundayHourlyPay ? sundayHourlyPay : hourlyPay
      base += log.hours_worked * rate
    }

    // 주휴수당 (주 15시간 이상)
    const weekMap: Record<number, number> = {}
    for (const log of logs) {
      const d = new Date(log.date)
      const start = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
      weekMap[week] = (weekMap[week] ?? 0) + log.hours_worked
    }

    let allowance = 0
    for (const hrs of Object.values(weekMap)) {
      if (hrs >= 15) allowance += (hrs / 40) * 8 * hourlyPay
    }

    const gross = Math.round(base + allowance)
    const tax = Math.round(gross * (taxRate / 100))
    return { gross, tax, net: gross - tax, allowance: Math.round(allowance) }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/work-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, ...form }),
    })
    setSaving(false)
    setForm({ date: '', start_time: '', end_time: '' })
    router.refresh()
  }

  async function handleDelete(id: number, date: string) {
    await fetch('/api/work-logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, staff_id: staffId, date }),
    })
    router.refresh()
  }

  const pay = calcPay()
  const totalHours = logs.reduce((s, l) => s + l.hours_worked, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* 급여 요약 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '총 근무시간', value: `${totalHours.toFixed(1)}h` },
          { label: '세전 급여', value: `${pay.gross.toLocaleString()}원` },
          { label: `세금 공제 (${taxRate}%)`, value: `${pay.tax.toLocaleString()}원` },
          { label: '실수령액', value: `${pay.net.toLocaleString()}원`, highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${highlight ? 'text-[#1a5c3a]' : 'text-gray-800'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
      {pay.allowance > 0 && (
        <p className="text-xs text-gray-400 -mt-1">
          주휴수당 포함 {pay.allowance.toLocaleString()}원
        </p>
      )}

      {/* 근무 기록 입력 */}
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">출퇴근 기록 입력</p>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">날짜</label>
            <input
              type="date" required value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">출근</label>
            <input
              type="time" required value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">퇴근</label>
            <input
              type="time" required value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </div>
          <button
            type="submit" disabled={saving}
            className="px-4 py-2 bg-[#1a5c3a] text-white text-sm rounded-lg hover:bg-[#154d30] disabled:opacity-50"
          >
            {saving ? '추가 중...' : '추가'}
          </button>
        </form>
      </div>

      {/* 근무 기록 목록 */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">
            {year}년 {month}월 근무 기록
            <span className="ml-2 text-gray-400 font-normal">({logs.length}일)</span>
          </p>
        </div>
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">근무 기록이 없습니다.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-400 font-medium">
                <th className="text-left px-6 py-2.5">날짜</th>
                <th className="text-left px-4 py-2.5">출근</th>
                <th className="text-left px-4 py-2.5">퇴근</th>
                <th className="text-right px-4 py-2.5">근무시간</th>
                <th className="text-right px-4 py-2.5">일급</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const dow = new Date(log.date).getDay()
                const isSunday = dow === 0
                const rate = isSunday && sundayHourlyPay ? sundayHourlyPay : hourlyPay
                const dayPay = Math.round(log.hours_worked * rate)
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-2.5 text-gray-700">
                      {log.date}
                      {isSunday && <span className="ml-1.5 text-[10px] text-amber-500 font-medium">일</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{log.start_time.slice(0, 5)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{log.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{log.hours_worked.toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{dayPay.toLocaleString()}원</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(log.id, log.date)}
                        className="text-gray-300 hover:text-red-400 text-xs"
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
