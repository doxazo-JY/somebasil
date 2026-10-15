import { createServerClient } from '@/lib/supabase/server'
import { recalcMonthlySummary } from '@/lib/supabase/recalc'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import type { DailySalesRow } from './daily-sales'
import type { BankRow } from './bank'
import type { MenuRow } from './menu'
import { createMenuMatcher, stripVariantSuffix, type MatchAlias } from '@/lib/menu-utils'

// 통합 업로드 저장 — 같은 파일을 다시 넣어도 중복되지 않음
//   매출: 파일이 담은 기간을 파일 내용으로 맞춤 — (date, order_id, line_no) 덮어쓰기 → 그 기간에서 파일에 없는 줄 삭제
//         (나중에 취소된 주문, 판매 금액 0원 서비스, 예전 방식으로 잘못 들어간 줄 정리. 덮어쓴 뒤 지워서 도중에 끊겨도 데이터가 비지 않음)
//   통장 입금: (tx_time, balance_after) 기준 덮어쓰기
//   통장 출금: 이미 있는 거래는 건드리지 않음 → 점장이 재분류한 카테고리가 다시 올려도 유지됨

type Supabase = ReturnType<typeof createServerClient>
const CHUNK = 500

async function recalcMonths(supabase: Supabase, dates: string[]) {
  const months = new Set(dates.map((d) => d.slice(0, 7)))
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number)
    await recalcMonthlySummary(supabase, y, m)
  }
}

// from~to = 파일이 담은 기간 (파일명 기간, 없으면 들어 있는 날짜 범위). 반환: 정리한 옛 줄 수
export async function saveDailySales(rows: DailySalesRow[], from: string, to: string): Promise<{ removed: number }> {
  const supabase = createServerClient()
  const withSource = rows.map((r) => ({ ...r, source: 'pos' }))
  for (let i = 0; i < withSource.length; i += CHUNK) {
    const { error } = await supabase.from('daily_sales').upsert(withSource.slice(i, i + CHUNK), { onConflict: 'date,order_id,line_no,source' })
    if (error) throw new Error(`매출 저장 실패: ${error.message}`)
  }

  // 파일에 매출이 있는 날짜만, 파일에 없는 줄 삭제
  //   (파일에 아예 없는 날짜는 건드리지 않음 — 파일이 덜 받아졌어도 기존 매출이 지워지지 않게)
  const keep = new Set(rows.map((r) => `${r.date}|${r.order_id}|${r.line_no}`))
  const fileDates = new Set(rows.map((r) => r.date))
  const existing = await fetchAllRows<{ id: number; date: string; order_id: string; line_no: number }>((a, b) =>
    supabase.from('daily_sales').select('id, date, order_id, line_no').eq('source', 'pos').gte('date', from).lte('date', to).range(a, b)
  )
  const stale = existing.filter((r) => fileDates.has(r.date) && !keep.has(`${r.date}|${r.order_id}|${r.line_no}`)).map((r) => r.id)
  for (let i = 0; i < stale.length; i += CHUNK) {
    const { error } = await supabase.from('daily_sales').delete().in('id', stale.slice(i, i + CHUNK))
    if (error) throw new Error(`옛 매출 줄 정리 실패: ${error.message}`)
  }

  await recalcMonths(supabase, [...rows.map((r) => r.date), ...existing.filter((r) => stale.includes(r.id)).map((r) => r.date)])
  return { removed: stale.length }
}

export type UncertainTx = { id: number; date: string; memo: string; counterpart: string; amount: number; category: string }

