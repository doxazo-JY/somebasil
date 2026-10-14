'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminLog, PayrollItem, Shift, Timesheet } from '@/lib/supabase/queries/attendance-admin'
import { fmtHm, fmtTime, fmtWorkDate, toHhmm } from '@/lib/attendance/format'
import StaffDateGrid from './StaffDateGrid'

// 직원별 이번 달 — 예전 "출퇴근 기록" + "직원별 합계" + "수기 항목"을 한 표로. 보기 2개:
//   날짜별(넓은 화면 기본): 종이 근무일지와 같은 모양 (StaffDateGrid) — 병행 기간 근태 맞춰 보기
//   사람별(폰 기본): 한 줄 = 한 사람의 이번 달 합계 (근무일·평일·주일·지급액·수기 항목·합계) — 월말 급여
//   누르면 그 사람의 날짜별 출퇴근 (종이/QR 표시, QR만 고치기) + 수기 항목 넣기
//   기준 기록(종이 우선/QR 우선)에 밀려 계산에 안 쓴 QR 기록도 흐리게 보여 줌 (고칠 수는 있음)

const KIND_LABEL: Record<PayrollItem['kind'], string> = { fixed_salary: '고정급', weekly_holiday_pay: '주휴수당', other: '기타' }
const won = (n: number) => n.toLocaleString('ko-KR')
const hours = (min: number) => (min ? `${Math.round((min / 60) * 10) / 10}h` : '—')
const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'

type Row = {
  id: number | null // null = 직원 지정 없는 수기 항목
  name: string
  days: number
  weekdayMin: number
  sundayMin: number
  pay: number
  items: PayrollItem[]
}

function buildRows(ts: Timesheet, logs: AdminLog[]): Row[] {
  const rows = new Map<number | null, Row>()
  const get = (id: number | null, name: string) => {
    const r = rows.get(id) ?? { id, name, days: 0, weekdayMin: 0, sundayMin: 0, pay: 0, items: [] }
    rows.set(id, r)
    return r
  }
  for (const [block, key] of [[ts.weekday, 'weekdayMin'], [ts.sunday, 'sundayMin']] as const) {
    for (const s of block.staff) {
      const t = block.totals[s.id]
      const r = get(s.id, s.name)
      r.days += t.days
      r[key] += t.minutes
      r.pay += t.pay
    }
  }
  // 알바생이 아니어도 QR 기록이 있으면 줄을 보여 줌 (고치기용)
  for (const l of logs) get(l.staff_id, l.staff_name)
  for (const i of ts.payrollItems) get(i.staff_id, i.staff_id == null ? '공통 항목' : (rows.get(i.staff_id)?.name ?? i.label)).items.push(i)
  return [...rows.values()].sort((a, b) => (a.id == null ? 1 : b.id == null ? -1 : b.pay + sum(b.items) - (a.pay + sum(a.items))))
}

const sum = (items: PayrollItem[]) => items.reduce((s, i) => s + i.amount, 0)

// 폰 화면이면 사람별이 기본 (날짜별 표는 옆으로 길어서)
const NARROW = '(max-width: 767px)'
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(NARROW).matches,
    () => false
  )
}

