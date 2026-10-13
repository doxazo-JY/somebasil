import { NextRequest, NextResponse } from 'next/server'
import { runAttendanceAgent } from '@/lib/ai/agents/attendance'
import { runCashflowAgent } from '@/lib/ai/agents/cashflow'
import { runCostAgent } from '@/lib/ai/agents/cost'
import { runWeeklyAgents } from '@/lib/ai/agents/weekly'

// Vercel Cron — 매일 08:00 KST (vercel.json: 23:00 UTC 전날) AI 업무팀 일정표
//   매일   : 직원 관리 AI (attendance, AI 호출 없음)
//   월요일 : 자금 관리 AI (cashflow) · 원가 AI (cost — 빈 원가 정보 질문)
//   수요일 : 경영 AI → 마케팅 AI (경영 AI가 찾은 주제로 게시글 초안)
// 한 AI가 실패해도 나머지는 계속 (실패는 ai_runs에 기록)
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 한국 요일 (0=일)
  const kstDay = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay()
  const jobs: [string, () => Promise<unknown>][] = [['attendance', () => runAttendanceAgent('schedule')]]
  if (kstDay === 1) jobs.push(['cashflow', () => runCashflowAgent('schedule')], ['cost', () => runCostAgent('schedule')])
  if (kstDay === 3) jobs.push(['weekly', () => runWeeklyAgents('schedule')])

  const results: Record<string, string> = {}
  for (const [name, job] of jobs) {
    try {
      await job()
      results[name] = 'ok'
    } catch (error) {
      console.error(`[cron/agents] ${name}`, error)
      results[name] = error instanceof Error ? error.message : 'failed'
    }
  }
  return NextResponse.json({ ok: true, results })
}