// 반환: 새로 들어간 출금 건수 + 그중 자동 분류가 애매한 것 (업로드 후 확인 목록)
export async function saveBank(rows: BankRow[]): Promise<{ newExpenses: number; incomes: number; uncertain: UncertainTx[] }> {
  const supabase = createServerClient()

  const incomes = rows
    .filter((r) => r.type === 'income')
    .map((r) => ({ date: r.date, tx_time: r.tx_time, balance_after: r.balance_after, memo: r.memo, counterpart: r.counterpart, amount: r.income ?? 0 }))
  for (let i = 0; i < incomes.length; i += CHUNK) {
    const { error } = await supabase.from('bank_income').upsert(incomes.slice(i, i + CHUNK), { onConflict: 'tx_time,balance_after' })
    if (error) throw new Error(`통장 입금 저장 실패: ${error.message}`)
  }

  const expenseRows = rows.filter((r) => r.type === 'expense')
  const expenses = expenseRows.map((r) => {
    const [year, month] = r.date.split('-').map(Number)
    return { year, month, date: r.date, tx_time: r.tx_time, balance_after: r.balance_after, category: r.category, item: r.memo, counterpart: r.counterpart, amount: r.expense ?? 0 }
  })
  const inserted: { id: number; tx_time: string; balance_after: number }[] = []
  for (let i = 0; i < expenses.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('monthly_expenses')
      .upsert(expenses.slice(i, i + CHUNK), { onConflict: 'tx_time,balance_after', ignoreDuplicates: true })
      .select('id, tx_time, balance_after')
    if (error) throw new Error(`통장 출금 저장 실패: ${error.message}`)
    inserted.push(...(data ?? []))
  }
  await recalcMonths(supabase, expenseRows.map((r) => r.date))

  // 새로 들어간 출금 중 애매한 것 (tx_time 표기가 달라도 같은 시각이면 같은 거래)
  const key = (t: string, b: number) => `${new Date(t).getTime()}|${b}`
  const newIds = new Map(inserted.map((r) => [key(r.tx_time, r.balance_after), r.id]))
  const uncertain: UncertainTx[] = []
  for (const r of expenseRows) {
    const id = newIds.get(key(r.tx_time, r.balance_after))
    if (id != null && r.uncertain) uncertain.push({ id, date: r.date, memo: r.memo, counterpart: r.counterpart, amount: r.expense ?? 0, category: r.category })
  }
  return { newExpenses: inserted.length, incomes: incomes.length, uncertain }
}

export type MenuSaveResult = { added: number; renamed: number; deactivated: number; aliased: number; recipesMoved: number }

