'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import type { PayRate, SourcePriority } from '@/lib/supabase/queries/attendance-admin'

const INPUT = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'

// 기준 기록 + 카운터 QR + 매장 공통 시급 (직원·설정 탭 아래쪽)
export default function AttendanceSettings({ qrSecret, rates, priority }: { qrSecret: string | null; rates: PayRate[]; priority: SourcePriority }) {
  return (
    <div className="space-y-4">
      <SourcePriorityPicker priority={priority} />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <CounterQr qrSecret={qrSecret} />
        <PayRates rates={rates} />
      </div>
    </div>
  )
}

// 같은 날 종이 근무일지와 QR이 둘 다 있으면 어느 쪽으로 계산할지 (한쪽에만 있으면 있는 쪽)
function SourcePriorityPicker({ priority }: { priority: SourcePriority }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function save(value: SourcePriority) {
    if (value === priority) return
    setSaving(true)
    await fetch('/api/attendance/source-priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: value }),
    })
    setSaving(false)
    router.refresh()
  }

  const options: { key: SourcePriority; label: string; hint: string }[] = [
    { key: 'paper', label: '종이 우선', hint: 'QR과 병행하는 동안' },
    { key: 'qr', label: 'QR 우선', hint: 'QR로 넘어갈 때' },
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-[240px]">
        <p className="text-sm font-semibold text-gray-800">기준 기록</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
          같은 날 종이 근무일지와 QR 기록이 둘 다 있으면 어느 쪽으로 인건비·근무일지 엑셀을 만들지 정해요. 한쪽에만 있는 날은 있는 쪽을 써요.
        </p>
      </div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => save(o.key)}
            disabled={saving}
            aria-pressed={priority === o.key}
            className={`text-xs px-3 py-1.5 rounded-lg text-left ${priority === o.key ? 'bg-[#1a5c3a] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <span className="font-semibold">{o.label}</span>
            <span className={`block text-[10px] ${priority === o.key ? 'text-white/70' : 'text-gray-400'}`}>{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CounterQr({ qrSecret }: { qrSecret: string | null }) {
  const router = useRouter()
  const [qr, setQr] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!qrSecret) return
    // 직원용 주소가 있으면 그 주소로 (proxy.ts 참고) — 관리용 주소가 QR에 들어가지 않게
    const origin = process.env.NEXT_PUBLIC_CLOCK_ORIGIN || window.location.origin
    const url = `${origin}/clock?k=${encodeURIComponent(qrSecret)}`
    QRCode.toDataURL(url, { width: 720, margin: 2 }).then(setQr)
  }, [qrSecret])

  async function rotate() {
    await fetch('/api/attendance/qr-secret', { method: 'POST' })
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">카운터 QR</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">출력해서 카운터에 붙여 주세요. 직원은 휴대폰 기본 카메라로 찍으면 돼요</p>
      </div>
      <div className="px-5 py-5 flex flex-col items-center gap-3">
        {!qrSecret ? (
          <p className="text-xs text-red-500 py-8 [word-break:keep-all]">QR 비밀값이 없어요. 아래 [새 QR로 교체]를 눌러 만들어 주세요.</p>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="카운터 출퇴근 QR" className="w-56 h-56" />
            <a href={qr} download="썸바실_출퇴근_QR.png" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              QR 이미지 저장 (인쇄용)
            </a>
          </>
        ) : (
          <p className="text-xs text-gray-400 py-16">만드는 중…</p>
        )}
      </div>
      <div className="px-5 py-3 border-t border-gray-50">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 [word-break:keep-all]">
              지금 붙어 있는 QR(사진으로 찍어 간 것 포함)이 바로 안 돼요. 새 QR을 출력해서 다시 붙여야 해요. 직원 폰 등록은 그대로 유지돼요.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirming(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
              <button onClick={rotate} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">교체하기</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-xs text-gray-400 hover:text-gray-600">
            새 QR로 교체 (QR이 유출됐을 때)
          </button>
        )}
      </div>
    </div>
  )
}

function PayRates({ rates }: { rates: PayRate[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ effective_from: '', weekday_hourly: '', sunday_hourly: '' })

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/attendance/pay-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        effective_from: form.effective_from,
        weekday_hourly: Number(form.weekday_hourly.replace(/,/g, '')),
        sunday_hourly: Number(form.sunday_hourly.replace(/,/g, '')),
      }),
    })
    if (res.ok) {
      setForm({ effective_from: '', weekday_hourly: '', sunday_hourly: '' })
      router.refresh()
    }
  }

  async function remove(effectiveFrom: string) {
    if (!confirm(`${effectiveFrom}부터 적용되는 시급을 삭제할까요?`)) return
    await fetch('/api/attendance/pay-rates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effective_from: effectiveFrom }),
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">시급</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">매장 공통. 시급이 바뀌면 적용 시작일과 함께 추가하세요. 지난 달 근무일지는 그때 시급으로 계산돼요</p>
      </div>
      <table className="w-full text-xs">
        <thead className="text-gray-400">
          <tr>
            <th className="text-left px-5 py-2 font-medium">적용 시작</th>
            <th className="text-right px-3 py-2 font-medium">평일</th>
            <th className="text-right px-3 py-2 font-medium">주일</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rates.map((r) => (
            <tr key={r.effective_from}>
              <td className="px-5 py-2 tabular-nums">{r.effective_from}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.weekday_hourly.toLocaleString('ko-KR')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.sunday_hourly.toLocaleString('ko-KR')}</td>
              <td className="px-2 text-center">
                <button onClick={() => remove(r.effective_from)} className="text-gray-300 hover:text-red-400" aria-label={`${r.effective_from} 시급 삭제`}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="px-5 py-3 border-t border-gray-50 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input id="rate-from" type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} required className={INPUT} />
        <input id="rate-weekday" value={form.weekday_hourly} onChange={(e) => setForm({ ...form, weekday_hourly: e.target.value })} placeholder="평일 시급" inputMode="numeric" required className={INPUT} />
        <input id="rate-sunday" value={form.sunday_hourly} onChange={(e) => setForm({ ...form, sunday_hourly: e.target.value })} placeholder="주일 시급" inputMode="numeric" required className={INPUT} />
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30]">+ 추가</button>
      </form>
    </div>
  )
}
