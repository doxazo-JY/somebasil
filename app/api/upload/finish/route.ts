import { NextRequest, NextResponse, after } from 'next/server'
import { getWeekCoverage } from '@/lib/upload/coverage'
import { pickAgentsAfterUpload, runJobs } from '@/lib/ai/agents/after-upload'

// 한 번에 올린 파일을 다 저장한 뒤 — 지난주 체크리스트 + AI 분석 판단 (한 번만)
// body: { bank: boolean } 이번에 통장을 올렸는지 (자금 관리 AI 조건)
// AI는 응답을 보낸 뒤 after()로 실행 (경영 → 마케팅 1~2분)
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { bank } = await req.json().catch(() => ({}))
  const coverage = await getWeekCoverage()
  const { jobs, weeklyDone } = await pickAgentsAfterUpload(coverage, !!bank).catch(() => ({ jobs: [], weeklyDone: false }))
  if (jobs.length > 0) after(() => runJobs(jobs))
  return NextResponse.json({ coverage, aiStarted: jobs.map((j) => j.label), weeklyDone })
}
