'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Timesheet, TimesheetBlock, PayrollItem } from '@/lib/supabase/queries/attendance-admin'
import { fmtWorkDate } from '@/lib/attendance/format'

const KIND_LABEL: Record<PayrollItem['kind'], string> = { fixed_salary: '고정급', weekly_holiday_pay: '주휴수당', other: '기타' }
const won = (n: number) => n.toLocaleString('ko-KR')
const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'

// 월 근무일지 요약 + 인건비 수기 항목 + 엑셀 다운로드
export default function TimesheetPanel({ ts, staffOptions }: { ts: Timesheet; staffOptions: { id: number; name: string }[] }) {
  const warnings: string[] = []
  if (ts.openCount > 0) warnings.push(`퇴근 기록이 없는 근무 ${ts.openCount}건이 근무시간에서 빠져 있어요. 출퇴근 기록 탭에서 퇴근 시간을 넣어 주세요.`)
  if (ts.missingRateDates.length > 0) warnings.push(`시급이 등록되지 않은 날짜가 있어 지급액에서 빠졌어요: ${ts.missingRateDates.map(fmtWorkDate).join(', ')}. QR·시급 탭에서 시급을 추가해 주세요.`)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{ts.month}월분 총 인건비(세전)</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{won(ts.total)}원</p>
          <p className="text-xs text-gray-400 mt-0.5">평일 {won(ts.weekday.pay)} · 주일 {won(ts.sunday.pay)} · 수기 항목 {won(ts.payrollItems.reduce((s, i) => s + i.amount, 0))}</p>
        </div>
        <a
          href={`/api/attendance/export?year=${ts.year}&month=${ts.month}`}
          className="text-xs px-4 py-2 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30]"
        >
          근무일지 엑셀 내려받기
        </a>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 space-y-1">
          {warnings.map((w) => <p key={w} className="text-xs text-amber-800 [word-break:keep-all]">{w}</p>)}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <BlockSummary title="평일 근무" hourly={ts.rates.weekday} block={ts.weekday} />
        <BlockSummary title="주일 근무" hourly={ts.rates.sunday} block={ts.sunday} />
      </div>

      <PayrollItems year={ts.year} month={ts.month} items={ts.payrollItems} staffOptions={staffOptions} />
    </div>
  )
}

function BlockSummary({ title, hourly, block }: { title: string; hourly: number | null; block: TimesheetBlock }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-baseline">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400">시급 {hourly ? won(hourly) : '미등록'}</p>
      </div>
      {block.staff.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">기록 없음</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="text-left px-5 py-2 font-medium">직원</th>
              <th className="text-right px-3 py-2 font-medium">근무일수</th>
              <th className="text-right px-3 py-2 font-medium">근무시간</th>
              <th className="text-right px-5 py-2 font-medium">지급액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {block.staff.map((s) => {
              const t = block.totals[s.id]
              return (
                <tr key={s.id}>
                  <td className="px-5 py-2 text-gray-900">{s.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.days}일</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(t.minutes / 60).toFixed(1)}시간</td>
                  <td className="px-5 py-2 text-right tabular-nums">{won(t.pay)}</td>
                </tr>
              )
            })}
            <tr className="bg-gray-50/60 font-semibold">
              <td className="px-5 py-2" colSpan={3}>합계</td>
              <td className="px-5 py-2 text-right tabular-nums">{won(block.pay)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

function PayrollItems({ year, month, items, staffOptions }: { year: number; month: number; items: PayrollItem[]; staffOptions: { id: number; name: string }[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ kind: 'fixed_salary' as PayrollItem['kind'], label: '', amount: '', staff_id: '' })
  const [saving, setSaving] = useState(false)

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
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">수기 항목</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">점장·매니저 고정급, 주휴수당처럼 출퇴근으로 계산되지 않는 금액. 근무일지 요약에 그대로 들어가요</p>
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
      <form onSubmit={add} className="px-5 py-3 border-t border-gray-50 grid grid-cols-2 md:grid-cols-5 gap-2">
        <select id="payroll-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PayrollItem['kind'] })} className={INPUT}>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select id="payroll-staff" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} className={INPUT}>
          <option value="">직원 선택 (선택)</option>
          {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input id="payroll-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="이름 (예: 점장, ○○ 주휴)" required className={INPUT} />
        <input id="payroll-amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="금액" inputMode="numeric" required className={INPUT} />
        <button type="submit" disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">+ 추가</button>
      </form>
    </div>
  )
}
