import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 기준 기록 — 같은 직원·같은 날 종이 근무일지와 QR이 둘 다 있으면 어느 쪽으로 계산할지
// body: { priority: 'paper' | 'qr' }  (paper = 기본, QR과 병행하는 동안 / qr = QR로 넘어갈 때)
const KEY = 'attendance_source_priority'

export async function POST(req: NextRequest) {
  const { priority } = await req.json().catch(() => ({}))
  if (priority !== 'paper' && priority !== 'qr') return NextResponse.json({ error: 'invalid_priority' }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from('system_settings').upsert({ key: KEY, value: priority, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