export default function StaffMonthTable({ ts, logs, openLogs, staffOptions, today }: {
  ts: Timesheet
  logs: AdminLog[] // 이 달 QR 기록 (모든 직원)
  openLogs: AdminLog[] // 퇴근 안 찍힌 기록 전체 (지난달 포함)
  staffOptions: { id: number; name: string }[]
  today: string
}) {
  const router = useRouter()
  const rows = buildRows(ts, logs)
  const [open, setOpen] = useState<number | null | undefined>(undefined)
  const narrow = useNarrow()
  const [picked, setPicked] = useState<'date' | 'person' | null>(null)
  const mode = picked ?? (narrow ? 'person' : 'date')
  const gridStaff = rows.filter((r) => r.id != null).map((r) => ({ id: r.id as number, name: r.name }))
  const gridTotals = Object.fromEntries(
    rows.filter((r) => r.id != null).map((r) => [r.id, { minutes: r.weekdayMin + r.sundayMin, pay: r.pay + sum(r.items) }])
  )
  const [msg, setMsg] = useState<string | null>(null)
  const missing = openLogs.filter((l) => l.work_date < today)
  const prevMonth = ts.month === 1 ? 12 : ts.month - 1

  async function copyPrev() {
    setMsg(null)
    const res = await fetch('/api/attendance/payroll-items/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: ts.year, month: ts.month }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setMsg('가져오지 못했어요')
    setMsg(data.copied > 0 ? `${prevMonth}월 고정급 ${data.copied}건을 가져왔어요` : data.found > 0 ? '이미 다 들어 있어요' : `${prevMonth}월에 고정급 항목이 없어요`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3">
          <p className="text-sm font-semibold text-amber-800">퇴근 기록이 없는 근무 {missing.length}건</p>
          <p className="text-xs text-amber-700 mt-0.5 [word-break:keep-all]">
            그 직원 줄을 눌러 퇴근 시간을 넣어 주세요: {missing.map((l) => `${l.staff_name} ${fmtWorkDate(l.work_date)}`).join(', ')}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-800">직원별 {ts.month}월</p>
              <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
                {(['date', 'person'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPicked(m)}
                    className={`text-xs px-2.5 py-1 rounded-md ${mode === m ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500'}`}
                  >
                    {m === 'date' ? '날짜별' : '사람별'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
              {mode === 'date' ? '종이 근무일지와 같은 모양 · ' : '이름을 누르면 날짜별 출퇴근과 고정급·주휴수당 넣기가 열려요 · '}
              시급 평일 {ts.rates.weekday ? won(ts.rates.weekday) : '미등록'} · 주일 {ts.rates.sunday ? won(ts.rates.sunday) : '미등록'}
            </p>
            {msg && <p className="text-xs text-[#1a5c3a] mt-1">{msg}</p>}
          </div>
          <button onClick={copyPrev} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap shrink-0">
            {prevMonth}월 고정급 가져오기
          </button>
        </div>

        {mode === 'date' ? (
          <StaffDateGrid ts={ts} logs={logs} staff={gridStaff} totals={gridTotals} today={today} />
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10 [word-break:keep-all]">이 달 근무 기록이 없어요 · QR로 출퇴근하거나 종이 근무일지를 올리면 채워져요</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">직원</th>
                  <th className="text-right px-3 py-2 font-medium">근무일</th>
                  <th className="text-right px-3 py-2 font-medium">평일</th>
                  <th className="text-right px-3 py-2 font-medium">주일</th>
                  <th className="text-right px-3 py-2 font-medium">근무 지급액</th>
                  <th className="text-right px-3 py-2 font-medium">고정급·주휴</th>
                  <th className="text-right px-5 py-2 font-medium">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => {
                  const isOpen = open === r.id
                  const hasMissing = missing.some((l) => l.staff_id === r.id)
                  return (
                    <RowBlock
                      key={r.id ?? 'common'}
                      row={r}
                      isOpen={isOpen}
                      hasMissing={hasMissing}
                      onToggle={() => setOpen(isOpen ? undefined : r.id)}
                      ts={ts}
                      logs={logs}
                      staffOptions={staffOptions}
                      today={today}
                    />
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gray-100 text-gray-900 font-semibold">
                <tr>
                  <td className="px-5 py-2.5">합계</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 text-right tabular-nums">{won(ts.weekday.pay + ts.sunday.pay)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{won(sum(ts.payrollItems))}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{won(ts.total)}원</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {mode === 'person' && !rows.some((r) => r.id == null) && (
          <div className="border-t border-gray-50">
            <button onClick={() => setOpen(open === null ? undefined : null)} className="w-full text-left px-5 py-2.5 text-xs text-gray-400 hover:text-gray-700">
              {open === null ? '▾' : '▸'} 직원 지정 없는 항목 넣기 (예: 점장 고정급)
            </button>
            {open === null && <ItemsEditor year={ts.year} month={ts.month} staffId={null} staffName="" items={[]} />}
          </div>
        )}
      </div>
    </div>
  )
}

function RowBlock({ row, isOpen, hasMissing, onToggle, ts, logs, staffOptions, today }: {
  row: Row
  isOpen: boolean
  hasMissing: boolean
  onToggle: () => void
  ts: Timesheet
  logs: AdminLog[]
  staffOptions: { id: number; name: string }[]
  today: string
}) {
  const items = sum(row.items)
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer ${isOpen ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}>
        <td className="px-5 py-2.5 text-gray-900">
          <span className="text-gray-400 mr-1.5">{isOpen ? '▾' : '▸'}</span>
          {row.name}
          {hasMissing && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">퇴근 누락</span>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.id == null ? '' : `${row.days}일`}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.id == null ? '' : hours(row.weekdayMin)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.id == null ? '' : hours(row.sundayMin)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{row.pay ? won(row.pay) : '—'}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{items ? won(items) : '—'}</td>
        <td className="px-5 py-2.5 text-right tabular-nums font-medium text-gray-900">{won(row.pay + items)}</td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={7} className="bg-gray-50/60 px-4 pb-4 pt-1">
            {row.id != null && <DayList staffId={row.id} staffOptions={staffOptions} ts={ts} logs={logs} today={today} />}
            <ItemsEditor year={ts.year} month={ts.month} staffId={row.id} staffName={row.name} items={row.items} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── 날짜별 출퇴근 (계산에 쓴 기록 + 기준 기록에 밀린 QR 기록)
type DayRecord = { key: string; date: string; clock_in: string; clock_out: string | null; minutes: number | null; source: 'paper' | 'qr'; used: boolean; log: AdminLog | null }

function DayList({ staffId, staffOptions, ts, logs, today }: { staffId: number; staffOptions: { id: number; name: string }[]; ts: Timesheet; logs: AdminLog[]; today: string }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const used: Shift[] = ts.shifts.filter((s) => s.staff_id === staffId)
  const usedLogIds = new Set(used.map((s) => s.log_id).filter((x): x is number => x != null))
  const byId = new Map(logs.map((l) => [l.id, l]))
  const records: DayRecord[] = [
    ...used.map((s, i) => ({
      key: `u${i}`, date: s.work_date, clock_in: s.clock_in, clock_out: s.clock_out, minutes: s.minutes,
      source: s.source, used: true, log: s.log_id != null ? (byId.get(s.log_id) ?? null) : null,
    })),
    ...logs
      .filter((l) => l.staff_id === staffId && !usedLogIds.has(l.id))
      .map((l) => ({ key: `q${l.id}`, date: l.work_date, clock_in: l.clock_in, clock_out: l.clock_out, minutes: l.minutes_worked, source: 'qr' as const, used: false, log: l })),
  ].sort((a, b) => b.clock_in.localeCompare(a.clock_in))

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: object) {
    setError(null)
    const res = await fetch('/api/attendance/logs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error === 'already_open' ? '이미 근무 중인 기록이 있어요. 그 기록의 퇴근 시간을 먼저 넣어 주세요.' : '저장하지 못했어요. 입력값을 확인해 주세요.')
      return false
    }
    router.refresh()
    return true
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between py-1.5">
        <p className="text-[11px] font-semibold text-gray-500">날짜별 출퇴근</p>
        {!adding && <button onClick={() => setAdding(true)} className="text-[11px] text-[#1a5c3a] hover:underline">+ 직접 입력</button>}
      </div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      {adding && (
        <AddForm
          staffId={staffId}
          staffOptions={staffOptions}
          today={today}
          onCancel={() => setAdding(false)}
          onSave={async (body) => { if (await send('POST', body)) setAdding(false) }}
        />
      )}
      {records.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">이 달 출퇴근 기록이 없어요</p>
      ) : (
        <table className="w-full text-xs bg-white rounded-lg">
          <tbody className="divide-y divide-gray-50">
            {records.map((r) =>
              r.log && editingId === r.log.id ? (
                <EditRow
                  key={r.key}
                  log={r.log}
                  onCancel={() => setEditingId(null)}
                  onSave={async (body) => { if (await send('PATCH', { id: r.log!.id, ...body })) setEditingId(null) }}
                  onDelete={async () => { if (await send('DELETE', { id: r.log!.id })) setEditingId(null) }}
                />
              ) : (
                <tr key={r.key} className={r.used ? '' : 'text-gray-300'}>
                  <td className="px-3 py-1.5 tabular-nums w-24">{fmtWorkDate(r.date)}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {fmtTime(r.clock_in)} ~ {r.clock_out ? fmtTime(r.clock_out) : <span className={r.date === today ? 'text-[#1a5c3a]' : 'text-amber-600'}>{r.date === today ? '근무 중' : '퇴근 누락'}</span>}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{fmtHm(r.minutes)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.source === 'qr' ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'} ${r.used ? '' : 'opacity-60'}`}>
                      {r.source === 'qr' ? 'QR' : '종이'}
                    </span>
                    {!r.used && <span className="ml-1.5 text-[10px] text-gray-400">{ts.priority === 'paper' ? '종이 기록을 써요' : 'QR 기록을 써요'}</span>}
                    {r.log?.edited_at && <span className="ml-1.5 text-[10px] text-gray-400" title={r.log.edit_memo ?? undefined}>수정됨</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right w-14">
                    {r.log && <button onClick={() => setEditingId(r.log!.id)} className="text-[#1a5c3a] hover:underline">고치기</button>}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <tr className="bg-gray-50">
      <td className="px-3 py-1.5 tabular-nums">{fmtWorkDate(log.work_date)}</td>
      <td className="px-3 py-1.5" colSpan={2}>
        <input id={`edit-in-${log.id}`} type="time" value={inHm} onChange={(e) => setIn(e.target.value)} className={INPUT} aria-label="출근" />
        <span className="mx-1 text-gray-400">~</span>
        <input id={`edit-out-${log.id}`} type="time" value={outHm} onChange={(e) => setOut(e.target.value)} className={INPUT} aria-label="퇴근" />
      </td>
      <td className="px-3 py-1.5">
        <input id={`edit-memo-${log.id}`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="수정 사유 (선택)" className={`${INPUT} w-full`} />
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap space-x-2">
        {confirmDelete ? (
          <button onClick={onDelete} className="text-red-500 font-semibold hover:underline">정말 삭제</button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-red-400 hover:underline">삭제</button>
        )}
        <button onClick={onCancel} className="text-gray-400 hover:underline">취소</button>
        <button onClick={() => onSave({ clock_in: inHm, clock_out: outHm, memo })} disabled={!inHm} className="text-[#1a5c3a] font-semibold hover:underline disabled:opacity-40">저장</button>
      </td>
    </tr>
  )
}

function AddForm({ staffId, staffOptions, today, onSave, onCancel }: {
  staffId: number
  staffOptions: { id: number; name: string }[]
  today: string
  onSave: (body: object) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ staff_id: staffId, work_date: today, clock_in: '', clock_out: '', memo: '' })
  const name = staffOptions.find((s) => s.id === staffId)?.name
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="mb-2 bg-white rounded-lg p-2 flex flex-wrap gap-2 items-center">
      {name && <span className="text-xs text-gray-500">{name}</span>}
      <input id={`add-date-${staffId}`} type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} required className={INPUT} />
      <input id={`add-in-${staffId}`} type="time" value={form.clock_in} onChange={(e) => setForm({ ...form, clock_in: e.target.value })} required className={INPUT} aria-label="출근" />
      <input id={`add-out-${staffId}`} type="time" value={form.clock_out} onChange={(e) => setForm({ ...form, clock_out: e.target.value })} className={INPUT} aria-label="퇴근" />
      <input id={`add-memo-${staffId}`} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="사유 (예: 폰 안 가져옴)" className={`${INPUT} flex-1 min-w-[140px]`} />
      <button type="button" onClick={onCancel} className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
      <button type="submit" disabled={!form.clock_in} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">저장</button>
    </form>
  )
}

// ── 고정급·주휴수당·기타 (수기 항목) — 그 직원 줄 안에서 넣고 빼기
function ItemsEditor({ year, month, staffId, staffName, items }: { year: number; month: number; staffId: number | null; staffName: string; items: PayrollItem[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ kind: (staffId == null ? 'fixed_salary' : 'weekly_holiday_pay') as PayrollItem['kind'], amount: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const label = form.label.trim() || (staffId == null ? KIND_LABEL[form.kind] : `${staffName} ${KIND_LABEL[form.kind]}`)
    const res = await fetch('/api/attendance/payroll-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, kind: form.kind, label, amount: form.amount, staff_id: staffId }),
    })
    setSaving(false)
    if (res.ok) {
      setForm({ ...form, amount: '', label: '' })
      router.refresh()
    }
  }

  async function remove(id: number) {
    setConfirmId(null)
    await fetch('/api/attendance/payroll-items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    router.refresh()
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 py-1.5">고정급 · 주휴수당 · 기타</p>
      {items.length > 0 && (
        <ul className="bg-white rounded-lg divide-y divide-gray-50 mb-2">
          {items.map((i) => (
            <li key={i.id} className="px-3 py-1.5 flex items-center gap-3 text-xs">
              <span className="text-gray-400 w-14 shrink-0">{KIND_LABEL[i.kind]}</span>
              <span className="text-gray-900 flex-1">{i.label}</span>
              <span className="tabular-nums text-gray-900">{won(i.amount)}원</span>
              {confirmId === i.id ? (
                <button onClick={() => remove(i.id)} className="text-red-500 font-semibold">삭제</button>
              ) : (
                <button onClick={() => setConfirmId(i.id)} className="text-gray-300 hover:text-red-400" aria-label={`${i.label} 삭제`}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap gap-2 items-center">
        <select id={`item-kind-${staffId ?? 'common'}`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PayrollItem['kind'] })} className={INPUT}>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input id={`item-amount-${staffId ?? 'common'}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="금액" inputMode="numeric" required className={`${INPUT} w-28`} />
        <input id={`item-label-${staffId ?? 'common'}`} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={staffId == null ? '이름 (예: 점장 고정급)' : '메모 (선택)'} required={staffId == null} className={`${INPUT} flex-1 min-w-[120px]`} />
        <button type="submit" disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">+ 추가</button>
      </form>
    </div>
  )
}
