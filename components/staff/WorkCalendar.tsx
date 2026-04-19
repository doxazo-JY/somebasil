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

interface WorkCalendarProps {
  staffId: number
  logs: WorkLog[]
  year: number
  month: number
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function WorkCalendar({ staffId, logs, year, month }: WorkCalendarProps) {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [form, setForm] = useState({ start_time: '', end_time: '' })
  const [saving, setSaving] = useState(false)

  // 날짜 → 로그 맵
  const logMap: Record<string, WorkLog> = {}
  for (const log of logs) {
    logMap[log.date] = log
  }

  // 달력 셀 계산
  const firstDow = new Date(year, month - 1, 1).getDay() // 0=일
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function handleCellClick(day: number) {
    const log = logMap[dateStr(day)]
    if (log) return // 로그 있는 날은 달력 클릭으로 처리 안 함
    setSelectedDay(selectedDay === day ? null : day)
    setForm({ start_time: '', end_time: '' })
  }

  async function handleAdd() {
    if (!selectedDay || !form.start_time || !form.end_time) return
    setSaving(true)
    await fetch('/api/work-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        date: dateStr(selectedDay),
        start_time: form.start_time,
        end_time: form.end_time,
      }),
    })
    setSaving(false)
    setSelectedDay(null)
    setForm({ start_time: '', end_time: '' })
    router.refresh()
  }

  async function handleDelete(log: WorkLog) {
    await fetch('/api/work-logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: log.id, staff_id: staffId, date: log.date }),
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {year}년 {month}월 출퇴근 기록
        </p>
        <p className="text-xs text-gray-400">날짜를 클릭하여 기록 추가</p>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`text-center py-2 text-xs font-medium ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 달력 셀 */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-[72px] border-b border-r border-gray-50 bg-gray-50/40"
              />
            )
          }

          const ds = dateStr(day)
          const log = logMap[ds]
          const dow = new Date(ds).getDay()
          const isSun = dow === 0
          const isSat = dow === 6
          const isSelected = selectedDay === day
          const isToday =
            ds === new Date().toISOString().slice(0, 10)

          return (
            <div
              key={ds}
              className={`h-[72px] border-b border-r border-gray-50 flex flex-col p-1.5 transition-colors ${
                isSelected ? 'bg-[#1a5c3a]/5 ring-1 ring-inset ring-[#1a5c3a]/20' : ''
              } ${!log ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => handleCellClick(day)}
            >
              {/* 날짜 숫자 */}
              <span
                className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                  isToday
                    ? 'bg-[#1a5c3a] text-white'
                    : isSun
                    ? 'text-red-400'
                    : isSat
                    ? 'text-blue-400'
                    : 'text-gray-600'
                }`}
              >
                {day}
              </span>

              {/* 근무 기록 */}
              {log && (
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#1a5c3a]">
                      {log.hours_worked.toFixed(1)}h
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(log)
                      }}
                      className="text-[9px] text-gray-300 hover:text-red-400 leading-none px-0.5"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 leading-tight">
                    {log.start_time.slice(0, 5)}~{log.end_time.slice(0, 5)}
                  </p>
                </div>
              )}

              {/* 선택됨 표시 */}
              {isSelected && !log && (
                <div className="text-[9px] text-[#1a5c3a] font-medium mt-auto">
                  ＋ 입력
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 선택된 날짜 입력 폼 */}
      {selectedDay !== null && !logMap[dateStr(selectedDay)] && (
        <div className="border-t border-[#1a5c3a]/20 bg-[#1a5c3a]/5 px-5 py-3">
          <div className="flex items-center gap-4">
            <p className="text-sm font-semibold text-[#1a5c3a] w-16 shrink-0">
              {month}/{selectedDay}
            </p>
            <div className="flex items-center gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">출근</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] bg-white"
                />
              </div>
              <span className="text-gray-400 text-sm mt-4">~</span>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">퇴근</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setSelectedDay(null)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-white"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !form.start_time || !form.end_time}
                className="px-4 py-1.5 text-sm bg-[#1a5c3a] text-white rounded-lg hover:bg-[#154d30] disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
