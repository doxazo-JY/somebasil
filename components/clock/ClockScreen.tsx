'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClockStatus, MyLog, PunchResult } from '@/lib/supabase/queries/attendance'
import { fmtDuration, fmtHm, fmtTime, fmtWorkDate } from '@/lib/attendance/format'
import ClockShell, { CheckMark } from './ClockShell'

type Status = ClockStatus & { invalid_qr?: boolean }
type Done = Extract<PunchResult, { ok: true }>

// 오류 코드 → 직원에게 보여줄 문구
const ERROR_TEXT: Record<string, string> = {
  need_qr: 'QR을 찍은 지 3분이 지났어요. 카운터 QR을 다시 찍어 주세요.',
  already_in: '이미 출근 처리돼 있어요.',
  not_in: '이미 퇴근 처리돼 있어요.',
  already_open_today: '오늘 퇴근 전 기록이 이미 있어요. 점장님께 알려 주세요.',
  name_taken: '이미 직원 목록에 있는 이름이에요. 점장님께 연결 QR을 요청해서 그 QR을 찍어 주세요.',
  invalid_name: '이름을 1~20자로 입력해 주세요.',
  already_registered: '이 폰은 이미 등록되어 있어요.',
}
const FALLBACK_ERROR = '잠시 문제가 생겼어요. 다시 시도해 보고, 계속 안 되면 점장님께 알려 주세요.'

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'unknown')
  return data as T
}

