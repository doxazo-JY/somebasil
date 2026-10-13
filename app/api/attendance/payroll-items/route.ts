import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 월 인건비 수기 항목 (고정급, 주휴수당 등) — 관리 화면 로그인 대상
const KINDS = ['fixed_salary', 'weekly_holiday_pay', 'other'] as const

// body: { year, month, kind, label, amount, staff_id? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const year = Number(body.year)
  const month = Number(body.month)
  const amount = Number(String(body.amount ?? '').replace(/,/g, ''))
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 50) : ''
  const staffId = body.staff_id ? Number(body.staff_id) : null
  if (
    !Number.isInteger(year) || !(month >= 1 && month <= 12) ||
    !KINDS.includes(body.kind) || !label || !Number.isFinite(amount) ||
    (staffId !== null && !Number.isInteger(staffId))
  ) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase.from('payroll_items').insert({
    year, month, kind: body.kind, label, amount: Math.round(amount), staff_id: staffId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(Number(id))) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('payroll_items').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
