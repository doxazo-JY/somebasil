import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 인증 없는 공개 헬스체크 — UptimeRobot 같은 외부 모니터링용
// Vercel Cron(/api/cron/ping-supabase)과 별개로 Supabase keep-alive 이중 안전장치 역할도 겸함
export async function GET() {
  const supabase = createServerClient()
  const { error } = await supabase.from('monthly_summary').select('id').limit(1)

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
