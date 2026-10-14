import Link from 'next/link'
import type { Timesheet } from '@/lib/supabase/queries/attendance-admin'
import { fmtWorkDate } from '@/lib/attendance/format'

// 근무 탭 맨 위 — 기준 기록 한 줄 + 이번 달 숫자 카드 + 근무일지 엑셀

const won = (n: number) => n.toLocaleString('ko-KR')
const hours = (min: number) => `${Math.round((min / 60) * 10) / 10}시간`

export default function MonthOverview({ ts }: { ts: Timesheet }) {
  const totalMin = [ts.weekday, ts.sunday].reduce((s, b) => s + Object.values(b.totals).reduce((x, t) => x + t.minutes, 0), 0)
  const people = new Set([...ts.weekday.staff, ...ts.sunday.staff].map((s) => s.id)).size
  const paperDays = new Set(ts.shifts.filter((s) => s.source === 'paper').map((s) => `${s.staff_id}|${s.work_date}`)).size
  const qrDays = new Set(ts.shifts.filter((s) => s.source === 'qr').map((s) => `${s.staff_id}|${s.work_date}`)).size
  const sourceSub = paperDays || qrDays ? [paperDays && `종이 ${paperDays}건`, qrDays && `QR ${qrDays}건`].filter(Boolean).join(' · ') : '기록 없음'

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 [word-break:keep-all]">
        기준 기록: <span className="font-semibold text-gray-800">{ts.priority === 'paper' ? '종이 우선' : 'QR 우선'}</span>
        <span className="text-gray-400"> · 같은 날 둘 다 있으면 {ts.priority === 'paper' ? '종이 근무일지' : 'QR 기록'}, 한쪽만 있으면 있는 쪽 · </span>
        <Link href="/staff?view=settings" className="text-[#1a5c3a] hover:underline">바꾸기</Link>
      </p>
      {ts.missingRateDates.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3">
          <p className="text-xs text-amber-800 [word-break:keep-all]">
            시급이 등록되지 않은 날짜가 있어 지급액에서 빠졌어요: {ts.missingRateDates.map(fmtWorkDate).join(', ')}. 직원·설정 탭에서 시급을 추가해 주세요.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label={`${ts.month}월 근무시간`} value={hours(totalMin)} sub={sourceSub} />
        <Card label={`${ts.month}월 인건비(세전)`} value={`${won(ts.total)}원`} sub="고정급·주휴 포함" />
        <Card label="근무 인원" value={`${people}명`} sub="알바생" />
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
