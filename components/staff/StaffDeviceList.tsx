'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import type { StaffRow } from '@/lib/supabase/queries/attendance-admin'

const ROLE_LABEL: Record<StaffRow['role'], string> = { manager: '점장', assistant: '매니저', part_time: '알바생' }

function fmtDay(iso: string | null) {
  if (!iso) return '사용 기록 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(iso)) + ' 마지막 사용'
}

// 직원 목록 + 등록된 폰 + 폰 교체용 연결 QR
export default function StaffDeviceList({ staff }: { staff: StaffRow[] }) {
  const router = useRouter()
  const [linkFor, setLinkFor] = useState<StaffRow | null>(null)

  async function patchStaff(id: number, updates: object) {
    await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    router.refresh()
  }

  async function revoke(deviceId: number) {
    if (!confirm('이 폰의 등록을 해제할까요? 해제한 폰으로는 출퇴근을 찍을 수 없어요.')) return
    await fetch('/api/attendance/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">직원과 등록된 폰</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
          새 직원은 카운터 QR을 처음 찍을 때 자동으로 추가돼요. 폰을 바꾼 직원은 [연결 QR]을 눌러 새 폰으로 찍게 해 주세요.
        </p>
      </div>
      {staff.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">아직 등록된 직원이 없어요</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {staff.map((s) => (
            <li key={s.id} className={`px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${s.is_active ? '' : 'opacity-50'}`}>
              <div className="min-w-[120px]">
                <p className="text-sm text-gray-900 font-medium">{s.name}</p>
                <p className="text-[11px] text-gray-400">{s.is_active ? `${s.hire_date} 등록` : '퇴사'}</p>
              </div>
              <select
                id={`role-${s.id}`}
                value={s.role}
                onChange={(e) => patchStaff(s.id, { role: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
                aria-label="직책"
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex-1 min-w-[200px] flex flex-wrap gap-2">
                {s.devices.length === 0 ? (
                  <span className="text-xs text-gray-400">등록된 폰 없음</span>
                ) : (
                  s.devices.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1.5 text-xs border border-gray-200 rounded-full pl-2.5 pr-1 py-0.5 text-gray-600">
                      {d.label ?? '기기'} · <span className="text-gray-400">{fmtDay(d.last_used_at)}</span>
                      <button onClick={() => revoke(d.id)} className="w-5 h-5 rounded-full hover:bg-gray-100 text-gray-400" aria-label={`${d.label} 등록 해제`}>×</button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                {s.is_active && (
                  <button onClick={() => setLinkFor(s)} className="text-xs px-3 py-1.5 rounded-lg border border-[#1a5c3a] text-[#1a5c3a] hover:bg-[#e6f0ea]">
                    연결 QR
                  </button>
                )}
                <button
                  onClick={() => {
                    if (s.is_active && !confirm(`${s.name}님을 퇴사 처리할까요? 출퇴근을 더 찍을 수 없게 되고, 기록은 남아요.`)) return
                    patchStaff(s.id, s.is_active ? { is_active: false, leave_date: new Date().toISOString().slice(0, 10) } : { is_active: true, leave_date: null })
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                >
                  {s.is_active ? '퇴사 처리' : '복직'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {linkFor && <LinkQrModal staff={linkFor} onClose={() => { setLinkFor(null); router.refresh() }} />}
    </div>
  )
}

// 연결 QR — 10분, 1회용
function LinkQrModal({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/attendance/link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.id }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(async (data: { url: string; expires_at: string }) => {
        const img = await QRCode.toDataURL(data.url, { width: 320, margin: 2 })
        if (cancelled) return
        setQr(img)
        setExpiresAt(new Date(data.expires_at).getTime())
      })
      .catch(() => !cancelled && setError(true))
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [staff.id])

  const left = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null
  const expired = left === 0

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs p-6 text-center space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-gray-900">{staff.name}님 폰 연결</p>
        {error ? (
          <p className="text-xs text-red-500 py-10">연결 QR을 만들지 못했어요</p>
        ) : !qr ? (
          <p className="text-xs text-gray-400 py-16">만드는 중…</p>
        ) : expired ? (
          <p className="text-xs text-gray-500 py-16">시간이 지나 QR이 만료됐어요. 닫고 다시 만들어 주세요.</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`${staff.name}님 폰 연결 QR`} className="mx-auto w-56 h-56" />
            <p className="text-xs text-gray-500 [word-break:keep-all]">
              {staff.name}님이 새 폰 기본 카메라로 찍으면 연결돼요. 한 번만 쓸 수 있어요.
            </p>
            <p className="text-xs text-gray-400 tabular-nums">
              {Math.floor((left ?? 0) / 60)}:{String((left ?? 0) % 60).padStart(2, '0')} 남음
            </p>
          </>
        )}
        <button onClick={onClose} className="w-full text-xs py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">닫기</button>
      </div>
    </div>
  )
}
