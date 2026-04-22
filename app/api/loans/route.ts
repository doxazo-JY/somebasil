import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, direction, amount, counterpart, memo } = body

  if (!date || !direction || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'date / direction / amount(>0) 필수' },
      { status: 400 },
    )
  }
  if (direction !== 'borrow' && direction !== 'repay') {
    return NextResponse.json({ error: 'direction은 borrow|repay' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('loans').insert({
    date,
    direction,
    amount,
    counterpart: counterpart || null,
    memo: memo || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, date, direction, amount, counterpart, memo } = body

  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from('loans')
    .update({
      date,
      direction,
      amount,
      counterpart: counterpart || null,
      memo: memo || null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('loans').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
