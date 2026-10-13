import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { newToken } from '@/lib/attendance/tokens'

// 점장(관리 화면): 카운터 QR 교체 — 관리 화면 로그인 대상
// 기존 QR(사진으로 찍어 간 것 포함)은 즉시 무효. 새 QR을 다시 출력해 붙여야 함
// 등록된 폰은 그대로 유지됨 (폰 쿠키와 QR 비밀값은 별개)
export async function POST() {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: 'attendance_qr_secret', value: newToken(), updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
