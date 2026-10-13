'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AiRun } from '@/lib/supabase/queries/ai'

const AGENT_LABEL: Record<string, string> = { business: '경영 AI', marketing: '마케팅 AI' }

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

// 경영 AI 상태 + [지금 실행] + 최근 실행 기록
export default function AgentPanel({ runs, hasKey }: { runs: AiRun[]; hasKey: boolean }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRuns, setShowRuns] = useState(false)
  const lastBusiness = runs.find((r) => r.agent === 'business')

  async function run() {
    setRunning(true)
    setError(null)
    const res = await fetch('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'business' }),
    })
    const data = await res.json().catch(() => ({}))
    setRunning(false)
    if (!res.ok) setError(data.error ?? '실행하지 못했어요')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">경영 AI <span className="ml-1 text-xs font-normal text-gray-400">매주 수요일 아침 자동 점검</span></p>
          <p className="text-xs text-gray-500 mt-0.5 [word-break:keep-all]">
            {!lastBusiness
              ? '아직 실행한 적이 없어요'
              : lastBusiness.status === 'failed'
                ? `${fmtDateTime(lastBusiness.started_at)} 실행 실패`
                : lastBusiness.status === 'running'
                  ? `${fmtDateTime(lastBusiness.started_at)}부터 실행 중`
                  : `${fmtDateTime(lastBusiness.started_at)} · ${lastBusiness.summary ?? ''}`}
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || !hasKey}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#1a5c3a] text-[#1a5c3a] hover:bg-[#e6f0ea] disabled:opacity-40 whitespace-nowrap"
        >
          {running ? '점검하는 중… (1분 정도)' : '지금 점검하기'}
        </button>
      </div>
      {!hasKey && <p className="text-xs text-amber-700 [word-break:keep-all]">Claude API 키(ANTHROPIC_API_KEY)가 설정되지 않아 실행할 수 없어요</p>}
      {error && <p className="text-xs text-red-500 [word-break:keep-all]">{error}</p>}

      {runs.length > 0 && (
        <div>
          <button onClick={() => setShowRuns(!showRuns)} className="text-xs text-gray-400 hover:text-gray-600">
            {showRuns ? '실행 기록 접기' : '실행 기록 보기'}
          </button>
          {showRuns && (
            <ul className="mt-2 divide-y divide-gray-50 text-xs">
              {runs.map((r) => (
                <li key={r.id} className="py-2 flex gap-3">
                  <span className="text-gray-400 w-24 shrink-0 tabular-nums">{fmtDateTime(r.started_at)}</span>
                  <span className="text-gray-500 w-16 shrink-0">{AGENT_LABEL[r.agent] ?? r.agent}</span>
                  <span className={`flex-1 min-w-0 [word-break:keep-all] ${r.status === 'failed' ? 'text-red-500' : 'text-gray-700'}`}>
                    {r.status === 'failed' ? `실패: ${r.error ?? ''}` : r.status === 'running' ? '실행 중' : r.summary}
                  </span>
                  <span className="text-gray-300 shrink-0 tabular-nums" title="입력/출력 토큰">
                    {r.input_tokens != null ? `${Math.round((r.input_tokens + (r.output_tokens ?? 0)) / 1000)}k` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
