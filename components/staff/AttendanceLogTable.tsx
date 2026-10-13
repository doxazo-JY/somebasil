'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminLog } from '@/lib/supabase/queries/attendance-admin'
import { fmtHm, fmtTime, fmtWorkDate, toHhmm } from '@/lib/attendance/format'

interface Props {
  logs: AdminLog[]          // 선택한 달 기록
  openLogs: AdminLog[]      // 퇴근 안 찍힌 기록 전체 (지난달 포함)
  staffOptions: { id: number; name: string }[]
  today: string             // 한국 날짜
}

const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'

function statusOf(log: AdminLog, today: string) {
  if (!log.clock_out) {
    return log.work_date === today
      ? { label: '근무 중', cls: 'bg-[#e6f0ea] text-[#1a5c3a]' }
      : { label: '퇴근 누락', cls: 'bg-amber-50 text-amber-700' }
  }
  if (log.edited_at) return { label: '점장 수정됨', cls: 'border border-gray-200 text-gray-500' }
  return { label: '정상', cls: 'bg-gray-50 text-gray-500' }
}

export default function AttendanceLogTable({ logs, openLogs, staffOptions, today }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 지난 날짜의 퇴근 누락 (이번 달 목록 밖에 있을 수도 있어 따로 표시)
  const missing = openLogs.filter((l) => l.work_date < today)

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: object) {
    setError(null)
    const res = await fetch('/api/attendance/logs', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error === 'already_open'
        ? '이미 근무 중인 기록이 있어요. 그 기록의 퇴근 시간을 먼저 넣어 주세요.'
        : '저장하지 못했어요. 입력값을 확인해 주세요.')
      return false
    }
    router.refresh()
    return true
  }

  // 날짜별 묶기 (서버에서 날짜 최신순으로 옴)
  const byDate = logs.reduce<Record<string, AdminLog[]>>((acc, l) => {
    ;(acc[l.work_date] ??= []).push(l)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3">
          <p className="text-sm font-semibold text-amber-800">퇴근 기록이 없는 근무 {missing.length}건</p>
          <p className="text-xs text-amber-700 mt-0.5 [word-break:keep-all]">
            퇴근 시간을 넣어야 근무일지에 근무시간이 잡혀요:{' '}
            {missing.map((l) => `${l.staff_name} ${fmtWorkDate(l.work_date)}`).join(', ')}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">출퇴근 기록</p>
            <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">QR로 찍힌 시간을 고치면 원래 시간도 함께 남아요</p>
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] whitespace-nowrap shrink-0"
            >
              + 직접 입력
            </button>
          )}
        </div>

        {error && <p className="px-5 py-2 text-xs text-red-500 border-b border-gray-50">{error}</p>}

        {adding && (
          <AddForm
            staffOptions={staffOptions}
            today={today}
            onCancel={() => setAdding(false)}
            onSave={async (body) => { if (await send('POST', body)) setAdding(false) }}
          />
        )}

        {logs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">이 달의 출퇴근 기록이 없어요</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-gray-50 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">날짜</th>
                  <th className="text-left px-4 py-2 font-medium">직원</th>
                  <th className="text-left px-4 py-2 font-medium">출근</th>
                  <th className="text-left px-4 py-2 font-medium">퇴근</th>
                  <th className="text-left px-4 py-2 font-medium">근무</th>
                  <th className="text-left px-4 py-2 font-medium">상태</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byDate).map(([date, rows]) =>
                  rows.map((log, idx) =>
                    editingId === log.id ? (
                      <EditRow
                        key={log.id}
                        log={log}
                        onCancel={() => setEditingId(null)}
                        onSave={async (body) => { if (await send('PATCH', { id: log.id, ...body })) setEditingId(null) }}
                        onDelete={async () => { if (confirm('이 기록을 삭제할까요?') && (await send('DELETE', { id: log.id }))) setEditingId(null) }}
                      />
                    ) : (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-500 tabular-nums">{idx === 0 ? fmtWorkDate(date) : ''}</td>
                        <td className="px-4 py-2.5 text-gray-900">{log.staff_name}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {fmtTime(log.clock_in)}
                          {log.qr_clock_in && log.qr_clock_in !== log.clock_in && (
                            <span className="ml-1 text-gray-300 line-through">{fmtTime(log.qr_clock_in)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {fmtTime(log.clock_out)}
                          {log.qr_clock_out && log.qr_clock_out !== log.clock_out && (
                            <span className="ml-1 text-gray-300 line-through">{fmtTime(log.qr_clock_out)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-gray-700">{fmtHm(log.minutes_worked)}</td>
                        <td className="px-4 py-2.5">
                          {(() => {
                            const s = statusOf(log, today)
                            return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`} title={log.edit_memo ?? undefined}>{s.label}</span>
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => setEditingId(log.id)} className="text-[#1a5c3a] hover:underline">수정</button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function EditRow({ log, onSave, onCancel, onDelete }: {
  log: AdminLog
  onSave: (body: { clock_in: string; clock_out: string; memo: string }) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [inHm, setIn] = useState(toHhmm(log.clock_in))
  const [outHm, setOut] = useState(toHhmm(log.clock_out))
  const [memo, setMemo] = useState(log.edit_memo ?? '')
  return (
    <tr className="bg-gray-50/60">
      <td className="px-4 py-2 text-gray-500">{fmtWorkDate(log.work_date)}</td>
      <td className="px-4 py-2 text-gray-900">{log.staff_name}</td>
      <td className="px-4 py-2"><input id={`edit-in-${log.id}`} type="time" value={inHm} onChange={(e) => setIn(e.target.value)} className={INPUT} /></td>
      <td className="px-4 py-2"><input id={`edit-out-${log.id}`} type="time" value={outHm} onChange={(e) => setOut(e.target.value)} className={INPUT} /></td>
      <td className="px-4 py-2" colSpan={2}>
        <input id={`edit-memo-${log.id}`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="수정 사유 (선택)" className={`${INPUT} w-full`} />
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
        <button onClick={onDelete} className="text-red-400 hover:underline">삭제</button>
        <button onClick={onCancel} className="text-gray-400 hover:underline">취소</button>
        <button onClick={() => onSave({ clock_in: inHm, clock_out: outHm, memo })} disabled={!inHm} className="text-[#1a5c3a] font-semibold hover:underline disabled:opacity-40">저장</button>
      </td>
    </tr>
  )
}

function AddForm({ staffOptions, today, onSave, onCancel }: {
  staffOptions: { id: number; name: string }[]
  today: string
  onSave: (body: object) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ staff_id: staffOptions[0]?.id ?? 0, work_date: today, clock_in: '', clock_out: '', memo: '' })
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form) }}
      className="px-5 py-4 border-b border-gray-50 bg-gray-50/30"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <select id="add-staff" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: Number(e.target.value) })} className={INPUT}>
          {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input id="add-date" type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} required className={INPUT} />
        <input id="add-in" type="time" value={form.clock_in} onChange={(e) => setForm({ ...form, clock_in: e.target.value })} required className={INPUT} aria-label="출근" />
        <input id="add-out" type="time" value={form.clock_out} onChange={(e) => setForm({ ...form, clock_out: e.target.value })} className={INPUT} aria-label="퇴근" />
        <input id="add-memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="사유 (예: 폰 안 가져옴)" className={INPUT} />
      </div>
      <div className="flex gap-2 mt-2 justify-end">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
        <button type="submit" disabled={!form.staff_id || !form.clock_in} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">저장</button>
      </div>
    </form>
  )
}
