import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

// 거래의 year/month → monthly_summary.total_expense 재계산
async function recalcMonthExpense(supabase: ReturnType<typeof createServerClient>, year: number, month: number) {
  const rows = await fetchAllRows<{ amount: number }>((from, to) =>
    supabase
      .from('monthly_expenses')
      .select('amount')
      .eq('year', year)
      .eq('month', month)
      .neq('category', 'excluded')
      .range(from, to),
  )
  const totalExpense = rows.reduce((s, r) => s + (r.amount ?? 0), 0)

  const { data: existing } = await supabase
    .from('monthly_summary')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (existing) {
    await supabase.from('monthly_summary').update({ total_expense: totalExpense }).eq('id', existing.id)
  } else {
    await supabase.from('monthly_summary').insert({ year, month, income: 0, total_expense: totalExpense })
  }
}

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

  // 해당 월 total_expense 재집계 (excluded로 이동하면 집계에서 빠지므로 필수)
  if (existing) {
    await recalcMonthExpense(supabase, existing.year, existing.month)
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
    await recalcMonthExpense(supabase, existing.year, existing.month)
  }

  return NextResponse.json({ ok: true })
}
