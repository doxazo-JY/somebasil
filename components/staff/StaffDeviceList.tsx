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
  const [deleteFor, setDeleteFor] = useState<StaffRow | null>(null)
  // 퇴사·폰 해제는 화면 안에서 한 번 더 눌러 확인 (브라우저 확인창은 막혀 있으면 아무 일도 안 일어나서 쓰지 않음)
  const [confirmLeave, setConfirmLeave] = useState<number | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patchStaff(id: number, updates: object) {
    setError(null)
    const res = await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(() => null)
    if (!res?.ok) setError('저장하지 못했어요. 다시 시도해 주세요.')
    router.refresh()
  }

  async function revoke(deviceId: number) {
    setError(null)
    setConfirmRevoke(null)
    const res = await fetch('/api/attendance/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    }).catch(() => null)
    if (!res?.ok) setError('폰 등록을 해제하지 못했어요. 다시 시도해 주세요.')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">직원</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
          새 직원은 카운터 QR을 처음 찍을 때 자동으로 추가돼요. 이미 목록에 있는 직원(근무일지로 들어온 직원 포함)이나 폰을 바꾼 직원은 [연결 QR]을 눌러 그 폰으로 찍게 해 주세요.
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      {staff.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">아직 등록된 직원이 없어요</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {staff.map((s) => (
            <li key={s.id} className={`px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${s.is_active ? '' : 'opacity-50'}`}>
              <div className="min-w-[120px]">
                <p className="text-sm text-gray-900 font-medium">{s.name}</p>
                <p className="text-[11px] text-gray-400 tabular-nums">
                  {s.is_active ? `${s.hire_date} 입사` : '퇴사'}
                  {s.hourly_pay > 0 && ` · 시급 ${s.hourly_pay.toLocaleString('ko-KR')}`}
                </p>
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
                      {confirmRevoke === d.id ? (
                        <>
                          <button onClick={() => revoke(d.id)} className="px-1.5 rounded-full bg-red-500 text-white">해제</button>
                          <button onClick={() => setConfirmRevoke(null)} className="px-1.5 rounded-full hover:bg-gray-100 text-gray-500">취소</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmRevoke(d.id)} className="w-5 h-5 rounded-full hover:bg-gray-100 text-gray-400" aria-label={`${d.label} 등록 해제`}>×</button>
                      )}
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
                {confirmLeave === s.id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    퇴사 처리할까요? 기록은 남아요
                    <button
                      onClick={() => {
                        setConfirmLeave(null)
                        patchStaff(s.id, { is_active: false, leave_date: new Date().toISOString().slice(0, 10) })
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
                    >
                      퇴사
                    </button>
                    <button onClick={() => setConfirmLeave(null)} className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
                  </span>
                ) : (
                  <button
                    onClick={() => (s.is_active ? setConfirmLeave(s.id) : patchStaff(s.id, { is_active: true, leave_date: null }))}
                    className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                  >
                    {s.is_active ? '퇴사 처리' : '복직'}
                  </button>
                )}
                <button
                  onClick={() => setDeleteFor(s)}
                  className="text-xs px-3 py-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {linkFor && <LinkQrModal staff={linkFor} onClose={() => { setLinkFor(null); router.refresh() }} />}
      {deleteFor && (
        <DeleteStaffModal
          staff={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleted={() => { setDeleteFor(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// 직원 삭제 — 이름을 다시 입력해야 삭제. 같이 지워지는 기록 건수를 먼저 보여 줌
const RELATED_LABEL: Record<string, string> = {
  attendance_logs: 'QR 출퇴근 기록',
  work_logs: '근무일지(업로드) 기록',
  staff_salary: '월별 지급액',
  staff_devices: '등록된 폰',
  payroll_items: '인건비 수기 항목',
}

function DeleteStaffModal({ staff, onClose, onDeleted }: { staff: StaffRow; onClose: () => void; onDeleted: () => void }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/attendance/staff?staff_id=${staff.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setCounts)
      .catch(() => setError('기록 건수를 불러오지 못했어요'))
  }, [staff.id])

  const related = counts ? Object.entries(counts).filter(([, n]) => n > 0) : []
  const matches = typed.trim() === staff.name.trim()

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const res = await fetch('/api/attendance/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staff.id, confirm_name: typed }),
    })
    if (res.ok) return onDeleted()
    setDeleting(false)
    setError('삭제하지 못했어요. 다시 시도해 주세요.')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{staff.name}님을 삭제할까요?</p>
          <p className="text-xs text-gray-500 [word-break:keep-all]">
            되돌릴 수 없어요. 테스트로 만든 직원이 아니라면 [퇴사 처리]를 써 주세요.
          </p>
        </div>

        <div className="text-xs rounded-lg bg-gray-50 px-3 py-2.5 space-y-1">
          {!counts && !error && <p className="text-gray-400">같이 지워지는 기록 확인 중…</p>}
          {counts && related.length === 0 && <p className="text-gray-500">같이 지워지는 기록이 없어요</p>}
          {related.length > 0 && (
            <>
              <p className="text-red-600 font-medium">같이 지워지는 기록</p>
              {related.map(([table, n]) => (
                <p key={table} className="text-gray-700 flex justify-between">
                  <span>{RELATED_LABEL[table] ?? table}</span>
                  <span className="tabular-nums">{n}건</span>
                </p>
              ))}
            </>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-gray-500">확인을 위해 이름 <b className="text-gray-900">{staff.name}</b>을(를) 입력해 주세요</span>
          <input
            id={`delete-confirm-${staff.id}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
          <button
            onClick={handleDelete}
            disabled={!matches || !counts || deleting}
            className="text-xs px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
          >
            {deleting ? '삭제하는 중…' : '삭제'}
          </button>
        </div>
      </div>
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
