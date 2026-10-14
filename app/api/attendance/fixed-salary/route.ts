import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getFixedSalaryHistory } from '@/lib/supabase/queries/attendance-admin'
import { kstDate } from '@/lib/attendance/tokens'

// 점장(관리 화면): 매달 고정급 (점장 등) — 정해 두면 모든 달 인건비·근무일지 엑셀에 자동으로 들어감
// body: { label, amount }
//   처음 정할 때 = 모든 달에 적용 / 바꿀 때 = 이번 달부터 새 금액 (지난달은 예전 금액 그대로)
//   amount 0 = 이번 달부터 고정급 없음
const KEY = 'monthly_fixed_salary'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const amount = Number(String(body.amount ?? '').replace(/,/g, ''))
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 30) : ''
  if (!label || !Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const history = await getFixedSalaryHistory()
  const from = history.length === 0 ? '2000-01' : kstDate(new Date()).slice(0, 7)
  const next = [...history.filter((h) => h.from !== from), { from, label, amount: Math.round(amount) }].sort((a, b) => a.from.localeCompare(b.from))

  const supabase = createServerClient()
  const { error } = await supabase.from('system_settings').upsert({ key: KEY, value: next, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
