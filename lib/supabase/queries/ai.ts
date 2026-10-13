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
  link: string | null
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
  const cols = 'id, agent, kind, severity, title, body, evidence, action, period, link, status, created_at'
  const [{ data: open, error }, { data: closed }] = await Promise.all([
    supabase.from('ai_inbox').select(cols).eq('status', 'new').order('created_at', { ascending: false }),
    supabase.from('ai_inbox').select(cols).neq('status', 'new').order('resolved_at', { ascending: false }).limit(20),
  ])
  if (error) throw error
  return { open: (open ?? []) as InboxItem[], closed: (closed ?? []) as InboxItem[] }
}

export type MarketingPost = {
  id: number
  run_id: number | null
  source: 'auto' | 'manual'
  topic: string
  channel: 'instagram' | 'blog'
  title: string | null
  body: string
  hashtags: string | null
  status: 'draft' | 'approved' | 'posted'
  created_at: string
  posted_at: string | null
}

// 최근 게시글 (같은 실행에서 나온 인스타·블로그를 한 묶음으로)
export async function getMarketingPosts(limit = 40): Promise<{ topic: string; source: 'auto' | 'manual'; created_at: string; posts: MarketingPost[] }[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('marketing_posts')
    .select('id, run_id, source, topic, channel, title, body, hashtags, status, created_at, posted_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const groups = new Map<string, { topic: string; source: 'auto' | 'manual'; created_at: string; posts: MarketingPost[] }>()
  for (const p of (data ?? []) as MarketingPost[]) {
    const key = p.run_id != null ? `run:${p.run_id}` : `post:${p.id}`
    const g = groups.get(key) ?? { topic: p.topic, source: p.source, created_at: p.created_at, posts: [] }
    g.posts.push(p)
    groups.set(key, g)
  }
  // 인스타 먼저
  for (const g of groups.values()) g.posts.sort((a, b) => Number(b.channel === 'instagram') - Number(a.channel === 'instagram'))
  return [...groups.values()]
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
