import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { stripVariantSuffix } from '@/lib/menu-utils'

// 레시피 템플릿 v5 파서 + 저장 일체형
// - 4시트(재료/서브레시피/레시피/포장세트) 파싱
// - ❓ / 빈 값 / 샘플(📌) 행 스킵
// - 단가는 (1세트용량 × 세트수)에서 직접 재계산 (엑셀 수식 캐시 무시)
// - 부분 입력 허용: 누락은 그냥 안 들어감 → 원가 계산 시 missing_price/no_recipe 처리

const SHEETS = {
  ingredients: '재료',
  subRecipes: '서브레시피',
  recipes: '레시피',
  packaging: '포장세트',
}

const UNK = '❓'
const SAMPLE_MARKER = '📌'

// ─── 공통 ───
function asString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function asNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const s = String(v).replace(/,/g, '').trim()
  if (!s || s === UNK || s === '-') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function isUnknown(v: unknown): boolean {
  if (v == null) return true
  const s = String(v).trim()
  return s === '' || s === UNK || s === '-'
}

function getRows(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true })
}

// ─── 시트별 파싱 ───
interface IngredientParsed {
  name: string
  unit: string
  kind: 'purchased' | 'made'
  payment_method: 'cash' | 'card' | null
  unit_price: number | null
  effective_date: string | null
}

function parseIngredients(rows: unknown[][]): IngredientParsed[] {
  const result: IngredientParsed[] = []
  // header at row 0, data from row 1
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const name = asString(r[0])
    const unit = asString(r[1])
    const kindRaw = asString(r[2])
    if (!name || !unit) continue
    if (name.startsWith('↓')) continue // 자유 추가 영역 마커
    const kind = kindRaw === '수제' ? 'made' : kindRaw === '매입' ? 'purchased' : null
    if (!kind) continue
    const payRaw = asString(r[3])
    const payment_method =
      payRaw === '현금' ? 'cash' : payRaw === '카드' ? 'card' : null
    // 단가: G/(E*F) 직접 계산 (엑셀 수식 캐시 무시)
    const setSize = asNumber(r[4])  // 1세트 용량
    const setCount = asNumber(r[5]) // 세트 수
    const totalPrice = asNumber(r[6]) // 총 가격
    let unit_price: number | null = null
    if (kind === 'purchased' && setSize && setCount && totalPrice && setSize > 0 && setCount > 0) {
      unit_price = totalPrice / (setSize * setCount)
    }
    const dateRaw = asString(r[8])
    const effective_date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null
    result.push({ name, unit, kind, payment_method, unit_price, effective_date })
  }
  return result
}

interface SubRecipeParsed {
  output_name: string
  output_quantity: number
  ingredient_name: string
  quantity: number
}

function parseSubRecipes(rows: unknown[][]): SubRecipeParsed[] {
  const result: SubRecipeParsed[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const memo = asString(r[4])
    if (memo.startsWith(SAMPLE_MARKER) || memo.includes('예시')) continue
    const output_name = asString(r[0])
    const output_quantity = asNumber(r[1])
    const ingredient_name = asString(r[2])
    const quantity = asNumber(r[3])
    if (!output_name || !ingredient_name) continue
    if (output_quantity == null || quantity == null) continue // 부분 입력 — 스킵
    result.push({ output_name, output_quantity, ingredient_name, quantity })
  }
  return result
}

interface RecipeParsed {
  product_name_normalized: string
  ingredient_name: string
  quantity: number
}

function parseRecipes(rows: unknown[][]): RecipeParsed[] {
  const result: RecipeParsed[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const productName = asString(r[0])
    const ingredient_name = asString(r[2])
    const quantity = asNumber(r[3])
    if (!productName || !ingredient_name) continue
    if (isUnknown(r[2]) || quantity == null) continue
    result.push({
      product_name_normalized: stripVariantSuffix(productName),
      ingredient_name,
      quantity,
    })
  }
  return result
}

interface PackagingParsed {
  set_name: string
  product_category: string
  serve_temp: string | null
  ingredient_name: string
  quantity: number
}