// 1초마다 현재 시각 (입장권 남은 시간, 근무 경과 표시용)
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function ClockScreen({ qrKey }: { qrKey: string }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const started = useRef(false)
  const now = useNow()

  const refresh = useCallback(async (k?: string) => {
    try {
      setStatus(await post<Status>('/api/clock', { k }))
    } catch {
      setLoadError(true)
    }
  }, [])

  // 처음 열 때: QR로 들어왔으면 비밀값으로 입장권 받고, 주소에서 비밀값을 지움
  // → 열어 둔 탭을 새로고침해도 입장권이 다시 나오지 않음
  useEffect(() => {
    if (started.current) return
    started.current = true
    refresh(qrKey || undefined).then(() => {
      if (qrKey) window.history.replaceState(null, '', '/clock')
    })
  }, [qrKey, refresh])

  async function handlePunch(action: 'in' | 'out') {
    setBusy(true)
    setError(null)
    try {
      setDone(await post<Done>('/api/clock/punch', { action }))
    } catch (e) {
      setError(ERROR_TEXT[(e as Error).message] ?? FALLBACK_ERROR)
    }
    await refresh()
    setBusy(false)
  }

  if (loadError) {
    return (
      <ClockShell>
        <p className="text-sm text-gray-500 text-center py-16 [word-break:keep-all]">{FALLBACK_ERROR}</p>
      </ClockShell>
    )
  }
  if (!status) {
    return (
      <ClockShell>
        <p className="text-sm text-gray-400 text-center py-16">확인하고 있어요…</p>
      </ClockShell>
    )
  }

  const ticketLeft = status.ticket_expires_at ? Math.max(0, Math.floor((status.ticket_expires_at - now) / 1000)) : 0
  const canPunch = status.can_punch && ticketLeft > 0

  return (
    <ClockShell>
      {status.invalid_qr && (
        <p className="text-xs text-red-500 [word-break:keep-all]">QR이 올바르지 않아요. 카운터에 붙은 QR을 다시 찍어 주세요.</p>
      )}

      {!status.registered ? (
        canPunch ? (
          <RegisterForm onDone={() => refresh()} />
        ) : (
          <div className="py-10 text-center space-y-2">
            <p className="text-base font-semibold text-gray-900">등록된 폰이 아니에요</p>
            <p className="text-sm text-gray-500 [word-break:keep-all]">
              처음이라면 매장 카운터의 QR을 찍어 등록해 주세요. 폰을 바꿨다면 점장님께 연결 QR을 요청해 주세요.
            </p>
          </div>
        )
      ) : (
        <>
          {done ? (
            <div className="space-y-1 text-center">
              <CheckMark />
              <p className="text-lg font-bold text-gray-900">
                {done.action === 'in' ? `${done.name}님, 출근했어요` : `${done.name}님, 수고했어요`}
              </p>
              <p className="text-4xl font-bold tabular-nums tracking-tight text-gray-900">{fmtTime(done.at)}</p>
              {done.action === 'out' && (
                <p className="text-sm text-gray-400">{fmtTime(done.clock_in)} 출근 · 오늘 {fmtDuration(done.minutes)} 근무</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-900">{status.name}님</p>
              <p className="text-sm text-gray-500">
                {status.current
                  ? `${fmtTime(status.current.clock_in)}부터 근무 중 · ${fmtDuration(Math.floor((now - new Date(status.current.clock_in).getTime()) / 60000))}째`
                  : '지금은 근무 전이에요'}
              </p>
            </div>
          )}

          {status.missing.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 [word-break:keep-all]">
              {status.missing.map((m) => fmtWorkDate(m.work_date)).join(', ')} 퇴근 기록이 없어요. 점장님께 퇴근 시간을 알려 주세요.
            </p>
          )}

          {error && <p className="text-sm text-red-500 [word-break:keep-all]">{error}</p>}

          {!done && (
            canPunch ? (
              <div className="space-y-2">
                <button
                  onClick={() => handlePunch(status.current ? 'out' : 'in')}
                  disabled={busy}
                  className="w-full rounded-xl bg-[#1a5c3a] text-white py-4 text-base font-semibold disabled:opacity-50"
                >
                  {status.current ? '퇴근하기' : '출근하기'}
                </button>
                <p className="text-xs text-gray-400 text-center tabular-nums">
                  QR 확인됨 · {Math.floor(ticketLeft / 60)}:{String(ticketLeft % 60).padStart(2, '0')} 안에 눌러 주세요
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 text-center [word-break:keep-all]">
                출퇴근은 매장 카운터의 QR을 찍어야 할 수 있어요
              </p>
            )
          )}

          <MonthList month={status.month} />
        </>
      )}
    </ClockShell>
  )
}

// 이번 달 내 기록
function MonthList({ month }: { month: { days: number; minutes: number; logs: MyLog[] } }) {
  return (
    <div className="mt-2 border-t border-gray-100 pt-4 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold text-gray-800">이번 달</p>
        <p className="text-xs text-gray-500 tabular-nums">{month.days}일 · {fmtDuration(month.minutes)}</p>
      </div>
      {month.logs.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">아직 기록이 없어요</p>
      ) : (
        <ul className="divide-y divide-gray-50 text-xs">
          {month.logs.map((l) => (
            <li key={l.id} className="flex justify-between py-2 tabular-nums">
              <span className="text-gray-500 w-20">{fmtWorkDate(l.work_date)}</span>
              <span className="text-gray-900 flex-1">{fmtTime(l.clock_in)} – {l.clock_out ? fmtTime(l.clock_out) : ''}</span>
              <span className="text-gray-500">{l.clock_out ? fmtHm(l.minutes_worked) : '퇴근 전'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 첫 등록 — 이름만 입력 (QR 입장권이 있을 때만 보임)
function RegisterForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await post('/api/clock/register', { name })
      onDone()
    } catch (err) {
      setError(ERROR_TEXT[(err as Error).message] ?? FALLBACK_ERROR)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
      <div className="space-y-1">
        <p className="text-lg font-bold text-gray-900">처음 오셨네요</p>
        <p className="text-sm text-gray-500 [word-break:keep-all]">본인 이름을 입력하면 이 폰이 등록돼요. 다음부터는 카운터 QR만 찍으면 돼요.</p>
      </div>
      <label className="space-y-1.5">
        <span className="text-xs text-gray-400">이름</span>
        <input
          id="clock-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="name"
          placeholder="예: 김하늘"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c3a]"
        />
      </label>
      {error && <p className="text-sm text-red-500 [word-break:keep-all]">{error}</p>}
      <p className="text-xs text-gray-400 [word-break:keep-all]">
        이미 직원 목록에 있거나 폰을 바꾼 경우엔 새로 등록하지 말고 점장님께 연결 QR을 요청해 주세요.
      </p>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="mt-auto w-full rounded-xl bg-[#1a5c3a] text-white py-3 text-sm font-semibold disabled:opacity-40"
      >
        {saving ? '등록하는 중…' : '등록하기'}
      </button>
    </form>
  )
}
