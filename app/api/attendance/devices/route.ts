import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 등록된 폰 해제 (분실·교체) — 관리 화면 로그인 대상
// 기록은 지우지 않고 revoked_at만 표시 → 이 폰으로는 더 이상 출퇴근 불가
export async function DELETE(req: NextRequest) {
  const { device_id } = await req.json().catch(() => ({}))
  const id = Number(device_id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase
    .from('staff_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