function parsePackagingSets(rows: unknown[][]): PackagingParsed[] {
  const result: PackagingParsed[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const set_name = asString(r[0])
    const product_category = asString(r[1])
    const tempRaw = asString(r[2])
    const ingredient_name = asString(r[3])
    const quantity = asNumber(r[4])
    if (!set_name || !product_category || !ingredient_name) continue
    if (isUnknown(r[3]) || quantity == null) continue
    const serve_temp = tempRaw === 'hot' || tempRaw === 'ice' ? tempRaw : null
    result.push({ set_name, product_category, serve_temp, ingredient_name, quantity })
  }
  return result
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const ingredients = parseIngredients(getRows(workbook, SHEETS.ingredients))
  const subRecipes = parseSubRecipes(getRows(workbook, SHEETS.subRecipes))
  const recipes = parseRecipes(getRows(workbook, SHEETS.recipes))
  const packaging = parsePackagingSets(getRows(workbook, SHEETS.packaging))

  if (ingredients.length === 0) {
    return NextResponse.json({ error: '재료 시트가 비어있거나 파싱 실패' }, { status: 400 })
  }

  const supabase = createServerClient()

  // ─── 1. ingredients upsert ───
  const ingPayload = ingredients.map((ing) => ({
    name: ing.name,
    unit: ing.unit,
    kind: ing.kind,
    payment_method: ing.payment_method,
    is_active: true,
  }))
  const { error: ingErr } = await supabase
    .from('ingredients')
    .upsert(ingPayload, { onConflict: 'name' })
  if (ingErr) return NextResponse.json({ error: `재료 저장 실패: ${ingErr.message}` }, { status: 500 })

  // 이름 → id 맵
  const { data: ingRows, error: ingFetchErr } = await supabase
    .from('ingredients')
    .select('id, name')
  if (ingFetchErr) return NextResponse.json({ error: ingFetchErr.message }, { status: 500 })
  const ingByName = new Map<string, number>(ingRows!.map((r) => [r.name, r.id]))

  // ─── 2. ingredient_prices (단가 있는 매입재료만) ───
  const priceRows = ingredients
    .filter((ing) => ing.kind === 'purchased' && ing.unit_price != null && ing.effective_date)
    .map((ing) => ({
      ingredient_id: ingByName.get(ing.name)!,
      unit_price: ing.unit_price!,
      effective_date: ing.effective_date!,
    }))
  if (priceRows.length > 0) {
    const { error } = await supabase
      .from('ingredient_prices')
      .upsert(priceRows, { onConflict: 'ingredient_id,effective_date' })
    if (error) return NextResponse.json({ error: `단가 저장 실패: ${error.message}` }, { status: 500 })
  }

  // ─── 3. sub_recipes + items ───
  // 출력재료별로 묶기
  const subByOutput = new Map<string, { output_quantity: number; items: SubRecipeParsed[] }>()
  for (const sr of subRecipes) {
    const id = ingByName.get(sr.output_name)
    if (!id) continue
    if (!subByOutput.has(sr.output_name)) {
      subByOutput.set(sr.output_name, { output_quantity: sr.output_quantity, items: [] })
    }
    subByOutput.get(sr.output_name)!.items.push(sr)
  }
  // sub_recipes upsert (output_ingredient_id UNIQUE)
  const subRecipePayload = [...subByOutput.entries()].map(([name, { output_quantity }]) => ({
    output_ingredient_id: ingByName.get(name)!,
    output_quantity,
  }))
  if (subRecipePayload.length > 0) {
    const { error } = await supabase
      .from('sub_recipes')
      .upsert(subRecipePayload, { onConflict: 'output_ingredient_id' })
    if (error) return NextResponse.json({ error: `서브레시피 저장 실패: ${error.message}` }, { status: 500 })
  }
  // sub_recipe_items: 기존 items 삭제 후 재삽입 (구성 변경 반영)
  const { data: subRecipeRows } = await supabase
    .from('sub_recipes')
    .select('id, output_ingredient_id')
  const subIdByOutputId = new Map<number, number>(
    (subRecipeRows ?? []).map((r) => [r.output_ingredient_id, r.id])
  )
  // 영향받은 sub_recipe_id 목록
  const affectedSubIds = [...subByOutput.keys()]
    .map((n) => subIdByOutputId.get(ingByName.get(n)!))
    .filter((x): x is number => x != null)
  if (affectedSubIds.length > 0) {
    await supabase.from('sub_recipe_items').delete().in('sub_recipe_id', affectedSubIds)
  }
  const subItemRows: { sub_recipe_id: number; ingredient_id: number; quantity: number }[] = []
  for (const [outName, { items }] of subByOutput) {
    const subId = subIdByOutputId.get(ingByName.get(outName)!)
    if (!subId) continue
    for (const it of items) {
      const ingId = ingByName.get(it.ingredient_name)
      if (!ingId) continue
      subItemRows.push({ sub_recipe_id: subId, ingredient_id: ingId, quantity: it.quantity })
    }
  }
  if (subItemRows.length > 0) {
    const { error } = await supabase.from('sub_recipe_items').insert(subItemRows)
    if (error) return NextResponse.json({ error: `서브레시피 구성 저장 실패: ${error.message}` }, { status: 500 })
  }

  // ─── 4. recipes (메뉴별) ───
  // 메뉴 단위로 기존 행 삭제 후 재삽입 (재료 구성 변경 반영)
  const menuKeys = [...new Set(recipes.map((r) => r.product_name_normalized))]
  if (menuKeys.length > 0) {
    await supabase.from('recipes').delete().in('product_name_normalized', menuKeys)
  }
  const recipeRows = recipes
    .map((r) => {
      const ingId = ingByName.get(r.ingredient_name)
      if (!ingId) return null
      return {
        product_name_normalized: r.product_name_normalized,
        ingredient_id: ingId,
        quantity: r.quantity,
      }
    })
    .filter((x): x is { product_name_normalized: string; ingredient_id: number; quantity: number } => x != null)
  // 같은 (메뉴, 재료) 중복 제거 (UNIQUE 위반 방지)
  const seen = new Set<string>()
  const dedupedRecipeRows = recipeRows.filter((r) => {
    const key = `${r.product_name_normalized}|${r.ingredient_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (dedupedRecipeRows.length > 0) {
    const { error } = await supabase.from('recipes').insert(dedupedRecipeRows)
    if (error) return NextResponse.json({ error: `레시피 저장 실패: ${error.message}` }, { status: 500 })
  }

  // ─── 5. packaging_sets + items ───
  // 세트 단위 묶기 (set_name 기준)
  const packBySet = new Map<string, { product_category: string; serve_temp: string | null; items: PackagingParsed[] }>()
  for (const p of packaging) {
    if (!packBySet.has(p.set_name)) {
      packBySet.set(p.set_name, { product_category: p.product_category, serve_temp: p.serve_temp, items: [] })
    }
    packBySet.get(p.set_name)!.items.push(p)
  }
  // upsert sets — UNIQUE는 (product_category, serve_temp) 인덱스. 같은 카테고리×온도면 갱신.
  // serve_temp null 처리는 unique index가 COALESCE로 처리됨
  for (const [setName, info] of packBySet) {
    // 기존 set 찾기
    let query = supabase
      .from('packaging_sets')
      .select('id')
      .eq('product_category', info.product_category)
    if (info.serve_temp == null) {
      query = query.is('serve_temp', null)
    } else {
      query = query.eq('serve_temp', info.serve_temp)
    }
    const { data: existing } = await query.maybeSingle()
    let setId: number
    if (existing) {
      setId = existing.id
      // items 재삽입
      await supabase.from('packaging_set_items').delete().eq('packaging_set_id', setId)
      // name 갱신
      await supabase.from('packaging_sets').update({ name: setName }).eq('id', setId)
    } else {
      const { data: created, error } = await supabase
        .from('packaging_sets')
        .insert({
          name: setName,
          product_category: info.product_category,
          serve_temp: info.serve_temp,
          is_active: true,
        })
        .select('id')
        .single()
      if (error) return NextResponse.json({ error: `포장세트 저장 실패: ${error.message}` }, { status: 500 })
      setId = created!.id
    }
    const items = info.items
      .map((it) => {
        const ingId = ingByName.get(it.ingredient_name)
        if (!ingId) return null
        return { packaging_set_id: setId, ingredient_id: ingId, quantity: it.quantity }
      })
      .filter((x): x is { packaging_set_id: number; ingredient_id: number; quantity: number } => x != null)
    // 같은 ingredient 중복 dedup
    const seen2 = new Set<number>()
    const dedupedItems = items.filter((i) => {
      if (seen2.has(i.ingredient_id)) return false
      seen2.add(i.ingredient_id)
      return true
    })
    if (dedupedItems.length > 0) {
      await supabase.from('packaging_set_items').insert(dedupedItems)
    }
  }

  // 업로드 히스토리
  await supabase.from('upload_history').insert({
    file_name: file.name,
    file_type: 'recipe',
    status: 'success',
  })

  return NextResponse.json({
    ok: true,
    stats: {
      ingredientCount: ingredients.length,
      pricedCount: priceRows.length,
      subRecipeCount: subRecipePayload.length,
      subRecipeItemCount: subItemRows.length,
      recipeMenuCount: menuKeys.length,
      recipeItemCount: dedupedRecipeRows.length,
      packagingSetCount: packBySet.size,
    },
  })
}
