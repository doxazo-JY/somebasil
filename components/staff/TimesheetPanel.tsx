'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Timesheet, PayrollItem } from '@/lib/supabase/queries/attendance-admin'
import { fmtWorkDate } from '@/lib/attendance/format'

// 근무 탭의 월 정리 부분 — QR 기록 시작일 전은 종이 근무일지, 이후는 QR 출퇴근
//   MonthOverview: 경고 + 숫자 카드 + 근무일지 엑셀
//   default(TimesheetPanel): 직원별 합계 + 수기 항목

const KIND_LABEL: Record<PayrollItem['kind'], string> = { fixed_salary: '고정급', weekly_holiday_pay: '주휴수당', other: '기타' }
const won = (n: number) => n.toLocaleString('ko-KR')
const hours = (min: number) => `${Math.round((min / 60) * 10) / 10}시간`
const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'

// 평일·주일 블록을 직원 한 줄로 합침
function staffRows(ts: Timesheet) {
  const rows = new Map<number, { name: string; days: number; weekdayMin: number; sundayMin: number; pay: number }>()
  for (const [block, key] of [[ts.weekday, 'weekdayMin'], [ts.sunday, 'sundayMin']] as const) {
    for (const s of block.staff) {
      const t = block.totals[s.id]
      const row = rows.get(s.id) ?? { name: s.name, days: 0, weekdayMin: 0, sundayMin: 0, pay: 0 }
      row.days += t.days
      row[key] += t.minutes
      row.pay += t.pay
      rows.set(s.id, row)
    }
  }
  return [...rows.values()]
}

// 이 달 숫자의 출처 (QR 기록 시작일 기준)
function sourceLabel(ts: Timesheet): string {
  const first = ts.dates[0]
  const last = ts.dates[ts.dates.length - 1]
  if (!ts.qrStart || ts.qrStart > last) return '종이 근무일지 기준'
  if (ts.qrStart <= first) return 'QR 출퇴근 기준'
  const [, m, d] = ts.qrStart.split('-').map(Number)
  return `${m}/${d - 1}까지 종이 · ${m}/${d}부터 QR`
}

export function MonthOverview({ ts }: { ts: Timesheet }) {
  const rows = staffRows(ts)
  const totalMin = rows.reduce((s, r) => s + r.weekdayMin + r.sundayMin, 0)
  const source = sourceLabel(ts)

  return (
    <div className="space-y-3">
      {ts.missingRateDates.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3">
          <p className="text-xs text-amber-800 [word-break:keep-all]">
            시급이 등록되지 않은 날짜가 있어 지급액에서 빠졌어요: {ts.missingRateDates.map(fmtWorkDate).join(', ')}. 직원·설정 탭에서 시급을 추가해 주세요.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label={`${ts.month}월 근무시간`} value={hours(totalMin)} sub={source} />
        <Card label={`${ts.month}월 인건비(세전)`} value={`${won(ts.total)}원`} sub="수기 항목 포함" />
        <Card label="근무 인원" value={`${rows.length}명`} sub="알바생" />
        <a
          href={`/api/attendance/export?year=${ts.year}&month=${ts.month}`}
          className="rounded-xl bg-[#1a5c3a] text-white hover:bg-[#154d30] px-5 py-4 flex flex-col justify-center"
        >
          <span className="text-sm font-semibold">근무일지 엑셀</span>
          <span className="text-xs text-white/70 mt-0.5">{ts.month}월까지 누적 · 세무사 전달용</span>
        </a>
      </div>
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function TimesheetPanel({ ts, staffOptions }: { ts: Timesheet; staffOptions: { id: number; name: string }[] }) {
  const rows = staffRows(ts)
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-baseline gap-3">
          <p className="text-sm font-semibold text-gray-800">직원별 합계</p>
          <p className="text-xs text-gray-400">
            시급 평일 {ts.rates.weekday ? won(ts.rates.weekday) : '미등록'} · 주일 {ts.rates.sunday ? won(ts.rates.sunday) : '미등록'}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 [word-break:keep-all]">
            이 달 근무 기록이 없어요{!ts.qrStart && ' · 종이 근무일지를 업로드하면 채워져요'}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-400">
              <tr>
                <th className="text-left px-5 py-2 font-medium">직원</th>
                <th className="text-right px-3 py-2 font-medium">근무일수</th>
                <th className="text-right px-3 py-2 font-medium">평일</th>
                <th className="text-right px-3 py-2 font-medium">주일</th>
                <th className="text-right px-5 py-2 font-medium">지급액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-5 py-2 text-gray-900">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.days}일</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.weekdayMin ? hours(r.weekdayMin) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.sundayMin ? hours(r.sundayMin) : '—'}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{won(r.pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <PayrollItems year={ts.year} month={ts.month} items={ts.payrollItems} staffOptions={staffOptions} />
    </div>
  )
}

function PayrollItems({ year, month, items, staffOptions }: { year: number; month: number; items: PayrollItem[]; staffOptions: { id: number; name: string }[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ kind: 'fixed_salary' as PayrollItem['kind'], label: '', amount: '', staff_id: '' })
  const [saving, setSaving] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const prevMonth = month === 1 ? 12 : month - 1

  async function copyPrev() {
    setSaving(true)
    setCopyMsg(null)
    const res = await fetch('/api/attendance/payroll-items/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setCopyMsg('가져오지 못했어요')
    setCopyMsg(
      data.copied > 0
        ? `${prevMonth}월 고정급 ${data.copied}건을 가져왔어요`
        : data.found > 0 ? '이미 다 들어 있어요' : `${prevMonth}월에 고정급 항목이 없어요`
    )
    router.refresh()
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/attendance/payroll-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, ...form, staff_id: form.staff_id || null }),
    })
    setSaving(false)
    if (res.ok) {
      setForm({ ...form, label: '', amount: '', staff_id: '' })
      router.refresh()
    }
  }

  async function remove(id: number) {
    if (!confirm('이 항목을 삭제할까요?')) return
    await fetch('/api/attendance/payroll-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">수기 항목</p>
          <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">점장·매니저 고정급, 주휴수당처럼 출퇴근으로 계산되지 않는 금액. 인건비와 근무일지 엑셀에 포함돼요</p>
          {copyMsg && <p className="text-xs text-[#1a5c3a] mt-1">{copyMsg}</p>}
        </div>
        <button
          onClick={copyPrev}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {prevMonth}월 고정급 가져오기
        </button>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {items.map((i) => (
            <li key={i.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <span className="text-gray-400 w-14 shrink-0">{KIND_LABEL[i.kind]}</span>
              <span className="text-gray-900 flex-1">{i.label}</span>
              <span className="tabular-nums text-gray-900">{won(i.amount)}원</span>
              <button onClick={() => remove(i.id)} className="text-gray-300 hover:text-red-400" aria-label={`${i.label} 삭제`}>×</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="px-5 py-3 border-t border-gray-50 grid grid-cols-2 gap-2">
        <select id="payroll-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PayrollItem['kind'] })} className={INPUT}>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select id="payroll-staff" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} className={INPUT}>
          <option value="">직원 선택 (선택)</option>
          {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input id="payroll-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="이름 (예: 점장, ○○ 주휴)" required className={INPUT} />
        <input id="payroll-amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="금액" inputMode="numeric" required className={INPUT} />
        <button type="submit" disabled={saving} className="col-span-2 text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">+ 추가</button>
      </form>
    </div>
  )
}
