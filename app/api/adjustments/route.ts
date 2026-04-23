import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { recalcMonthlySummary } from '@/lib/supabase/recalc'

interface AdjustmentInput {
  date: string
  type: 'income' | 'expense'
  direction: 'add' | 'subtract'
  amount: number
  memo?: string | null
}

function parseYearMonth(date: string): [number, number] {
  const [y, m] = date.split('-').map(Number)
  return [y, m]
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AdjustmentInput

  if (!body.date || !body.type || !body.direction || !body.amount) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
  }
  if (body.amount <= 0) {
    return NextResponse.json({ error: '금액은 0보다 커야 합니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('manual_adjustments').insert({
    date: body.date,
    type: body.type,
    direction: body.direction,
    amount: body.amount,
    memo: body.memo ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [year, month] = parseYearMonth(body.date)
  await recalcMonthlySummary(supabase, year, month)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('manual_adjustments')
    .select('date')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('manual_adjustments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing?.date) {
    const [year, month] = parseYearMonth(existing.date)
    await recalcMonthlySummary(supabase, year, month)
  }

  return NextResponse.json({ ok: true })
}
