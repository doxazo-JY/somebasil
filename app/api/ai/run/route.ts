import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAgents } from '@/lib/ai/agents/weekly'
import { runCashflowAgent } from '@/lib/ai/agents/cashflow'
import { runAttendanceAgent } from '@/lib/ai/agents/attendance'

// 업무함 [지금 점검하기] — 관리 화면 로그인 대상
// body: { agent: 'weekly' | 'cashflow' | 'attendance' }
//   weekly = 경영 AI → 마케팅 AI (자동 일정과 같은 묶음)
export const maxDuration = 300

const RUNNERS = {
  weekly: () => runWeeklyAgents('manual'),
  cashflow: () => runCashflowAgent('manual'),
  attendance: () => runAttendanceAgent('manual'),
} as const

export async function POST(req: NextRequest) {
  const { agent } = await req.json().catch(() => ({}))
  const run = RUNNERS[agent as keyof typeof RUNNERS]
  if (!run) return NextResponse.json({ error: 'unknown_agent' }, { status: 400 })
  try {
    await run()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/ai/run]', agent, error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
