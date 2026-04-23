import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { recalcMonthlySummary } from '@/lib/supabase/recalc'

// 지출 항목 수정
export async function PATCH(req: NextRequest) {
  const { id, item, category, amount } = await req.json()

  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const supabase = createServerClient()

  // 업데이트 대상 row의 year/month 조회 (재계산에 필요)
  const { data: existing } = await supabase
    .from('monthly_expenses')
    .select('year, month')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('monthly_expenses')
    .update({ item, category, amount })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing) {
    await recalcMonthlySummary(supabase, existing.year, existing.month)
  }

  return NextResponse.json({ ok: true })
}

// 지출 항목 삭제
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('monthly_expenses')
    .select('year, month')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('monthly_expenses').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing) {
    await recalcMonthlySummary(supabase, existing.year, existing.month)
  }

  return NextResponse.json({ ok: true })
}
