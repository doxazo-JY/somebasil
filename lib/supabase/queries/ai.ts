import { createServerClient } from '../server'

// AI 업무함 (/inbox) 조회

export type InboxItem = {
  id: number
  agent: string
  kind: 'insight' | 'alert' | 'draft' | 'question'
  severity: 'info' | 'warn'
  title: string
  body: string
  evidence: { label: string; value: string }[] | null
  action: string | null
  period: string | null
  link: string | null
  meta: Record<string, unknown> | null // 원가 AI 질문 대상
  answer: string | null // 질문에 점장이 적은 답
  proposal: Record<string, unknown> | null // 답을 정리한 저장안
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
  const cols = 'id, agent, kind, severity, title, body, evidence, action, period, link, meta, answer, proposal, status, created_at'
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

// 비서 AI 최근 질문·답 (사무실 대화창에 이어서 보여줌)
export async function getAssistantHistory(limit = 6): Promise<{ q: string; a: string; at: string }[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('ai_runs')
    .select('output, started_at')
    .eq('agent', 'assistant')
    .eq('status', 'succeeded')
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data ?? [])
    .map((r) => ({ q: (r.output as { question?: string })?.question ?? '', a: (r.output as { answer?: string })?.answer ?? '', at: r.started_at as string }))
    .filter((x) => x.q && x.a)
    .reverse()
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

// 주간 탭용 — 선택한 주(월~일)를 경영 AI가 분석한 것 + 그 다음 주(회의 주) 수요일 추천
//   분석: ai_inbox agent=business, period=주 시작일 (처리 여부 무관, 가장 최근 실행만)
//   추천: meta.type=tip, period 'tip:YYYY-MM-DD'가 다음 주 안 (가장 최근 실행만)
export type WeeklyAiNote = Pick<InboxItem, 'id' | 'title' | 'body' | 'action' | 'severity' | 'status'>

export async function getWeeklyAiNotes(weekStart: string): Promise<{ analysis: WeeklyAiNote[]; tips: WeeklyAiNote[] }> {
  const supabase = createServerClient()
  const next = new Date(`${weekStart}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 7)
  const nextStart = next.toISOString().slice(0, 10)
  next.setUTCDate(next.getUTCDate() + 6)
  const nextEnd = next.toISOString().slice(0, 10)
  const cols = 'id, run_id, title, body, action, severity, status, created_at'
  const [{ data: analysis }, { data: tips }] = await Promise.all([
    supabase.from('ai_inbox').select(cols).eq('agent', 'business').eq('period', weekStart).order('id'),
    supabase.from('ai_inbox').select(cols).eq('agent', 'business').eq('meta->>type', 'tip').gte('period', `tip:${nextStart}`).lte('period', `tip:${nextEnd}`).order('id'),
  ])
  // 같은 주를 다시 분석했으면 처리한 예전 항목도 남아 있음 → 가장 최근 실행 것만
  const latest = (rows: (WeeklyAiNote & { run_id: number | null })[] | null) => {
    const list = rows ?? []
    const runId = Math.max(...list.map((r) => r.run_id ?? 0))
    return list.filter((r) => (r.run_id ?? 0) === runId).map((r) => ({ id: r.id, title: r.title, body: r.body, action: r.action, severity: r.severity, status: r.status }))
  }
  return { analysis: latest(analysis as never), tips: latest(tips as never) }
}
