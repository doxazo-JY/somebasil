import { NextRequest, NextResponse } from 'next/server'
import { runAttendanceAgent } from '@/lib/ai/agents/attendance'
import { runCostAgent } from '@/lib/ai/agents/cost'
import { runTipsAgent } from '@/lib/ai/agents/tips'

// Vercel Cron — 매일 08:00 KST (vercel.json: 23:00 UTC 전날) AI 업무팀 일정표
//   매일   : 직원 관리 AI (attendance, AI 호출 없음)
//   월요일 : 원가 AI (cost — 빈 원가 정보 질문)
//   수요일 : 경영 AI 이번 주 추천 (tips — 그날 밤 주간 보고서 참고용)
// 지난주 숫자 점검(경영 → 마케팅)·자금 관리는 시간표가 아니라 매출·통장 업로드 직후 (lib/ai/agents/after-upload.ts)
// 한 AI가 실패해도 나머지는 계속 (실패는 ai_runs에 기록)
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 한국 요일 (0=일)
  const kstDay = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay()
  const jobs: [string, () => Promise<unknown>][] = [['attendance', () => runAttendanceAgent('schedule')]]
  if (kstDay === 1) jobs.push(['cost', () => runCostAgent('schedule')])
  if (kstDay === 3) jobs.push(['tips', () => runTipsAgent('schedule')])

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
