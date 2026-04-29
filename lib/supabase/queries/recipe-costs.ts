import { createServerClient } from '../server'
import { stripVariantSuffix } from '@/lib/menu-utils'

// 메뉴 원가 계산 read 함수
// - 부분 입력 허용: 단가/레시피 누락 → status로 분기 ('no_recipe' | 'missing_price' | 'ok')
// - 평균 집계는 호출 측에서 status='ok' 만 필터링해서 사용

export type CostStatus = 'ok' | 'no_recipe' | 'missing_price'

export interface MenuCost {
  productId: string
  productName: string
  productCategory: string
  servingTemp: 'hot' | 'ice' | null
  price: number               // products.price (판매가)
  status: CostStatus
  baseCost?: number           // 메뉴 자체 재료 원가
  packagingCost?: number      // 포장 비용
  totalCost?: number          // base + packaging
  margin?: number             // price - totalCost
  costRatio?: number          // totalCost / price
  missingIngredients?: string[]
}

interface IngredientRow {
  id: number
  name: string
  unit: string
  kind: 'purchased' | 'made'
}

interface PriceRow {
  ingredient_id: number
  unit_price: number
  effective_date: string
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

interface RecipeRow {
  product_name_normalized: string
  ingredient_id: number
  quantity: number
}

interface PackagingSetRow {
  id: number
  product_category: string
  serve_temp: string | null
  is_active: boolean
}

interface PackagingItemRow {
  packaging_set_id: number
  ingredient_id: number
  quantity: number
}

interface ProductRow {
  id: string
  name: string
  price: number
  is_active: boolean
}

// 카테고리: products 마스터엔 카테고리 컬럼 없음. daily_sales에서 distinct로 가져옴.
async function fetchProductCategories(): Promise<Map<string, string>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('daily_sales')
    .select('product_name, category')
    .eq('source', 'pos')
    .limit(10000)
  const map = new Map<string, string>()
  for (const r of data ?? []) {
    if (!r.product_name || !r.category) continue
    const key = stripVariantSuffix(r.product_name)
    if (!map.has(key)) map.set(key, r.category)
  }
  return map
}

// products.name에서 HOT/ICE 추출
function extractTemp(name: string): 'hot' | 'ice' | null {
  if (/\b(HOT|H|핫)\b|\((HOT|H|핫)\)/i.test(name)) return 'hot'
  if (/\b(ICE|I|아이스)\b|\((ICE|I|아이스)\)/i.test(name)) return 'ice'
  return null
}

// 시점별 최신 단가 (effective_date <= asOfDate, 가장 최근)
function latestPrice(
  prices: PriceRow[],
  ingredientId: number,
  asOfDate: string,
): number | null {
  const candidates = prices
    .filter((p) => p.ingredient_id === ingredientId && p.effective_date <= asOfDate)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
  return candidates[0]?.unit_price ?? null
}

// 수제재료 잔당 단가 = Σ(구성재료 단가 × 사용량) / 산출량
// 1단계만 (수제 안에 수제 X)
function computeMadePrice(
  ingredientId: number,
  ingredients: Map<number, IngredientRow>,
  prices: PriceRow[],
  subRecipes: Map<number, SubRecipeRow>,
  subRecipeItems: SubRecipeItemRow[],
  asOfDate: string,
): { price: number | null; missing: string[] } {
  const sub = subRecipes.get(ingredientId)
  if (!sub) {
    const ing = ingredients.get(ingredientId)
    return { price: null, missing: ing ? [`${ing.name} (서브레시피 미등록)`] : [] }
  }
  const items = subRecipeItems.filter((it) => it.sub_recipe_id === sub.id)
  if (items.length === 0) {
    const ing = ingredients.get(ingredientId)
    return { price: null, missing: ing ? [`${ing.name} (서브레시피 구성 비어있음)`] : [] }
  }
  let total = 0
  const missing: string[] = []
  for (const it of items) {
    const ing = ingredients.get(it.ingredient_id)
    if (!ing) {
      missing.push(`재료 id=${it.ingredient_id}`)
      continue
    }
    if (ing.kind !== 'purchased') {
      // 1단계 제한 — 수제 안에 수제는 무시 (현재 미지원)
      missing.push(`${ing.name} (수제재료 중첩 미지원)`)
      continue
    }
    const p = latestPrice(prices, ing.id, asOfDate)
    if (p == null) {
      missing.push(`${ing.name} (단가 미등록)`)
      continue
    }
    total += p * it.quantity
  }
  if (missing.length > 0) return { price: null, missing }
  return { price: total / sub.output_quantity, missing: [] }
}

// 단일 재료의 (시점) 단가 — 매입이면 가격이력, 수제면 서브레시피 계산
function resolveIngredientPrice(
  ingredientId: number,
  ingredients: Map<number, IngredientRow>,
  prices: PriceRow[],
  subRecipes: Map<number, SubRecipeRow>,
  subRecipeItems: SubRecipeItemRow[],
  asOfDate: string,
): { price: number | null; missing: string[] } {
  const ing = ingredients.get(ingredientId)
  if (!ing) return { price: null, missing: [`재료 id=${ingredientId} 없음`] }
  if (ing.kind === 'purchased') {
    const p = latestPrice(prices, ingredientId, asOfDate)
    if (p == null) return { price: null, missing: [`${ing.name} (단가 미등록)`] }
    return { price: p, missing: [] }
  }
  return computeMadePrice(ingredientId, ingredients, prices, subRecipes, subRecipeItems, asOfDate)
}

