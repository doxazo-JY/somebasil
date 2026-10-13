'use client'

import type { WorkShift, WorklogStaff, WorklogPayrollItem } from '@/lib/worklog-parser'

// 근무일지 미리보기 — 직원 × 월 근무시간/지급액 표

interface WorklogPreviewProps {
  shifts: WorkShift[]
  staff: WorklogStaff[]
  months: string[]
  payrollItems: WorklogPayrollItem[]
  warnings: string[]
  saving: boolean
  onSave: () => void
}

function manwon(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만`
}

export default function WorklogPreview({ shifts, staff, months, payrollItems, warnings, saving, onSave }: WorklogPreviewProps) {
  // 직원 × 월 집계
  const cell = new Map<string, { hours: number; pay: number }>()
  const monthTotal = new Map<string, number>()
  for (const s of shifts) {
    const ym = s.date.slice(0, 7)
    const key = `${s.name}|${ym}`
    const cur = cell.get(key) ?? { hours: 0, pay: 0 }
    cur.hours += s.hours
    cur.pay += s.hours * s.rate
    cell.set(key, cur)
    monthTotal.set(ym, (monthTotal.get(ym) ?? 0) + s.hours * s.rate)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">파싱 결과</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {months[0]} ~ {months[months.length - 1]} · 직원 {staff.length}명 · 근무 {shifts.length}건
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4 whitespace-pre-line">
          {warnings.join('\n')}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium pb-2 pr-3">직원</th>
              {months.map((ym) => (
                <th key={ym} className="text-right font-medium pb-2 px-2 whitespace-nowrap">
                  {Number(ym.slice(5))}월
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.name} className="border-b border-gray-50">
                <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{p.name}</td>
                {months.map((ym) => {
                  const c = cell.get(`${p.name}|${ym}`)
                  return (
                    <td key={ym} className="py-2 px-2 text-right tabular-nums text-gray-500 whitespace-nowrap">
                      {c ? `${Math.round(c.hours)}h` : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="pt-2 pr-3 text-gray-400">지급액 합계</td>
              {months.map((ym) => (
                <td key={ym} className="pt-2 px-2 text-right tabular-nums font-semibold text-gray-800">
                  {manwon(monthTotal.get(ym) ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {payrollItems.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-1.5">인건비 수기 항목 (각 시트의 &quot;총 인건비&quot; 칸)</p>
          <ul className="text-xs text-gray-600 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
            {payrollItems.map((p, i) => (
              <li key={i} className="flex justify-between gap-2 tabular-nums">
                <span className="text-gray-400">{Number(p.month.slice(5))}월</span>
                <span className="flex-1 truncate">{p.label}</span>
                <span>{p.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 [word-break:keep-all]">
        저장하면 처음 보는 이름은 알바생으로 자동 등록됩니다. 같은 달을 다시 올리면 그 달 기록을 새 파일로 교체합니다.
        지급액은 근무시간 × 시급 (주휴수당 제외). 고정급·주휴 줄은 직원 &gt; 근무 탭의 수기 항목으로 들어갑니다.
      </p>
    </div>
  )
}
