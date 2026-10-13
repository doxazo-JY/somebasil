import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { getAllMenuCosts } from '@/lib/supabase/queries/recipe-costs'
import { normalizeProductName, stripVariantSuffix } from '@/lib/menu-utils'

// 원가 계산이 막힌 곳 찾기 (AI 호출 없음)
//   price      : 매입 재료 단가가 없음 → "얼마짜리를 얼마나 사요?"
//   sub_recipe : 직접 만드는 재료의 배합이 없음 → "뭘 얼마나 넣고, 완성량은?"
//   recipe     : 메뉴 레시피가 없음 → "한 잔(개)에 뭘 얼마나 넣어요?"
// 우선순위 = 풀리는 메뉴의 최근 60일 매출 (같으면 메뉴 수)

export type GapKind = 'price' | 'sub_recipe' | 'recipe'

export type CostGap = {
  key: string // 같은 빈 곳을 다시 묻지 않기 위한 키
  kind: GapKind
  name: string // 재료 이름 (price·sub_recipe) / 메뉴 이름 (recipe)
  unit: string | null // 재료 단위 (g·ml·개 …)
  ingredientId: number | null
  menuKey: string | null // recipe: 레시피 저장 키 (stripVariantSuffix)
  menus: string[] // 이게 채워지면 계산되는 메뉴 (다른 빈 곳이 같이 막고 있으면 그것도 필요)
  sales60: number // 그 메뉴들의 최근 60일 매출
  menuPrice: number | null // recipe: 판매가
  category: string | null // recipe: 메뉴 분류
}

const MISSING_RE = /^(.*) \((단가 미등록|서브레시피 미등록|서브레시피 구성 비어있음)\)$/

export async function findCostGaps(now = new Date()): Promise<{ gaps: CostGap[]; menuCount: number; okCount: number }> {
  const supabase = createServerClient()
  const since = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10)

  const [costs, { data: ingredients }, sales] = await Promise.all([
    getAllMenuCosts(),
    supabase.from('ingredients').select('id, name, unit, kind'),
    fetchAllRows<{ product_name: string; amount: number }>((from, to) =>
      supabase.from('daily_sales').select('product_name, amount').eq('source', 'pos').gte('date', since).range(from, to)
    ),
  ])

  const ingByName = new Map((ingredients ?? []).map((i) => [i.name as string, i as { id: number; name: string; unit: string; kind: string }]))
  const salesByKey = new Map<string, number>()
  for (const s of sales) {
    const k = stripVariantSuffix(s.product_name)
    salesByKey.set(k, (salesByKey.get(k) ?? 0) + (s.amount ?? 0))
  }

  const gaps = new Map<string, CostGap & { menuKeys: Set<string> }>()
  const add = (key: string, base: Omit<CostGap, 'key' | 'menus' | 'sales60'>, menuName: string, menuKey: string) => {
    const g = gaps.get(key) ?? { ...base, key, menus: [], sales60: 0, menuKeys: new Set<string>() }
    // HOT/ICE는 한 메뉴로 (레시피도 같은 키)
    if (!g.menuKeys.has(menuKey)) {
      g.menuKeys.add(menuKey)
      g.menus.push(menuName)
      g.sales60 += salesByKey.get(menuKey) ?? 0
    }
    gaps.set(key, g)
  }

  for (const c of costs) {
    const menuKey = stripVariantSuffix(c.productName)
    const menuName = normalizeProductName(c.productName, c.productCategory)
    if (c.status === 'no_recipe') {
      add(`recipe:${menuKey}`, { kind: 'recipe', name: menuName, unit: null, ingredientId: null, menuKey, menuPrice: c.price, category: c.productCategory || null }, menuName, menuKey)
      continue
    }
    if (c.status !== 'missing_price') continue
    for (const m of c.missingIngredients ?? []) {
      const hit = MISSING_RE.exec(m)
      if (!hit) continue
      const ing = ingByName.get(hit[1])
      if (!ing) continue
      const kind: GapKind = hit[2] === '단가 미등록' ? 'price' : 'sub_recipe'
      add(`${kind}:${ing.id}`, { kind, name: ing.name, unit: ing.unit, ingredientId: ing.id, menuKey: null, menuPrice: null, category: null }, menuName, menuKey)
    }
  }

  const list = [...gaps.values()]
    .map((g): CostGap => ({ key: g.key, kind: g.kind, name: g.name, unit: g.unit, ingredientId: g.ingredientId, menuKey: g.menuKey, menus: g.menus, sales60: g.sales60, menuPrice: g.menuPrice, category: g.category }))
    .sort((a, b) => b.sales60 - a.sales60 || b.menus.length - a.menus.length)
  return { gaps: list, menuCount: costs.length, okCount: costs.filter((c) => c.status === 'ok').length }
}
