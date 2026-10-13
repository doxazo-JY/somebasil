'use client'

import { useEffect, useRef, useState } from 'react'
import ClockShell, { CheckMark } from './ClockShell'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'linked'; name: string }
  | { kind: 'error' }

// 폰 교체 — 연결 QR 스캔 즉시 연결
export default function LinkScreen({ token }: { token: string }) {
  const [view, setView] = useState<ViewState>(() => (token ? { kind: 'loading' } : { kind: 'error' }))
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !token) return
    started.current = true
    fetch('/api/clock/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        setView(res.ok ? { kind: 'linked', name: data.name } : { kind: 'error' })
      })
      .catch(() => setView({ kind: 'error' }))
  }, [token])

  if (view.kind === 'loading') {
    return (
      <ClockShell>
        <p className="text-sm text-gray-400 text-center py-16">연결하고 있어요…</p>
      </ClockShell>
    )
  }

  if (view.kind === 'error') {
    return (
      <ClockShell>
        <div className="py-10 text-center space-y-3">
          <p className="text-base font-semibold text-gray-900">연결하지 못했어요</p>
          <p className="text-sm text-gray-500 [word-break:keep-all]">
            연결 QR은 10분 동안 한 번만 쓸 수 있어요. 점장님께 새 연결 QR을 요청해 주세요.
          </p>
        </div>
      </ClockShell>
    )
  }

  return (
    <ClockShell>
      <CheckMark />
      <p className="text-lg font-bold text-gray-900 text-center">{view.name}님, 폰이 연결됐어요</p>
      <p className="text-sm text-gray-500 text-center [word-break:keep-all]">
        출퇴근은 아직 기록되지 않았어요. 매장 카운터의 QR을 찍으면 출근·퇴근 버튼이 나와요.
      </p>
    </ClockShell>
  )
}