export async function getAllMenuCosts(asOfDate?: string): Promise<MenuCost[]> {
  const supabase = createServerClient()
  const today = asOfDate ?? new Date().toISOString().slice(0, 10)

  // ─── 데이터 일괄 로드 ───
  const [
    productsRes,
    ingredientsRes,
    pricesRes,
    subRecipesRes,
    subItemsRes,
    recipesRes,
    packSetsRes,
    packItemsRes,
    categoryMap,
  ] = await Promise.all([
    supabase.from('products').select('id, name, price, is_active').eq('is_active', true),
    supabase.from('ingredients').select('id, name, unit, kind'),
    supabase.from('ingredient_prices').select('ingredient_id, unit_price, effective_date'),
    supabase.from('sub_recipes').select('id, output_ingredient_id, output_quantity'),
    supabase.from('sub_recipe_items').select('sub_recipe_id, ingredient_id, quantity'),
    supabase.from('recipes').select('product_name_normalized, ingredient_id, quantity'),
    supabase.from('packaging_sets').select('id, product_category, serve_temp, is_active').eq('is_active', true),
    supabase.from('packaging_set_items').select('packaging_set_id, ingredient_id, quantity'),
    fetchProductCategories(),
  ])

  const products = (productsRes.data ?? []) as ProductRow[]
  const ingredients = new Map<number, IngredientRow>(
    ((ingredientsRes.data ?? []) as IngredientRow[]).map((i) => [i.id, i])
  )
  const prices = (pricesRes.data ?? []) as PriceRow[]
  const subRecipes = new Map<number, SubRecipeRow>(
    ((subRecipesRes.data ?? []) as SubRecipeRow[]).map((s) => [s.output_ingredient_id, s])
  )
  const subItems = (subItemsRes.data ?? []) as SubRecipeItemRow[]
  const recipes = (recipesRes.data ?? []) as RecipeRow[]
  const packSets = (packSetsRes.data ?? []) as PackagingSetRow[]
  const packItems = (packItemsRes.data ?? []) as PackagingItemRow[]

  // 메뉴별 레시피 묶기
  const recipesByMenu = new Map<string, RecipeRow[]>()
  for (const r of recipes) {
    const arr = recipesByMenu.get(r.product_name_normalized) ?? []
    arr.push(r)
    recipesByMenu.set(r.product_name_normalized, arr)
  }

  // 포장세트 인덱스
  function findPackSet(category: string, temp: 'hot' | 'ice' | null): PackagingSetRow | null {
    return (
      packSets.find((p) => p.product_category === category && p.serve_temp === temp) ?? null
    )
  }

  function packCost(
    setId: number,
  ): { cost: number; missing: string[] } {
    const items = packItems.filter((i) => i.packaging_set_id === setId)
    let total = 0
    const missing: string[] = []
    for (const it of items) {
      const r = resolveIngredientPrice(it.ingredient_id, ingredients, prices, subRecipes, subItems, today)
      if (r.price == null) missing.push(...r.missing)
      else total += r.price * it.quantity
    }
    return { cost: total, missing }
  }

  // ─── 메뉴별 계산 ───
  const result: MenuCost[] = []
  for (const p of products) {
    const normalized = stripVariantSuffix(p.name)
    const categoryKey = stripVariantSuffix(p.name)
    const category = categoryMap.get(categoryKey) ?? ''
    const temp = extractTemp(p.name)

    const menuRecipes = recipesByMenu.get(normalized) ?? []
    const base: MenuCost = {
      productId: p.id,
      productName: p.name,
      productCategory: category,
      servingTemp: temp,
      price: p.price,
      status: 'no_recipe',
    }
    if (menuRecipes.length === 0) {
      result.push(base)
      continue
    }

    // 레시피 재료 비용 계산
    let baseCost = 0
    const missing: string[] = []
    for (const r of menuRecipes) {
      const res = resolveIngredientPrice(r.ingredient_id, ingredients, prices, subRecipes, subItems, today)
      if (res.price == null) {
        missing.push(...res.missing)
      } else {
        baseCost += res.price * r.quantity
      }
    }

    // 포장 비용
    let packagingCost = 0
    if (category) {
      const set = findPackSet(category, temp)
      if (set) {
        const pc = packCost(set.id)
        packagingCost = pc.cost
        // 포장재 단가 누락은 missing에 포함 (계산 막진 않지만 표시)
        if (pc.missing.length > 0) missing.push(...pc.missing)
      }
    }

    if (missing.length > 0) {
      result.push({
        ...base,
        status: 'missing_price',
        missingIngredients: [...new Set(missing)],
      })
      continue
    }

    const totalCost = baseCost + packagingCost
    result.push({
      ...base,
      status: 'ok',
      baseCost: Math.round(baseCost),
      packagingCost: Math.round(packagingCost),
      totalCost: Math.round(totalCost),
      margin: Math.round(p.price - totalCost),
      costRatio: p.price > 0 ? totalCost / p.price : 0,
    })
  }

  return result
}

// 요약 통계 — /recipes 헤더용
export interface CostSummary {
  totalCount: number
  okCount: number
  noRecipeCount: number
  missingPriceCount: number
  avgCostRatio: number | null  // ok 메뉴만으로 평균
}

export function summarizeCosts(costs: MenuCost[]): CostSummary {
  const ok = costs.filter((c) => c.status === 'ok')
  const noRec = costs.filter((c) => c.status === 'no_recipe').length
  const missing = costs.filter((c) => c.status === 'missing_price').length
  const avg =
    ok.length > 0
      ? ok.reduce((s, c) => s + (c.costRatio ?? 0), 0) / ok.length
      : null
  return {
    totalCount: costs.length,
    okCount: ok.length,
    noRecipeCount: noRec,
    missingPriceCount: missing,
    avgCostRatio: avg,
  }
}
