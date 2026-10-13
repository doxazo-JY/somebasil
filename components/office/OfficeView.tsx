'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AiRun, InboxItem } from '@/lib/supabase/queries/ai'
import InboxList from '@/components/inbox/InboxList'
import OfficeScene, { type SceneAgent } from './scene/OfficeScene'
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

// 상태 표시 (이름표 옆 글자 색)
// 작업 중(타이핑) / 확인 기다림(자리에서 서류) / 쉬는 중(쉬는 곳) — 그림의 모습과 같은 말로
function chipOf(agent: OfficeAgent, last: AiRun | undefined, today: string, running: boolean, items: number): { label: string; cls: string } {
  if (agent.vacant) return { label: '입사 예정', cls: 'text-[#8a8370]' }
  if (agent.chat) return running ? { label: '답하는 중', cls: 'text-[#1a5c3a]' } : { label: '질문 기다림', cls: 'text-[#6d6656]' }
  if (running) return { label: '작업 중', cls: 'text-[#1a5c3a]' }
  if (last?.status === 'failed') return { label: '실패', cls: 'text-red-600' }
  if (items > 0) return { label: '확인 기다림', cls: 'text-[#9a5b00]' }
  if (last && kstDay(last.started_at) === today) return { label: '오늘 일 끝', cls: 'text-[#6d6656]' }
  return { label: '쉬는 중', cls: 'text-[#6d6656]' }
}

// AI 사무실 — 캐릭터(또는 책상)를 누르면 그 AI의 업무함만
export default function OfficeView({ open, closed, runs, today, configProblem, assistantHistory }: Props) {
  const lastRun = (key: string) => runs.find((r) => r.agent === key)
  const openOf = (key: string) => open.filter((i) => i.agent === key)

  // 처음 선택: 확인 필요가 있는 AI → 챙길 일이 많은 AI → 경영 AI
  const initial =
    OFFICE_AGENTS.find((a) => openOf(a.key).some((i) => i.severity === 'warn')) ??
    [...OFFICE_AGENTS].filter((a) => openOf(a.key).length > 0).sort((a, b) => openOf(b.key).length - openOf(a.key).length)[0] ??
    OFFICE_AGENTS[0]
  const [selected, setSelected] = useState(initial.key)
  const [runningKey, setRunningKey] = useState<string | null>(null) // [지금 점검] 누른 AI (경영 점검 중엔 마케팅도)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const agent = OFFICE_AGENTS.find((a) => a.key === selected) ?? OFFICE_AGENTS[0]

  const isRunning = (key: string) =>
    lastRun(key)?.status === 'running' ||
    runningKey === key ||
    (runningKey === 'business' && key === 'marketing') ||
    (key === 'assistant' && assistantBusy)

  const sceneAgents: SceneAgent[] = OFFICE_AGENTS.map((a) => {
    const items = openOf(a.key)
    const running = isRunning(a.key)
    return {
      key: a.key,
      name: a.name,
      vacant: !!a.vacant,
      // 실행 중 → 책상에서 타이핑 / 확인할 일 있음 → 책상에서 읽기 / 그 외 → 카페에서 쉼 (비서도 질문이 오면 자리로)
      mode: running ? 'type' : items.length > 0 ? 'read' : 'rest',
      chip: chipOf(a, lastRun(a.key), today, running, items.length),
      items: items.length,
      warn: items.some((i) => i.severity === 'warn'),
    }
  })

  // 넓은 화면: 왼쪽 사무실(스크롤해도 고정) + 오른쪽 선택한 AI / 폰: 위아래
  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6 lg:items-start">
      <div className="rounded-xl border border-gray-100 overflow-hidden lg:sticky lg:top-6 bg-[#e9e2d0]">
        <OfficeScene agents={sceneAgents} selected={selected} onSelect={setSelected} />
        <p className="px-3 py-1.5 text-[10px] text-gray-400 text-right bg-white/60">
          그림: Pixel Agents (MIT) · MetroCity (CC0)
        </p>
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
        onRunning={(on) => setRunningKey(on ? agent.key : null)}
        onAssistantBusy={setAssistantBusy}
      />
    </div>
  )
}

function AgentDetail({ agent, assistantHistory, last, runs, open, closed, configProblem, onRunning, onAssistantBusy }: {
  agent: OfficeAgent
  onRunning: (on: boolean) => void
  onAssistantBusy: (busy: boolean) => void
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
    onRunning(true)
    setError(null)
    const res = await fetch('/api/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agent.run }),
    })
    const data = await res.json().catch(() => ({}))
    setRunning(false)
    onRunning(false)
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
        <AssistantChat initial={assistantHistory} disabledReason={configProblem} onBusyChange={onAssistantBusy} />
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
