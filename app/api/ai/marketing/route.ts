import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runMarketingAgent } from '@/lib/ai/agents/marketing'

// 마케팅 게시글 — 관리 화면 로그인 대상
//   POST   { topic }                         직접 주제 → 인스타·블로그 초안 생성
//   PATCH  { id, title?, body?, hashtags?, status? }  수정 / 승인 / 게시 완료 / 초안으로 되돌리기
//   DELETE { id }
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { topic } = await req.json().catch(() => ({}))
  const t = typeof topic === 'string' ? topic.trim().slice(0, 300) : ''
  if (!t) return NextResponse.json({ error: 'empty_topic' }, { status: 400 })
  try {
    await runMarketingAgent({ trigger: 'manual', source: 'manual', topic: t })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/ai/marketing]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}

const STATUSES = ['draft', 'approved', 'posted'] as const

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const updates: Record<string, string | null> = {}
  for (const key of ['title', 'body', 'hashtags'] as const) {
    if (typeof body[key] === 'string') updates[key] = body[key]
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    const now = new Date().toISOString()
    updates.status = body.status
    if (body.status === 'draft') Object.assign(updates, { approved_at: null, posted_at: null })
    if (body.status === 'approved') Object.assign(updates, { approved_at: now, posted_at: null })
    if (body.status === 'posted') updates.posted_at = now // 승인 시각은 그대로
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('marketing_posts').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(Number(id))) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('marketing_posts').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
