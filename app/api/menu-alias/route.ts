import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAllPosNamesWithStatus } from '@/lib/supabase/queries/menu'

// 전체 POS 이름 + 매칭 상태 — 모달 후보
export async function GET() {
  const items = await getAllPosNamesWithStatus()
  return NextResponse.json({ items })
}

// 수동 매칭 추가 (또는 갱신)
// pos_name을 master product_id에 매핑
export async function POST(req: NextRequest) {
  const { product_id, pos_name } = await req.json()
  if (!product_id || !pos_name) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('product_aliases')
    .upsert(
      { product_id, pos_name },
      { onConflict: 'pos_name' },
    )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// 매칭 해제
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const posName = searchParams.get('pos_name')
  if (!posName) {
    return NextResponse.json({ error: 'pos_name required' }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from('product_aliases')
    .delete()
    .eq('pos_name', posName)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
