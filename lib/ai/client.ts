import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

// AI 업무팀 공통 — Claude 호출 + 실행 기록(ai_runs)
// 서버 전용. 키는 Vercel/로컬 환경변수 ANTHROPIC_API_KEY

export const AI_MODEL = 'claude-opus-5-5'

// 안전 분류기가 요청을 거절하면 서버가 권장 모델로 자동 재시도 (fallbacks: 'default')
export const FALLBACK_BETAS = ['server-side-fallback-2026-07-01'] as const

let client: Anthropic | null = null
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다 (Vercel 환경변수 / .env.local)')
  }
  client ??= new Anthropic()
  return client
}

export type AgentKey = 'business' | 'marketing'

export const AGENT_LABEL: Record<AgentKey, string> = {
  business: '경영 AI',
  marketing: '마케팅 AI',
}

export type RunTrigger = 'schedule' | 'manual'

type RunResult = {
  summary: string
  output: unknown
  period?: string | null
  usage?: { input_tokens: number; output_tokens: number } | null
  model?: string
}

// 실행 1회를 ai_runs에 기록하며 감쌈 — 실패해도 기록이 남음
export async function recordRun(agent: AgentKey, trigger: RunTrigger, work: (runId: number) => Promise<RunResult>) {
  const supabase = createServerClient()
  const { data: run, error } = await supabase
    .from('ai_runs')
    .insert({ agent, trigger, status: 'running', model: AI_MODEL })
    .select('id')
    .single()
  if (error) throw error

  try {
    const result = await work(run.id)
    await supabase
      .from('ai_runs')
      .update({
        status: 'succeeded',
        summary: result.summary,
        output: result.output,
        period: result.period ?? null,
        model: result.model ?? AI_MODEL,
        input_tokens: result.usage?.input_tokens ?? null,
        output_tokens: result.usage?.output_tokens ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    return { runId: run.id as number, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('ai_runs')
      .update({ status: 'failed', error: message.slice(0, 1000), finished_at: new Date().toISOString() })
      .eq('id', run.id)
    throw err
  }
}
