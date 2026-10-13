import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): QR 기록 시작일 설정 — 관리 화면 로그인 대상
// 이 날짜 전 = 종이 근무일지(업로드), 이 날짜부터 = QR 출퇴근으로 근무일지·인건비 계산
// body: { date: 'YYYY-MM-DD' | null }  (null = 해제 → 전부 종이 근무일지)
const KEY = 'attendance_qr_start_date'

export async function POST(req: NextRequest) {
  const { date } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  if (date === null) {
    const { error } = await supabase.from('system_settings').delete().eq('key', KEY)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: KEY, value: date, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
