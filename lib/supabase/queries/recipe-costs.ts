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
  set_size: number | null
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
    supabase.from('ingredient_prices').select('ingredient_id, unit_price, set_size, effective_date'),
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

// ─────────────────────────────────────────────
// 재료 회수율 — /recipes 회수율 탭
// 현금 4종(원두·우유·말차파우더·잠봉뵈르햄)만 거래 단위 추적 가능
// 흐름: 마지막 매입 거래일 → 그 거래로 산 g 수 = amount/unit_price
//       → 매입일 이후 N일간 그 재료 쓴 메뉴 마진 누적
//       → 회수율 = 누적 마진 / 매입가
// ─────────────────────────────────────────────

const CASH_SUPPLIERS: { ingredient: string; counterpart: string }[] = [
  { ingredient: '원두', counterpart: '홍인호' },
  { ingredient: '말차파우더', counterpart: '김인성' },
  { ingredient: '우유', counterpart: '한성욱' },
  { ingredient: '잠봉뵈르햄', counterpart: '소금집' },
]

export interface IngredientRecovery {
  ingredientId: number
  ingredientName: string
  counterpart: string
  unit: string
  unitPrice: number               // 원/단위
  lastPurchaseDate: string | null // 'YYYY-MM-DD'
  lastPurchaseAmount: number      // 마지막 매입 금액 (원)
  estimatedQuantityBought: number // amount / unitPrice (g 등)
  daysElapsed: number             // 마지막 매입일 ~ 오늘
  estimatedUsedQty: number        // 그 기간 추정 사용량
  progressRatio: number           // estimatedUsedQty / estimatedQuantityBought
  cumulativeMargin: number        // 그 기간 그 재료 쓰는 ok 메뉴 마진 누적
  recoveryRatio: number | null    // cumulativeMargin / lastPurchaseAmount
  menuCount: number
}

interface DailySalesAggRow {
  product_name: string
  quantity: number | null
  date: string
}

interface ExpenseRow {
  date: string | null
  counterpart: string | null
  amount: number
}

function ksTodayStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return kst.toISOString().slice(0, 10)
}

function daysBetween(fromDate: string, toDate: string): number {
  const a = new Date(fromDate + 'T00:00:00Z').getTime()
  const b = new Date(toDate + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((b - a) / (24 * 3600 * 1000)))
}

