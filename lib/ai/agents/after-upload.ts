import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions } from '@/lib/supabase/queries/weekly'
import { aiConfigProblem } from '../client'
import { runWeeklyAgents } from './weekly'
import { runCashflowAgent } from './cashflow'

// 업로드가 끝나면 그 데이터로 점검 — 시간표 대신 "데이터가 들어오면" 일함
//   점장이 보통 수요일 밤에 매출·통장을 올리고 목요일 회의 → 올린 직후 점검해야 이번 데이터로 분석됨
//   경영 AI(→ 마케팅): 지난주(월~일) 매출과 통장이 둘 다 들어왔을 때, 그 주에 자동 점검을 아직 안 했으면 1번
//   자금 관리 AI: 통장을 올렸을 때, 이번 주(월~)에 자동 점검을 아직 안 했으면 1번
//   [지금 점검]으로 직접 돌린 건 세지 않음 (데이터가 없을 때 돌렸을 수 있어서)
// 자동 점검 = ai_runs.trigger 'schedule' (사람이 누르지 않은 실행)

type Job = { key: 'weekly' | 'cashflow'; label: string; run: () => Promise<unknown> }

async function lastDate(table: 'daily_sales' | 'bank_income' | 'monthly_expenses') {
  const supabase = createServerClient()
  let q = supabase.from(table).select('date').not('date', 'is', null).order('date', { ascending: false }).limit(1)
  if (table === 'daily_sales') q = q.eq('source', 'pos')
  const { data } = await q
  return (data?.[0]?.date as string | undefined) ?? null
}

// 같은 AI의 자동 점검이 since 이후에 성공했거나 지금 돌고 있으면 true
async function autoRanSince(agent: string, since: string, period?: string) {
  const supabase = createServerClient()
  let q = supabase.from('ai_runs').select('id').eq('agent', agent).eq('trigger', 'schedule').in('status', ['succeeded', 'running']).gte('started_at', since)
  if (period) q = q.eq('period', period)
  const { data } = await q.limit(1)
  return (data?.length ?? 0) > 0
}

// 지금 돌릴 점검 고르기 (빠른 조회만 — 실제 실행은 응답 뒤 after()에서)
export async function pickAgentsAfterUpload(type: 'daily_sales' | 'bank_transaction'): Promise<Job[]> {
  if (aiConfigProblem()) return []
  const [thisWeek, lastWeek] = getRecentWeekOptions(2)
  const jobs: Job[] = []

  const [sales, bankIn, bankOut] = await Promise.all([lastDate('daily_sales'), lastDate('bank_income'), lastDate('monthly_expenses')])
  const bank = [bankIn, bankOut].filter(Boolean).sort().at(-1) ?? null
  const weekReady = !!sales && !!bank && sales >= lastWeek.weekEnd && bank >= lastWeek.weekEnd
  // 경영 AI 기록의 period = 지난주 시작일. 이번 주 월요일 이후 시작한 자동 점검이 있으면 이미 함
  if (weekReady && !(await autoRanSince('business', `${thisWeek.weekStart}T00:00:00+09:00`, lastWeek.weekStart))) {
    jobs.push({ key: 'weekly', label: '경영 AI', run: () => runWeeklyAgents('schedule') })
  }
  if (type === 'bank_transaction' && !(await autoRanSince('cashflow', `${thisWeek.weekStart}T00:00:00+09:00`))) {
    jobs.push({ key: 'cashflow', label: '자금 관리 AI', run: () => runCashflowAgent('schedule') })
  }
  return jobs
}

export async function runJobs(jobs: Job[]) {
  for (const job of jobs) {
    // 하나가 실패해도 나머지는 계속 (실패는 ai_runs에 기록됨)
    await job.run().catch((error) => console.error('[after-upload]', job.key, error))
  }
}
