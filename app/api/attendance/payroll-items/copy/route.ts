import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 지난달 고정급(점장·매니저 등)을 이번 달 수기 항목으로 복사 — 관리 화면 로그인 대상
// 주휴수당·기타는 달마다 달라서 복사하지 않음. 이번 달에 같은 이름의 고정급이 이미 있으면 건너뜀
// body: { year, month } — 복사해 넣을 달
export async function POST(req: NextRequest) {
  const { year, month } = await req.json().catch(() => ({}))
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !(m >= 1 && m <= 12)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }

  const supabase = createServerClient()
  const [{ data: src, error: e1 }, { data: cur, error: e2 }] = await Promise.all([
    supabase.from('payroll_items').select('staff_id, label, amount').eq('year', prev.y).eq('month', prev.m).eq('kind', 'fixed_salary'),
    supabase.from('payroll_items').select('label').eq('year', y).eq('month', m).eq('kind', 'fixed_salary'),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })

  const existing = new Set((cur ?? []).map((r) => r.label.trim()))
  const rows = (src ?? [])
    .filter((r) => !existing.has(r.label.trim()))
    .map((r) => ({ year: y, month: m, kind: 'fixed_salary', label: r.label, amount: r.amount, staff_id: r.staff_id, source: 'manual' }))

  if (rows.length > 0) {
    const { error } = await supabase.from('payroll_items').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, copied: rows.length, found: (src ?? []).length })
}
