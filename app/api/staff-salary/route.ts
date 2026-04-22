import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 과거 인건비 수동 입력 / 수정
export async function POST(req: NextRequest) {
  const { staff_id, year, month, amount } = await req.json()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('staff_salary')
    .upsert(
      { staff_id, year, month, amount },
      { onConflict: 'staff_id,year,month' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 과거 인건비 삭제
export async function DELETE(req: NextRequest) {
  const { staff_id, year, month } = await req.json()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('staff_salary')
    .delete()
    .eq('staff_id', staff_id)
    .eq('year', year)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
