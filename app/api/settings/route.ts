import { NextRequest, NextResponse } from 'next/server'
import { setSetting } from '@/lib/supabase/queries/settings'
import { createServerClient } from '@/lib/supabase/server'
import { recalcAllMonths } from '@/lib/supabase/recalc'

// POST { key, value } — 임의 키/값 저장.
// key가 'include_owner_personal'이면 모든 월 monthly_summary 재계산까지.
export async function POST(req: NextRequest) {
  const { key, value } = await req.json()
  if (!key) return NextResponse.json({ error: 'key 필요' }, { status: 400 })

  try {
    await setSetting(key, value)
    if (key === 'include_owner_personal') {
      const supabase = createServerClient()
      await recalcAllMonths(supabase)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
