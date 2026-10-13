import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 매장 공통 시급 이력 추가/수정/삭제 — 관리 화면 로그인 대상
// body: { effective_from: 'YYYY-MM-DD', weekday_hourly, sunday_hourly }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const weekday = Number(body.weekday_hourly)
  const sunday = Number(body.sunday_hourly)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.effective_from ?? '') || !(weekday > 0) || !(sunday > 0)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase.from('pay_rates').upsert({
    effective_from: body.effective_from,
    weekday_hourly: Math.round(weekday),
    sunday_hourly: Math.round(sunday),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { effective_from } = await req.json().catch(() => ({}))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_from ?? '')) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase.from('pay_rates').delete().eq('effective_from', effective_from)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
