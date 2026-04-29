'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 월별 요약(monthly_summary.total_expense / income / profit) 일괄 재계산 트리거
// — 'excluded' 정책 변경, 수동 조정 누락 보정 등 회복용
export default function RecalcButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleRecalc() {
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch('/api/recalc', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ text: json?.error ?? `재계산 실패 (${res.status})`, ok: false })
        return
      }
      setMessage({ text: '✓ 모든 월 재계산 완료. 대시보드/지출 페이지 새로고침해보세요.', ok: true })
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setMessage({ text: `재계산 실패: ${msg}`, ok: false })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">월별 요약 재계산</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed [word-break:keep-all]">
            대시보드/지출 페이지의 합계가 이상할 때 누르세요. 모든 월의 매출·지출·이익을
            <code className="text-gray-500"> daily_sales / monthly_expenses / manual_adjustments</code>
            기반으로 다시 계산합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRecalc}
          disabled={running}
          className="text-sm px-4 py-2 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {running ? '재계산 중...' : '재계산'}
        </button>
      </div>
      {message && (
        <p className={`text-xs mt-3 ${message.ok ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
