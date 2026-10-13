import { NextRequest, NextResponse } from 'next/server'
import { runBusinessAgent } from '@/lib/ai/agents/business'

// 업무함 [지금 실행] — 관리 화면 로그인 대상
// body: { agent: 'business' }
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { agent } = await req.json().catch(() => ({}))
  if (agent !== 'business') return NextResponse.json({ error: 'unknown_agent' }, { status: 400 })
  try {
    const result = await runBusinessAgent('manual')
    return NextResponse.json({ ok: true, runId: result.runId, summary: result.summary })
  } catch (error) {
    console.error('[POST /api/ai/run]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
