'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminLog, Shift, Timesheet } from '@/lib/supabase/queries/attendance-admin'
import { fmtHm, fmtTime, fmtWorkDate, isSunday, toHhmm } from '@/lib/attendance/format'

// 직원별 n월 — 날짜별 보기 (종이 근무일지와 같은 모양: 줄 = 날짜, 칸 = 직원)
//   칸: 출근–퇴근 · 근무시간, QR이면 파란 점 · 종이면 회색 점, 퇴근 누락은 주황
//   QR 칸 누르면 고치기, 빈 칸 누르면 직접 입력 (종이 칸은 업로드한 그대로라 읽기만)
//   주일(일요일·종이 근무일지의 주일 블록)은 줄 색으로

const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'
const won = (n: number) => n.toLocaleString('ko-KR')

type Cell = { clock_in: string; clock_out: string | null; minutes: number; source: 'paper' | 'qr'; logs: AdminLog[] }

export default function StaffDateGrid({ ts, logs, staff, totals, today }: {
  ts: Timesheet
  logs: AdminLog[]
  staff: { id: number; name: string }[] // 열 순서
  totals: Record<number, { minutes: number; pay: number }> // 직원별 합계 (지급액은 고정급·주휴 포함)
  today: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ staffId: number; date: string; log: AdminLog | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 직원·날짜별 칸 (계산에 쓴 기록 기준, 같은 날 여러 번이면 첫 출근 ~ 마지막 퇴근)
  const byId = new Map(logs.map((l) => [l.id, l]))
  const cells = new Map<string, Cell>()
  const sundayDates = new Set<string>()
  for (const s of [...ts.shifts].sort((a, b) => a.clock_in.localeCompare(b.clock_in)) as Shift[]) {
    if (s.sunday) sundayDates.add(s.work_date)
    const key = `${s.staff_id}|${s.work_date}`
    const log = s.log_id != null ? byId.get(s.log_id) : undefined
    const c = cells.get(key)
    if (!c) cells.set(key, { clock_in: s.clock_in, clock_out: s.clock_out, minutes: s.minutes, source: s.source, logs: log ? [log] : [] })
    else {
      c.minutes += s.minutes
      if (!s.clock_out) c.clock_out = null
      else if (c.clock_out && s.clock_out > c.clock_out) c.clock_out = s.clock_out
      if (log) c.logs.push(log)
    }
  }
  // 기준 기록에 밀려 계산에 안 쓴 QR 기록 → 고치기는 할 수 있게 칸에 붙여 둠
  const used = new Set(ts.shifts.map((s) => s.log_id).filter((x) => x != null))
  const extraQr = new Map<string, AdminLog[]>()
  for (const l of logs) {
    if (used.has(l.id)) continue
    const key = `${l.staff_id}|${l.work_date}`
    extraQr.set(key, [...(extraQr.get(key) ?? []), l])
  }

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: object) {
    setError(null)
    const res = await fetch('/api/attendance/logs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error === 'already_open' ? '이미 근무 중인 기록이 있어요. 그 기록의 퇴근 시간을 먼저 넣어 주세요.' : '저장하지 못했어요. 입력값을 확인해 주세요.')
      return false
    }
    setEditing(null)
    router.refresh()
    return true
  }

  if (staff.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-10 [word-break:keep-all]">이 달 근무 기록이 없어요 · QR로 출퇴근하거나 종이 근무일지를 올리면 채워져요</p>
  }

  const days = ts.dates.filter((d) => d <= today || staff.some((s) => cells.has(`${s.id}|${d}`)))

  return (
    <div>
      {error && <p className="px-5 py-2 text-xs text-red-500">{error}</p>}
      {editing && (
        <CellEditor
          key={`${editing.staffId}|${editing.date}|${editing.log?.id ?? 'new'}`}
          name={staff.find((s) => s.id === editing.staffId)?.name ?? ''}
          date={editing.date}
          log={editing.log}
          onCancel={() => setEditing(null)}
          onSave={(body) => (editing.log ? send('PATCH', { id: editing.log.id, ...body }) : send('POST', { staff_id: editing.staffId, work_date: editing.date, ...body }))}
          onDelete={editing.log ? () => send('DELETE', { id: editing.log!.id }) : undefined}
        />
      )}
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead className="text-gray-400 bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left font-medium px-3 py-2 sticky left-0 bg-gray-50 z-10 w-20">날짜</th>
              {staff.map((s) => (
                <th key={s.id} className="text-left font-medium px-3 py-2 whitespace-nowrap min-w-[120px]">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const sunday = isSunday(d) || sundayDates.has(d)
              return (
                <tr key={d} className={`border-t border-gray-50 ${sunday ? 'bg-rose-50/40' : ''}`}>
                  <td className={`px-3 py-1.5 whitespace-nowrap tabular-nums sticky left-0 z-10 ${sunday ? 'bg-rose-50 text-rose-700' : 'bg-white text-gray-500'}`}>{fmtWorkDate(d)}</td>
                  {staff.map((s) => {
                    const key = `${s.id}|${d}`
                    const c = cells.get(key)
                    const extra = extraQr.get(key) ?? []
                    const editableLog = c?.logs[0] ?? extra[0] ?? null
                    const missing = c && !c.clock_out && d < today
                    const working = c && !c.clock_out && d === today
                    return (
                      <td key={s.id} className="px-1 py-0.5">
                        <button
                          onClick={() => {
                            if (c?.source === 'paper' && !editableLog) return // 종이 기록은 읽기만
                            setEditing({ staffId: s.id, date: d, log: editableLog })
                          }}
                          className={`w-full text-left rounded-md px-2 py-1 tabular-nums ${
                            missing ? 'bg-amber-50 text-amber-800' : c ? 'hover:bg-gray-100' : 'text-gray-200 hover:bg-gray-50 hover:text-gray-400'
                          } ${c?.source === 'paper' && !editableLog ? 'cursor-default' : ''}`}
                          title={c?.source === 'paper' ? '종이 근무일지 (업로드한 그대로)' : c ? 'QR 기록 — 눌러서 고치기' : '눌러서 직접 입력'}
                        >
                          {c ? (
                            <>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${c.source === 'qr' ? 'bg-sky-500' : 'bg-gray-300'}`} />
                              {fmtTime(c.clock_in)}–{c.clock_out ? fmtTime(c.clock_out) : working ? <span className="text-[#1a5c3a]">근무 중</span> : '누락'}
                              <span className="ml-1 text-gray-400">{fmtHm(c.minutes)}</span>
                              {extra.length > 0 && <span className="ml-1 text-sky-400" title="계산에 안 쓴 QR 기록도 있어요">+QR</span>}
                            </>
                          ) : extra.length > 0 ? (
                            <span className="text-sky-400">QR (안 씀)</span>
                          ) : (
                            '·'
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-900">
            <tr>
              <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10">합계</td>
              {staff.map((s) => (
                <td key={s.id} className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {Math.round((totals[s.id]?.minutes ?? 0) / 6) / 10}h · {won(totals[s.id]?.pay ?? 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 py-2 text-[11px] text-gray-400 [word-break:keep-all]">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 mr-1 align-middle" />QR · <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 mr-1 align-middle" />종이 근무일지 · 분홍 줄 = 주일(1.5배) · QR 칸이나 빈 칸을 누르면 고치거나 넣을 수 있어요 · 합계 금액은 고정급·주휴 포함
      </p>
    </div>
  )
}

function CellEditor({ name, date, log, onSave, onCancel, onDelete }: {
  name: string
  date: string
  log: AdminLog | null
  onSave: (body: { clock_in: string; clock_out: string; memo: string }) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [inHm, setIn] = useState(log ? toHhmm(log.clock_in) : '')
  const [outHm, setOut] = useState(log ? toHhmm(log.clock_out) : '')
  const [memo, setMemo] = useState(log?.edit_memo ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ clock_in: inHm, clock_out: outHm, memo })
      }}
      className="mx-4 my-2 bg-white border border-[#1a5c3a]/30 rounded-lg p-3 flex flex-wrap items-center gap-2"
    >
      <span className="text-xs font-semibold text-gray-800">{name} · {fmtWorkDate(date)}</span>
      <span className="text-[11px] text-gray-400">{log ? 'QR 기록 고치기 (원래 시간도 남아요)' : '직접 입력'}</span>
      <input id={`cell-in-${date}`} type="time" value={inHm} onChange={(e) => setIn(e.target.value)} required className={INPUT} aria-label="출근" />
      <span className="text-gray-400">~</span>
      <input id={`cell-out-${date}`} type="time" value={outHm} onChange={(e) => setOut(e.target.value)} className={INPUT} aria-label="퇴근" />
      <input id={`cell-memo-${date}`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="사유 (선택)" className={`${INPUT} flex-1 min-w-[140px]`} />
      {onDelete &&
        (confirmDelete ? (
          <button type="button" onClick={onDelete} className="text-xs px-2 py-1.5 text-red-500 font-semibold">정말 삭제</button>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1.5 text-red-400">삭제</button>
        ))}
      <button type="button" onClick={onCancel} className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
      <button type="submit" disabled={!inHm} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">저장</button>
    </form>
  )
}
