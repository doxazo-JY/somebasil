'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AiRun, InboxItem } from '@/lib/supabase/queries/ai'
import InboxList from '@/components/inbox/InboxList'
import PixelDesk from './PixelDesk'
import AssistantChat from './AssistantChat'
import { OFFICE_AGENTS, type OfficeAgent } from './agents'

interface Props {
  open: InboxItem[]
  closed: InboxItem[]
  runs: AiRun[]
  today: string // 한국 날짜
  configProblem: string | null
  assistantHistory: { q: string; a: string }[]
}

const kstDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso))
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

type DeskState = { label: string; cls: string; screenOn: boolean }

function deskState(agent: OfficeAgent, last: AiRun | undefined, today: string): DeskState {
  if (agent.vacant) return { label: '입사 예정', cls: 'border border-dashed border-[#8a8370] text-[#6d6656]', screenOn: false }
  if (agent.chat) return { label: '질문 받는 중', cls: 'bg-white text-[#1a5c3a] border border-[#1a5c3a]/40', screenOn: true }
  if (last?.status === 'running') return { label: '작업 중', cls: 'bg-[#1a5c3a] text-white', screenOn: true }
  if (last?.status === 'failed') return { label: '실패', cls: 'bg-red-500 text-white', screenOn: false }
  if (last && kstDay(last.started_at) === today) return { label: '오늘 점검', cls: 'bg-white text-[#1a5c3a] border border-[#1a5c3a]/40', screenOn: true }
  return { label: '대기', cls: 'bg-white text-[#5d6a63] border border-[#c9c2ae]', screenOn: false }
}

