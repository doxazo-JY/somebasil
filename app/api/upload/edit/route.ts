import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 지출 항목 수정
export async function PATCH(req: NextRequest) {
  const { id, item, category, amount } = await req.json()

  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from('monthly_expenses')
    .update({ item, category, amount })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 지출 항목 삭제
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('monthly_expenses').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
