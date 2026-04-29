import { createServerClient } from '../server'
import { stripVariantSuffix } from '@/lib/menu-utils'

// 매출 기반 추정 자재비 — 메뉴 원가 데이터 활용
// "이번 달 매출에서 자재비 얼마 빠졌나" 계산
// - 매출(daily_sales) × 메뉴 레시피(recipes) × 재료 단가(ingredient_prices)
// - 수제재료는 매입재료로 분해해서 누적 (흑임자크림 80g → 흑임자 20g + 생크림 60g)
// - 단가 등록된 재료만 합산 — 미등록은 0 처리 (실제로는 더 클 수 있음)

interface IngFull {
  id: number
  kind: 'purchased' | 'made'
}

interface PriceRow {
  ingredient_id: number
  unit_price: number
  effective_date: string
}

interface RecipeRow {
  product_name_normalized: string
  ingredient_id: number
  quantity: number
}

interface SubRecipeRow {
  id: number
  output_ingredient_id: number
  output_quantity: number
}

interface SubRecipeItemRow {
  sub_recipe_id: number
  ingredient_id: number
  quantity: number
}

interface DailySalesAgg {
  product_name: string
  quantity: number | null
  amount: number | null
  date: string
}

function expandToPurchased(
  ingredientId: number,
  quantity: number,
  ingredients: Map<number, IngFull>,
  subRecipes: Map<number, SubRecipeRow>,
  subItems: SubRecipeItemRow[],
): Array<{ purchasedId: number; quantity: number }> {
  const ing = ingredients.get(ingredientId)
  if (!ing) return []
  if (ing.kind === 'purchased') {
    return [{ purchasedId: ingredientId, quantity }]
  }
  const sub = subRecipes.get(ingredientId)
  if (!sub || sub.output_quantity <= 0) return []
  const items = subItems.filter((it) => it.sub_recipe_id === sub.id)
  return items
    .filter((it) => ingredients.get(it.ingredient_id)?.kind === 'purchased')
    .map((it) => ({
      purchasedId: it.ingredient_id,
      quantity: (quantity / sub.output_quantity) * it.quantity,
    }))
}

export interface MonthlyMaterialMetrics {
  material: number      // 추정 자재비 (등록 메뉴들만)
  okSales: number       // 단가 등록된 메뉴들의 매출 합
}

// 연간 월별 추정 자재비 + 등록 메뉴 매출
// "마진 분해 신뢰도 = okSales / 전체 매출"
export async function getYearlyMaterialMetrics(
  year: number,
): Promise<Map<number, MonthlyMaterialMetrics>> {
  const supabase = createServerClient()
  const fromDate = `${year}-01-01`
  const toDate = `${year}-12-31`

  const [
    salesRes,
    ingredientsRes,
    pricesRes,
    recipesRes,
    subRecipesRes,
    subItemsRes,
  ] = await Promise.all([
    supabase
      .from('daily_sales')
      .select('product_name, quantity, amount, date')
      .gte('date', fromDate)
      .lte('date', toDate)
      .eq('source', 'pos')
      .limit(50000),
    supabase.from('ingredients').select('id, kind'),
    supabase.from('ingredient_prices').select('ingredient_id, unit_price, effective_date'),
    supabase.from('recipes').select('product_name_normalized, ingredient_id, quantity'),
    supabase.from('sub_recipes').select('id, output_ingredient_id, output_quantity'),
    supabase.from('sub_recipe_items').select('sub_recipe_id, ingredient_id, quantity'),
  ])

  const sales = (salesRes.data ?? []) as DailySalesAgg[]
  const ingredients = new Map<number, IngFull>(
    ((ingredientsRes.data ?? []) as IngFull[]).map((i) => [i.id, i])
  )
  const prices = (pricesRes.data ?? []) as PriceRow[]
  const recipes = (recipesRes.data ?? []) as RecipeRow[]
  const subRecipes = new Map<number, SubRecipeRow>(
    ((subRecipesRes.data ?? []) as SubRecipeRow[]).map((s) => [s.output_ingredient_id, s])
  )
  const subItems = (subItemsRes.data ?? []) as SubRecipeItemRow[]

  // 재료별 단가 (단순화: 가장 최근 단가 사용)
  const priceByIngredient = new Map<number, number>()
  for (const p of prices) {
    priceByIngredient.set(p.ingredient_id, p.unit_price)
  }

  // 메뉴 → 매입재료 사용량 표 (확장된)
  const expandedRecipes: Array<{
    menu: string
    purchasedId: number
    qtyPerServing: number
  }> = []
  for (const r of recipes) {
    const expanded = expandToPurchased(
      r.ingredient_id,
      r.quantity,
      ingredients,
      subRecipes,
      subItems,
    )
    for (const e of expanded) {
      expandedRecipes.push({
        menu: r.product_name_normalized,
        purchasedId: e.purchasedId,
        qtyPerServing: e.quantity,
      })
    }
  }

  // 메뉴별 단가합 (잔당 자재비)
  const costPerServingByMenu = new Map<string, number>()
  for (const e of expandedRecipes) {
    const price = priceByIngredient.get(e.purchasedId)
    if (price == null) continue
    const cost = e.qtyPerServing * price
    costPerServingByMenu.set(
      e.menu,
      (costPerServingByMenu.get(e.menu) ?? 0) + cost,
    )
  }

  // 월별 누적 — material(등록 메뉴 자재비) + okSales(등록 메뉴 매출)
  const result = new Map<number, MonthlyMaterialMetrics>()
  for (const s of sales) {
    if (!s.product_name || s.date.length < 7) continue
    const month = parseInt(s.date.slice(5, 7), 10)
    const key = stripVariantSuffix(s.product_name)
    const costPer = costPerServingByMenu.get(key)
    if (costPer == null) continue
    const qty = s.quantity ?? 0
    const amount = s.amount ?? 0
    const cur = result.get(month) ?? { material: 0, okSales: 0 }
    cur.material += qty * costPer
    cur.okSales += amount
    result.set(month, cur)
  }

  return result
}
