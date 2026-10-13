import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizeName } from '@/lib/attendance/tokens'

// 직원 수정 (이름 · 직책 · 퇴사/복직) — 직원 추가는 QR 첫 등록(/api/clock/register)과 근무일지 업로드로만
// 이름을 바꿀 때: 공백 정리 + 다른 직원(퇴사 포함)과 같은 이름 금지 (동명이인은 "김민지A"처럼 구분)
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const supabase = createServerClient()

  if ('name' in updates) {
    const name = normalizeName(updates.name)
    if (!name) return NextResponse.json({ error: '이름은 1~20자로 적어 주세요' }, { status: 400 })
    const { data: same } = await supabase.from('staff').select('id, name').neq('id', id)
    if ((same ?? []).some((s) => s.name.trim().replace(/\s+/g, ' ') === name)) {
      return NextResponse.json({ error: `'${name}'은(는) 이미 있는 이름이에요. 김민지A처럼 구분해 주세요` }, { status: 409 })
    }
    updates.name = name
  }

  const { error } = await supabase.from('staff').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