// POS 메뉴 목록 저장 — 메뉴 목록은 4/25 이후 손으로 정리해 둔 상태라 그걸 지키면서 갱신
//   이미 있는 메뉴: 이름·가격만 새 값. 사용 여부는 그대로 (파일이 "사용 N"이면 미사용으로)
//     단 미사용이었는데 새 이름으로 최근 60일 판매가 있고, 그 판매가 다른 메뉴에 연결돼 있지 않으면 사용으로 (POS가 그 ID로 팔고 있음)
//   새 메뉴: 파일이 사용 Y면 사용. 단 이름이 같은 사용 중 메뉴가 이미 있으면 미사용 (같은 메뉴가 두 벌 — POS 화면이 둘)
//   파일에 없는 메뉴: POS에서 지운 것 → 미사용
//   이름이 바뀐 메뉴: 옛 이름으로 팔린 기록이 있으면 옛 이름을 수동 매칭으로 남김 + 레시피 키를 새 이름으로 옮김
export async function saveMenu(rows: MenuRow[]): Promise<MenuSaveResult> {
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const { data: existing, error: e0 } = await supabase.from('products').select('id, name, price, is_active')
  if (e0) throw new Error(`메뉴 목록 조회 실패: ${e0.message}`)
  const byId = new Map((existing ?? []).map((p) => [p.id as string, p]))

  // 같은 ID가 파일에 두 번 나오면 첫 줄만
  const seen = new Set<string>()
  const fileRows = rows.filter((r) => !seen.has(r.id) && !!seen.add(r.id))

  // 최근 60일 판매 이름 (키)
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  const recent = await fetchAllRows<{ product_name: string | null }>((a, b) => supabase.from('daily_sales').select('product_name').eq('source', 'pos').gte('date', since).range(a, b))
  const recentNames = [...new Set(recent.map((r) => r.product_name).filter((n): n is string => !!n))]
  const { data: aliasNow } = await supabase.from('product_aliases').select('product_id, pos_name')

  // 계속 사용인 메뉴의 (새) 이름 키
  const activeKeys = new Set(fileRows.filter((r) => r.is_active && byId.get(r.id)?.is_active).map((r) => stripVariantSuffix(r.name)))
  // 지금(새 이름 기준) 연결되는 판매 이름 — 수동 매칭·자동 매칭 모두. 여기 안 걸리는 최근 판매만 되살릴 근거
  const staying = fileRows.filter((r) => r.is_active && byId.get(r.id)?.is_active).map((r) => ({ id: r.id, name: r.name, is_active: true }))
  const stayingIds = new Set(staying.map((p) => p.id))
  const matchNow = createMenuMatcher(staying, (aliasNow ?? []).filter((a) => stayingIds.has(a.product_id as string)) as MatchAlias[])
  const orphanKeys = new Set(recentNames.filter((n) => !matchNow(n)).map(stripVariantSuffix))
  const payload: { id: string; name: string; price: number; is_active: boolean; updated_at: string }[] = []
  const renames: { id: string; from: string; to: string; active: boolean }[] = []
  let added = 0
  for (const r of fileRows) {
    const old = byId.get(r.id)
    if (old) {
      const key = stripVariantSuffix(r.name)
      let on = r.is_active && (old.is_active as boolean)
      if (r.is_active && !on && orphanKeys.has(key) && !activeKeys.has(key)) {
        on = true
        activeKeys.add(key)
      }
      payload.push({ id: r.id, name: r.name, price: r.price, is_active: on, updated_at: now })
      if (old.name !== r.name) renames.push({ id: r.id, from: old.name as string, to: r.name, active: on })
    } else {
      const key = stripVariantSuffix(r.name)
      const on = r.is_active && !activeKeys.has(key)
      if (on) activeKeys.add(key)
      payload.push({ id: r.id, name: r.name, price: r.price, is_active: on, updated_at: now })
      added++
    }
  }
  // 파일에 없는 메뉴 → 미사용 (파일이 너무 작으면 일부만 받은 것일 수 있어 건너뜀)
  const missing = fileRows.length >= 30 ? (existing ?? []).filter((p) => p.is_active && !seen.has(p.id as string)) : []
  for (const p of missing) payload.push({ id: p.id as string, name: p.name as string, price: p.price as number, is_active: false, updated_at: now })

  for (let i = 0; i < payload.length; i += CHUNK) {
    const { error } = await supabase.from('products').upsert(payload.slice(i, i + CHUNK), { onConflict: 'id' })
    if (error) throw new Error(`메뉴 저장 실패: ${error.message}`)
  }

  // 이름이 바뀐 메뉴 — 옛 이름 판매 기록 연결 + 레시피 키 이동
  let aliased = 0
  let recipesMoved = 0
  const changed = renames.filter((r) => stripVariantSuffix(r.from) !== stripVariantSuffix(r.to))
  // 같은 옛 이름을 가진 메뉴가 여럿이면(POS 화면이 둘) 사용 중인 쪽 하나만 — 레시피·옛 이름이 미사용 메뉴로 가지 않게
  const movedFrom = new Set<string>()
  if (changed.length > 0) {
    const sales = await fetchAllRows<{ product_name: string | null }>((a, b) => supabase.from('daily_sales').select('product_name').eq('source', 'pos').range(a, b))
    const soldNames = [...new Set(sales.map((s) => s.product_name).filter((n): n is string => !!n))]
    const { data: aliasRows } = await supabase.from('product_aliases').select('pos_name')
    const hasAlias = new Set((aliasRows ?? []).map((a) => a.pos_name as string))
    const aliases: { product_id: string; pos_name: string }[] = []
    for (const r of [...changed].sort((a, b) => Number(b.active) - Number(a.active))) {
      const oldKey = stripVariantSuffix(r.from)
      if (!r.active || movedFrom.has(oldKey)) continue
      movedFrom.add(oldKey)
      for (const n of soldNames) if (stripVariantSuffix(n) === oldKey && !hasAlias.has(n)) { aliases.push({ product_id: r.id, pos_name: n }); hasAlias.add(n) }
      // 레시피는 메뉴 이름 키로 저장됨 → 새 이름에 레시피가 없을 때만 옮김
      const newKey = stripVariantSuffix(r.to)
      const { count } = await supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('product_name_normalized', newKey)
      if (!count) {
        const { data: moved, error } = await supabase.from('recipes').update({ product_name_normalized: newKey }).eq('product_name_normalized', oldKey).select('id')
        if (error) throw new Error(`레시피 이름 옮기기 실패: ${error.message}`)
        if (moved?.length) recipesMoved++
      }
    }
    if (aliases.length > 0) {
      const { error } = await supabase.from('product_aliases').insert(aliases)
      if (error) throw new Error(`옛 이름 연결 실패: ${error.message}`)
      aliased = aliases.length
    }
  }
  return { added, renamed: renames.length, deactivated: missing.length, aliased, recipesMoved }
}
