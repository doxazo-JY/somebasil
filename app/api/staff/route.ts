import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 직원 추가
export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('staff')
    .insert({ ...body, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 직원 수정
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const supabase = createServerClient()

  const { error } = await supabase.from('staff').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
