import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 메뉴 마스터 활성/비활성 토글
// PATCH { id, is_active }
export async function PATCH(req: NextRequest) {
  const { id, is_active } = await req.json()
  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('products')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
