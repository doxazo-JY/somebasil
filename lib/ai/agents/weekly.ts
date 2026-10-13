import { runBusinessAgent } from './business'
import { runMarketingAgent } from './marketing'
import type { RunTrigger } from '../client'

// 주간 AI 묶음 — 경영 AI → (찾은 주제가 있으면) 마케팅 AI
// AI끼리 결과를 넘겨받는 연결: 경영 AI의 marketing_topic이 마케팅 AI의 주제가 됨
export async function runWeeklyAgents(trigger: RunTrigger) {
  const business = await runBusinessAgent(trigger)
  const topic = business.output.marketing_topic?.trim()
  let marketing: Awaited<ReturnType<typeof runMarketingAgent>> | null = null
  if (topic) {
    // 마케팅이 실패해도 경영 결과는 이미 저장됨 (실패 기록은 ai_runs에 남음)
    marketing = await runMarketingAgent({ trigger, source: 'auto', topic }).catch(() => null)
  }
  return { business, marketing }
}
