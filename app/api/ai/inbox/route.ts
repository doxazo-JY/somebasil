import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 업무함 항목 상태 변경 — 관리 화면 로그인 대상
// body: { id, status: 'done' | 'dismissed' | 'new' }  ('new' = 되돌리기)
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  if (!Number.isInteger(Number(id)) || !['done', 'dismissed', 'new'].includes(status)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('ai_inbox')
    .update({ status, resolved_at: status === 'new' ? null : new Date().toISOString() })
    .eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