// AI 사무실 — 책상을 누르면 그 AI의 업무함만
export default function OfficeView({ open, closed, runs, today, configProblem, assistantHistory }: Props) {
  const lastRun = (key: string) => runs.find((r) => r.agent === key)
  const openOf = (key: string) => open.filter((i) => i.agent === key)

  // 처음 선택: 확인 필요가 있는 AI → 챙길 일이 많은 AI → 경영 AI
  const initial =
    OFFICE_AGENTS.find((a) => openOf(a.key).some((i) => i.severity === 'warn')) ??
    [...OFFICE_AGENTS].filter((a) => openOf(a.key).length > 0).sort((a, b) => openOf(b.key).length - openOf(a.key).length)[0] ??
    OFFICE_AGENTS[0]
  const [selected, setSelected] = useState(initial.key)
  const agent = OFFICE_AGENTS.find((a) => a.key === selected) ?? OFFICE_AGENTS[0]

  // 넓은 화면: 왼쪽 사무실(스크롤해도 고정) + 오른쪽 선택한 AI의 메시지 / 폰: 위아래
  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6 lg:items-start">
      {/* 사무실 — 고정 팔레트 픽셀 일러스트 */}
      <div
        className="rounded-xl border border-gray-100 overflow-hidden lg:sticky lg:top-6"
        style={{
          backgroundColor: '#efe8d6',
          backgroundImage:
            'linear-gradient(45deg, #e6dcc4 25%, transparent 25%, transparent 75%, #e6dcc4 75%), linear-gradient(45deg, #e6dcc4 25%, transparent 25%, transparent 75%, #e6dcc4 75%)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px',
        }}
      >
        <div className="h-3 bg-[#d6e3da] border-b-4 border-[#b4c7ba]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5 px-4 py-5">
          {OFFICE_AGENTS.map((a) => {
            const items = openOf(a.key)
            const warn = items.some((i) => i.severity === 'warn')
            const state = deskState(a, lastRun(a.key), today)
            const isSel = a.key === selected
            return (
              <button
                key={a.key}
                onClick={() => setSelected(a.key)}
                aria-pressed={isSel}
                className={`flex flex-col items-center gap-1.5 rounded-lg py-2 transition-colors ${isSel ? 'bg-white/70 ring-2 ring-[#1a5c3a]' : 'hover:bg-white/40'}`}
              >
                <span
                  className={`text-[11px] px-2 py-0.5 border-2 min-h-[24px] whitespace-nowrap ${
                    items.length === 0 ? 'invisible' : warn ? 'bg-[#fff1a8] border-[#9a5b00] text-[#6b4400]' : 'bg-white border-[#2a2a2a] text-[#2a2a2a]'
                  }`}
                >
                  챙길 일 {items.length}
                </span>
                <PixelDesk shirt={a.shirt} hair={a.hair} screenOn={state.screenOn} vacant={!!a.vacant} />
                <span className="text-[13px] font-semibold text-[#2a2a2a]">{a.name}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${state.cls}`}>{state.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <AgentDetail
        key={agent.key}
        agent={agent}
        assistantHistory={assistantHistory}
        last={lastRun(agent.key)}
        runs={runs.filter((r) => r.agent === agent.key).slice(0, 5)}
        open={openOf(agent.key)}
        closed={closed.filter((i) => i.agent === agent.key)}
        configProblem={configProblem}
      />
    </div>
  )
}

function AgentDetail({ agent, assistantHistory, last, runs, open, closed, configProblem }: {
  agent: OfficeAgent
  assistantHistory: { q: string; a: string }[]
  last: AiRun | undefined
  runs: AiRun[]
  open: InboxItem[]
  closed: InboxItem[]
  configProblem: string | null
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRuns, setShowRuns] = useState(false)
  const blocked = agent.usesAi && !!configProblem

  async function run() {
    if (!agent.run) return
    setRunning(true)
    setError(null)
    const res = await fetch('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agent.run }),
    })
    const data = await res.json().catch(() => ({}))
    setRunning(false)
    if (!res.ok) setError(data.error ?? '실행하지 못했어요')
    router.refresh()
  }

  if (agent.chat) {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-base font-semibold text-gray-900">{agent.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 [word-break:keep-all]">{agent.role} 기록을 바꾸지는 못하고 찾아보기만 해요.</p>
        </div>
        <AssistantChat initial={assistantHistory} disabledReason={configProblem} />
      </div>
    )
  }

  if (agent.vacant) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-8 text-center space-y-1">
        <p className="text-sm font-semibold text-gray-700">{agent.name} · 입사 예정</p>
        <p className="text-xs text-gray-500 [word-break:keep-all]">{agent.role}</p>
        <p className="text-xs text-gray-400">{agent.vacant}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-gray-900">
              {agent.name} <span className="ml-1 text-xs font-normal text-gray-400">{agent.schedule}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5 [word-break:keep-all]">{agent.role}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {agent.link && (
              <Link href={agent.link.href} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                {agent.link.label}
              </Link>
            )}
            {agent.run && (
              <button
                onClick={run}
                disabled={running || blocked}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#1a5c3a] text-[#1a5c3a] hover:bg-[#e6f0ea] disabled:opacity-40 whitespace-nowrap"
              >
                {running ? (agent.usesAi ? '점검하는 중… (1분 정도)' : '점검하는 중…') : '지금 점검'}
              </button>
            )}
          </div>
        </div>
        <p className={`text-xs [word-break:keep-all] ${last?.status === 'failed' ? 'text-red-500' : 'text-gray-600'}`}>
          {!last
            ? '아직 일한 기록이 없어요'
            : last.status === 'failed'
              ? `${fmtDateTime(last.started_at)} 실패: ${last.error ?? ''}`
              : last.status === 'running'
                ? `${fmtDateTime(last.started_at)}부터 일하는 중`
                : `${fmtDateTime(last.started_at)} · ${last.summary ?? ''}`}
        </p>
        {blocked && <p className="text-xs text-amber-700 [word-break:keep-all]">{configProblem}</p>}
        {error && <p className="text-xs text-red-500 [word-break:keep-all]">{error}</p>}
        {runs.length > 1 && (
          <div>
            <button onClick={() => setShowRuns(!showRuns)} className="text-xs text-gray-400 hover:text-gray-600">
              {showRuns ? '일한 기록 접기' : '일한 기록 보기'}
            </button>
            {showRuns && (
              <ul className="mt-2 divide-y divide-gray-50 text-xs">
                {runs.map((r) => (
                  <li key={r.id} className="py-1.5 flex gap-3">
                    <span className="text-gray-400 w-24 shrink-0 tabular-nums">{fmtDateTime(r.started_at)}</span>
                    <span className={`flex-1 min-w-0 [word-break:keep-all] ${r.status === 'failed' ? 'text-red-500' : 'text-gray-700'}`}>
                      {r.status === 'failed' ? `실패: ${r.error ?? ''}` : r.summary}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <InboxList open={open} closed={closed} hideAgent emptyText={`${agent.name}가 올린 챙길 일이 없어요`} />
    </div>
  )
}