export async function getIngredientRecovery(
  costs: MenuCost[],
): Promise<IngredientRecovery[]> {
  const supabase = createServerClient()
  const today = ksTodayStr()

  // ─── 데이터 일괄 로드 ───
  const [
    ingredientsRes,
    pricesRes,
    recipesRes,
    expensesRes,
  ] = await Promise.all([
    supabase.from('ingredients').select('id, name, unit, kind, payment_method'),
    supabase.from('ingredient_prices').select('ingredient_id, unit_price, set_size, effective_date'),
    supabase.from('recipes').select('product_name_normalized, ingredient_id, quantity'),
    // 현금 4종 거래만 — 마지막 매입일 찾기용
    supabase
      .from('monthly_expenses')
      .select('date, counterpart, amount')
      .in('counterpart', CASH_SUPPLIERS.map((s) => s.counterpart))
      .order('date', { ascending: false })
      .limit(200),
  ])

  type IngFull = { id: number; name: string; unit: string; kind: 'purchased' | 'made'; payment_method: 'cash' | 'card' | null }
  const ingredients = (ingredientsRes.data ?? []) as IngFull[]
  const prices = (pricesRes.data ?? []) as PriceRow[]
  const recipes = (recipesRes.data ?? []) as RecipeRow[]
  const expenses = (expensesRes.data ?? []) as ExpenseRow[]

  const ingByName = new Map<string, IngFull>()
  for (const i of ingredients) ingByName.set(i.name, i)

  // 거래처별 마지막 매입 거래
  const lastPurchaseByCounterpart = new Map<string, ExpenseRow>()
  for (const e of expenses) {
    if (!e.counterpart || !e.date) continue
    if (!lastPurchaseByCounterpart.has(e.counterpart)) {
      lastPurchaseByCounterpart.set(e.counterpart, e)
    }
  }

  // 메뉴 → ok 메뉴 마진 (normalized 키)
  const marginByMenu = new Map<string, number>()
  for (const c of costs) {
    if (c.status !== 'ok' || c.margin == null) continue
    const key = stripVariantSuffix(c.productName)
    const prev = marginByMenu.get(key)
    marginByMenu.set(key, prev != null ? (prev + c.margin) / 2 : c.margin)
  }

  // 재료 → 그 재료 쓰는 메뉴 레시피
  const recipesByIngredient = new Map<number, RecipeRow[]>()
  for (const r of recipes) {
    const arr = recipesByIngredient.get(r.ingredient_id) ?? []
    arr.push(r)
    recipesByIngredient.set(r.ingredient_id, arr)
  }

  // 재료별 최신 단가
  function latestPriceRow(ingredientId: number): PriceRow | null {
    return (
      prices
        .filter((p) => p.ingredient_id === ingredientId && p.effective_date <= today)
        .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0] ?? null
    )
  }

  // 매입일 ~ 오늘까지 daily_sales 한 번에 가져오기 (가장 오래된 매입일 기준)
  let oldestSinceDate = today
  for (const ex of lastPurchaseByCounterpart.values()) {
    if (ex.date && ex.date < oldestSinceDate) oldestSinceDate = ex.date
  }
  const salesRes = await supabase
    .from('daily_sales')
    .select('product_name, quantity, date')
    .gte('date', oldestSinceDate)
    .lte('date', today)
    .eq('source', 'pos')
    .limit(50000)
  const sales = (salesRes.data ?? []) as DailySalesAggRow[]

  // 메뉴 × 날짜별 잔수 — 매입일 이후 필터용
  function totalQtySince(menuKey: string, sinceDate: string): number {
    let total = 0
    for (const s of sales) {
      if (!s.product_name || s.date < sinceDate) continue
      if (stripVariantSuffix(s.product_name) === menuKey) {
        total += s.quantity ?? 0
      }
    }
    return total
  }

  const result: IngredientRecovery[] = []
  for (const supplier of CASH_SUPPLIERS) {
    const ing = ingByName.get(supplier.ingredient)
    if (!ing) continue
    const priceRow = latestPriceRow(ing.id)
    if (!priceRow) continue
    const lastEx = lastPurchaseByCounterpart.get(supplier.counterpart)

    const unitPrice = priceRow.unit_price
    const lastPurchaseDate = lastEx?.date ?? null
    const lastPurchaseAmount = lastEx?.amount ?? 0
    const estimatedQuantityBought =
      lastPurchaseAmount > 0 && unitPrice > 0 ? lastPurchaseAmount / unitPrice : 0
    const daysElapsed = lastPurchaseDate ? daysBetween(lastPurchaseDate, today) : 0

    const menuRecipes = recipesByIngredient.get(ing.id) ?? []

    let estimatedUsedQty = 0
    let cumulativeMargin = 0
    if (lastPurchaseDate) {
      for (const mr of menuRecipes) {
        const qty = totalQtySince(mr.product_name_normalized, lastPurchaseDate)
        estimatedUsedQty += qty * mr.quantity
        const margin = marginByMenu.get(mr.product_name_normalized)
        if (margin != null) {
          cumulativeMargin += qty * margin
        }
      }
    }

    const progressRatio =
      estimatedQuantityBought > 0 ? estimatedUsedQty / estimatedQuantityBought : 0
    const recoveryRatio =
      lastPurchaseAmount > 0 ? cumulativeMargin / lastPurchaseAmount : null

    result.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      counterpart: supplier.counterpart,
      unit: ing.unit,
      unitPrice,
      lastPurchaseDate,
      lastPurchaseAmount,
      estimatedQuantityBought,
      daysElapsed,
      estimatedUsedQty,
      progressRatio,
      cumulativeMargin,
      recoveryRatio,
      menuCount: menuRecipes.length,
    })
  }

  // 회수율 desc, null은 뒤
  result.sort((a, b) => {
    if (a.recoveryRatio == null && b.recoveryRatio == null) return 0
    if (a.recoveryRatio == null) return 1
    if (b.recoveryRatio == null) return -1
    return b.recoveryRatio - a.recoveryRatio
  })

  return result
}
