import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAgents } from '@/lib/ai/agents/weekly'
import { runCashflowAgent } from '@/lib/ai/agents/cashflow'
import { runAttendanceAgent } from '@/lib/ai/agents/attendance'
import { runCostAgent } from '@/lib/ai/agents/cost'
import { runPlanAgent, runTipsAgent } from '@/lib/ai/agents/tips'

// 사무실 [지금 점검]·[지난주 다시 분석]·[기획 요청] — 관리 화면 로그인 대상
// body: { agent: 'weekly' | 'cashflow' | 'attendance' | 'cost' | 'plan', topic? }
//   weekly = 경영 AI 지난주 분석 → 마케팅 AI (업로드 직후 자동과 같은 묶음)
//   plan   = 경영 AI 기획 — topic이 있으면 그 주제로 기획안, 비어 있으면 이번 주 추천
export const maxDuration = 300

const RUNNERS: Record<string, (topic: string) => Promise<unknown>> = {
  weekly: () => runWeeklyAgents('manual'),
  cashflow: () => runCashflowAgent('manual'),
  attendance: () => runAttendanceAgent('manual'),
  cost: () => runCostAgent('manual'),
  plan: (topic) => (topic ? runPlanAgent(topic) : runTipsAgent('manual')),
}

export async function POST(req: NextRequest) {
  const { agent, topic } = await req.json().catch(() => ({}))
  const run = RUNNERS[agent as string]
  if (!run) return NextResponse.json({ error: 'unknown_agent' }, { status: 400 })
  try {
    await run(typeof topic === 'string' ? topic.trim().slice(0, 300) : '')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/ai/run]', agent, error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
