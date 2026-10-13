import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// 점장(관리 화면): 직원 삭제 — 관리 화면 로그인 대상
// 테스트로 만든 직원 정리용. 실제 직원은 보통 [퇴사 처리]를 씀
// 직원을 참조하는 기록을 모두 같이 지움 (되돌릴 수 없음):
//   attendance_logs(QR 출퇴근) → staff_devices(폰) → payroll_items(수기 항목)
//   → work_logs(근무일지 업로드) → staff_salary(월 지급액) → staff

const RELATED = ['attendance_logs', 'staff_devices', 'payroll_items', 'work_logs', 'staff_salary'] as const

async function countRelated(staffId: number) {
  const supabase = createServerClient()
  const results = await Promise.all(
    RELATED.map((t) => supabase.from(t).select('*', { count: 'exact', head: true }).eq('staff_id', staffId))
  )
  return Object.fromEntries(RELATED.map((t, i) => [t, results[i].count ?? 0])) as Record<(typeof RELATED)[number], number>
}

// 삭제 전 확인 창에 보여줄 "같이 지워지는 기록" 건수
export async function GET(req: NextRequest) {
  const staffId = Number(req.nextUrl.searchParams.get('staff_id'))
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ error: 'invalid_staff_id' }, { status: 400 })
  }
  return NextResponse.json(await countRelated(staffId))
}

// body: { staff_id, confirm_name } — confirm_name이 직원 이름과 정확히 같아야 삭제
export async function DELETE(req: NextRequest) {
  const { staff_id, confirm_name } = await req.json().catch(() => ({}))
  const staffId = Number(staff_id)
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ error: 'invalid_staff_id' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: staff } = await supabase.from('staff').select('id, name').eq('id', staffId).maybeSingle()
  if (!staff) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (typeof confirm_name !== 'string' || confirm_name.trim() !== staff.name.trim()) {
    return NextResponse.json({ error: 'name_mismatch' }, { status: 400 })
  }

  // 참조 순서대로 삭제 (트랜잭션 아님 — 중간 실패 시 일부만 지워질 수 있어 다시 시도하면 이어서 지움)
  for (const table of RELATED) {
    const { error } = await supabase.from(table).delete().eq('staff_id', staffId)
    if (error) {
      console.error(`[DELETE /api/attendance/staff] ${table}:`, error)
      return NextResponse.json({ error: 'delete_failed', table }, { status: 500 })
    }
  }
  const { error } = await supabase.from('staff').delete().eq('id', staffId)
  if (error) {
    console.error('[DELETE /api/attendance/staff] staff:', error)
    return NextResponse.json({ error: 'delete_failed', table: 'staff' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
