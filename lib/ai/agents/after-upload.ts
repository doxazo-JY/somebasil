import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions } from '@/lib/supabase/queries/weekly'
import type { WeekCoverage } from '@/lib/upload/coverage'
import { aiConfigProblem } from '../client'
import { runWeeklyAgents } from './weekly'
import { runCashflowAgent } from './cashflow'

// 업로드가 끝나면 그 데이터로 점검 — 시간표 대신 "데이터가 들어오면" 일함
//   점장이 보통 수요일 밤에 매출·통장을 올리고 목요일 회의 → 올린 직후 점검해야 이번 데이터로 분석됨
//   경영 AI(→ 마케팅): 지난주(월~일) 매출과 통장이 둘 다 들어왔을 때, 그 주에 자동 점검을 아직 안 했으면 1번
//   자금 관리 AI: 이번에 통장을 올렸고, 이번 주(월~)에 자동 점검을 아직 안 했으면 1번
//   [지난주 다시 분석]으로 직접 돌린 건 세지 않음 (데이터가 없을 때 돌렸을 수 있어서)
// 판단은 한 번에 올린 파일들을 다 저장한 뒤 한 번 (/api/upload/finish)
// 자동 점검 = ai_runs.trigger 'schedule' (사람이 누르지 않은 실행)

type Job = { key: 'weekly' | 'cashflow'; label: string; run: () => Promise<unknown> }

// 같은 AI의 자동 점검이 since 이후에 성공했거나 지금 돌고 있으면 true
async function autoRanSince(agent: string, since: string, period?: string) {
  const supabase = createServerClient()
  let q = supabase.from('ai_runs').select('id').eq('agent', agent).eq('trigger', 'schedule').in('status', ['succeeded', 'running']).gte('started_at', since)
  if (period) q = q.eq('period', period)
  const { data } = await q.limit(1)
  return (data?.length ?? 0) > 0
}

// 지금 돌릴 점검 고르기 + 상태 (빠른 조회만 — 실제 실행은 응답 뒤 after()에서)
export async function pickAgentsAfterUpload(coverage: WeekCoverage, bankUploaded: boolean): Promise<{ jobs: Job[]; weeklyDone: boolean }> {
  const [thisWeek] = getRecentWeekOptions(1)
  const since = `${thisWeek.weekStart}T00:00:00+09:00`
  const jobs: Job[] = []
  // 경영 AI 기록의 period = 지난주 시작일. 이번 주 월요일 이후 시작한 자동 점검이 있으면 이미 함
  const weeklyDone = await autoRanSince('business', since, coverage.week.start)
  if (aiConfigProblem()) return { jobs, weeklyDone }
  if (coverage.salesReady && coverage.bankReady && !weeklyDone) {
    jobs.push({ key: 'weekly', label: '경영 AI', run: () => runWeeklyAgents('schedule') })
  }
  if (bankUploaded && !(await autoRanSince('cashflow', since))) {
    jobs.push({ key: 'cashflow', label: '자금 관리 AI', run: () => runCashflowAgent('schedule') })
  }
  return { jobs, weeklyDone }
}

export async function runJobs(jobs: Job[]) {
  for (const job of jobs) {
    // 하나가 실패해도 나머지는 계속 (실패는 ai_runs에 기록됨)
    await job.run().catch((error) => console.error('[after-upload]', job.key, error))
  }
}
