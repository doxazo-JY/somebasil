'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AiRun } from '@/lib/supabase/queries/ai'

const AGENT_LABEL: Record<string, string> = { business: '경영 AI', marketing: '마케팅 AI', attendance: '근태 AI', cashflow: '현금흐름 AI' }

// 업무팀 구성 — 실행 단위(run)와 화면에 보이는 마지막 기록(agent)
const TEAM = [
  { run: 'weekly', agent: 'business', name: '경영 AI → 마케팅 AI', schedule: '매주 수요일', note: '지난주 점검 → 이번 주 게시글 초안', usesAi: true },
  { run: 'cashflow', agent: 'cashflow', name: '현금흐름 AI', schedule: '매주 월요일', note: '앞으로 30일 잔고 위험', usesAi: true },
  { run: 'attendance', agent: 'attendance', name: '근태 AI', schedule: '매일', note: '퇴근 누락 · 주휴수당 대상', usesAi: false },
] as const

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

function lastLine(r: AiRun | undefined) {
  if (!r) return '아직 실행한 적 없음'
  if (r.status === 'failed') return `${fmtDateTime(r.started_at)} 실패: ${r.error ?? ''}`
  if (r.status === 'running') return `${fmtDateTime(r.started_at)}부터 실행 중`
  return `${fmtDateTime(r.started_at)} · ${r.summary ?? ''}`
}

// AI 업무팀 상태 + [지금 점검] + 실행 기록 (모든 시각 오전 8시 자동)
export default function AgentPanel({ runs, configProblem }: { runs: AiRun[]; configProblem: string | null }) {
  const router = useRouter()
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRuns, setShowRuns] = useState(false)

  async function run(key: string) {
    setRunning(key)
    setError(null)
    const res = await fetch('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: key }),
    })
    const data = await res.json().catch(() => ({}))
    setRunning(null)
    if (!res.ok) setError(data.error ?? '실행하지 못했어요')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 pt-4 pb-2">
        <p className="text-sm font-semibold text-gray-800">AI 업무팀 <span className="ml-1 text-xs font-normal text-gray-400">오전 8시 자동 점검</span></p>
      </div>
      <ul className="divide-y divide-gray-50">
        {TEAM.map((t) => {
          const last = runs.find((r) => r.agent === t.agent)
          const blocked = t.usesAi && !!configProblem
          return (
            <li key={t.run} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="flex-1 min-w-[220px]">
                <p className="text-sm text-gray-900">
                  {t.name} <span className="text-xs text-gray-400">{t.schedule} · {t.note}</span>
                </p>
                <p className={`text-xs mt-0.5 [word-break:keep-all] ${last?.status === 'failed' ? 'text-red-500' : 'text-gray-500'}`}>{lastLine(last)}</p>
              </div>
              <button
                onClick={() => run(t.run)}
                disabled={!!running || blocked}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#1a5c3a] text-[#1a5c3a] hover:bg-[#e6f0ea] disabled:opacity-40 whitespace-nowrap"
              >
                {running === t.run ? (t.usesAi ? '점검하는 중… (1분 정도)' : '점검하는 중…') : '지금 점검'}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="px-5 pb-4 pt-1 space-y-2">
        {configProblem && <p className="text-xs text-amber-700 [word-break:keep-all]">{configProblem}</p>}
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
                    <span className="text-gray-500 w-20 shrink-0">{AGENT_LABEL[r.agent] ?? r.agent}</span>
                    <span className={`flex-1 min-w-0 [word-break:keep-all] ${r.status === 'failed' ? 'text-red-500' : 'text-gray-700'}`}>
                      {r.status === 'failed' ? `실패: ${r.error ?? ''}` : r.status === 'running' ? '실행 중' : r.summary}
                    </span>
                    <span className="text-gray-300 shrink-0 tabular-nums" title="입력+출력 토큰">
                      {r.input_tokens != null ? `${Math.round((r.input_tokens + (r.output_tokens ?? 0)) / 1000)}k` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
