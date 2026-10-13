import { createServerClient } from '../server'

// AI 업무함 (/inbox) 조회

export type InboxItem = {
  id: number
  agent: string
  kind: 'insight' | 'alert' | 'draft'
  severity: 'info' | 'warn'
  title: string
  body: string
  evidence: { label: string; value: string }[] | null
  action: string | null
  period: string | null
  status: 'new' | 'done' | 'dismissed'
  created_at: string
}

export type AiRun = {
  id: number
  agent: string
  trigger: 'schedule' | 'manual'
  status: 'running' | 'succeeded' | 'failed'
  period: string | null
  summary: string | null
  error: string | null
  input_tokens: number | null
  output_tokens: number | null
  started_at: string
  finished_at: string | null
}

// 처리 전 항목 전부 + 최근 처리한 항목 일부
export async function getInbox(): Promise<{ open: InboxItem[]; closed: InboxItem[] }> {
  const supabase = createServerClient()
  const cols = 'id, agent, kind, severity, title, body, evidence, action, period, status, created_at'
  const [{ data: open, error }, { data: closed }] = await Promise.all([
    supabase.from('ai_inbox').select(cols).eq('status', 'new').order('created_at', { ascending: false }),
    supabase.from('ai_inbox').select(cols).neq('status', 'new').order('resolved_at', { ascending: false }).limit(20),
  ])
  if (error) throw error
  return { open: (open ?? []) as InboxItem[], closed: (closed ?? []) as InboxItem[] }
}

export async function getRecentRuns(limit = 10): Promise<AiRun[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('ai_runs')
    .select('id, agent, trigger, status, period, summary, error, input_tokens, output_tokens, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AiRun[]
}
