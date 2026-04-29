import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { recalcAllMonths } from '@/lib/supabase/recalc'

// 모든 월의 monthly_summary 일괄 재계산
// recalc 로직 변경 (예: 'excluded' 처리 정책 변경) 후 1회 트리거하기 위한 엔드포인트
export async function POST() {
  const supabase = createServerClient()
  try {
    await recalcAllMonths(supabase)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
