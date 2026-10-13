import { NextRequest, NextResponse } from 'next/server'
import { runBusinessAgent } from '@/lib/ai/agents/business'

// Vercel Cron — 매주 수요일 08:00 KST (vercel.json: 화 23:00 UTC) 경영 AI 실행
// AI 분석이 수십 초 걸려 실행 시간 상한을 늘림
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runBusinessAgent('schedule')
    return NextResponse.json({ ok: true, runId: result.runId, summary: result.summary })
  } catch (error) {
    console.error('[cron/agents/business]', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
