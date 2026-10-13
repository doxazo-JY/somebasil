import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 직원 수정 (직책 · 퇴사/복직) — 직원 추가는 QR 첫 등록(/api/clock/register)과 근무일지 업로드로만
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const supabase = createServerClient()

  const { error } = await supabase.from('staff').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
