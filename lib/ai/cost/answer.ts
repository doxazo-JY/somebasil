import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/attendance/tokens'
import { stripVariantSuffix } from '@/lib/menu-utils'
import { getAllMenuCosts } from '@/lib/supabase/queries/recipe-costs'
import { generateStructured, recordRun } from '../client'
import type { CostQuestionMeta } from '../agents/cost'

// 원가 AI 질문에 점장이 적은 답 → 저장안(미리보기) → 점장 확인 후 저장
//   AI는 답을 정리만 함. DB 저장은 applyProposal()에서 점장이 [이대로 저장]을 눌렀을 때만
//   저장 방식은 레시피 엑셀 업로드(app/api/upload/recipe)와 같음

type Item = { ingredient: string; quantity: number; is_new: boolean; unit: string }

export type CostProposal = {
  ok: boolean // 저장할 수 있는 상태인지
  follow_up: string | null // 답이 부족할 때 다시 물을 말
  note: string | null // 정리하면서 가정한 것
  price: { total_price: number; amount: number } | null
  sub_recipe: { output_quantity: number; items: Item[] } | null
  recipe: { same_as_menu: string | null; items: Item[] } | null
  preview: string[] // 화면에 보여줄 저장 내용
  applied?: { at: string; result: string[] }
}

const ItemSchema = z.object({
  ingredient: z.string().describe('재료 이름. 재료 목록에 있는 이름이면 목록의 이름 그대로'),
  quantity: z.number().describe('그 재료의 단위로 환산한 양 (예: 단위가 g인데 1kg이라고 했으면 1000)'),
  unit: z.string().describe('quantity의 단위 — 목록에 있는 재료면 목록의 단위'),
  is_new: z.boolean().describe('재료 목록에 없는 새 재료면 true'),
})

const ParseSchema = z.object({
  ok: z.boolean().describe('답만으로 저장할 수 있으면 true. 숫자가 빠졌거나 애매하면 false'),
  follow_up: z.string().nullable().describe('ok=false일 때 점장에게 다시 물을 말 한두 문장. ok=true면 null'),
  note: z.string().nullable().describe('정리하면서 가정하거나 뺀 것 (예: 물·얼음은 원가 0이라 뺐어요). 없으면 null'),
  price: z
    .object({
      total_price: z.number().describe('산 가격(원)'),
      amount: z.number().describe('그 가격에 산 양 — 재료 단위로 환산 (예: 단위 g, 1kg×2봉 → 2000)'),
    })
    .nullable()
    .describe('종류가 price일 때만'),
  sub_recipe: z
    .object({
      output_quantity: z.number().describe('다 만들었을 때 완성량 — 만드는 재료의 단위로'),
      items: z.array(ItemSchema),
    })
    .nullable()
    .describe('종류가 sub_recipe일 때만'),
  recipe: z
    .object({
      same_as_menu: z.string().nullable().describe('"○○랑 같아요"처럼 다른 메뉴와 같다고 하면 그 메뉴 이름 (메뉴 목록의 이름). 아니면 null'),
      items: z.array(ItemSchema).describe('한 잔(개)에 들어가는 재료. same_as_menu가 있으면 빈 배열'),
    })
    .nullable()
    .describe('종류가 recipe일 때만'),
})

const SYSTEM = `당신은 카페 "썸바실"의 원가 담당 AI입니다. 점장에게 원가 정보를 물었고, 점장이 편하게 적은 답을 저장할 수 있는 숫자로 정리합니다.

규칙:
- 점장이 쓴 숫자만 씁니다. 빠진 숫자를 추측해서 채우지 않습니다. 빠졌으면 ok=false로 하고 follow_up에 무엇이 더 필요한지 묻습니다.
- 단위를 재료 목록의 단위로 환산합니다 (kg→g ×1000, L→ml ×1000). 개수 단위 재료는 개수 그대로.
- 재료 이름은 재료 목록에서 같은 것을 찾아 목록의 이름 그대로 씁니다 (띄어쓰기·표기만 다르면 같은 재료). 목록에 없으면 is_new=true로 점장이 쓴 이름을 씁니다.
- 물·얼음·뜨거운 물은 원가 0이라 빼고 note에 적습니다.
- 질문 종류에 맞는 칸만 채우고 나머지는 null입니다.`

type IngRow = { id: number; name: string; unit: string; kind: 'purchased' | 'made' }

async function loadContext() {
  const supabase = createServerClient()
  const [{ data: ings }, { data: prices }, { data: products }] = await Promise.all([
    supabase.from('ingredients').select('id, name, unit, kind'),
    supabase.from('ingredient_prices').select('ingredient_id, unit_price, effective_date'),
    supabase.from('products').select('name').eq('is_active', true),
  ])
  const ingredients = (ings ?? []) as IngRow[]
  const priceRows = (prices ?? []) as { ingredient_id: number; unit_price: number; effective_date: string }[]
  const latest = new Map<number, number>()
  for (const p of [...priceRows].sort((a, b) => a.effective_date.localeCompare(b.effective_date))) latest.set(p.ingredient_id, p.unit_price)
  const firstDate = priceRows.map((p) => p.effective_date).sort()[0] ?? null
  return { ingredients, latest, firstDate, productNames: (products ?? []).map((p) => p.name as string) }
}

const won = (n: number) => `${Math.round(n).toLocaleString()}원`
const perUnit = (n: number, unit: string) => `${unit}당 ${n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString()}원`

// 답 → 저장안 + 미리보기 (DB는 바꾸지 않음, ai_inbox에 답·저장안만 기록)
export async function proposeFromAnswer(itemId: number, answer: string) {
  const supabase = createServerClient()
  const { data: item, error } = await supabase.from('ai_inbox').select('id, agent, kind, action, meta, status').eq('id', itemId).single()
  if (error || !item || item.agent !== 'cost' || item.kind !== 'question') throw new Error('원가 AI 질문이 아니에요')
  const meta = item.meta as CostQuestionMeta
  const ctx = await loadContext()

  const result = await recordRun('cost', 'manual', async () => {
    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: JSON.stringify({
        질문종류: meta.kind,
        대상: meta.name,
        대상단위: meta.unit,
        물어본말: item.action,
        점장답: answer,
        재료목록: ctx.ingredients.map((i) => ({ 이름: i.name, 단위: i.unit })),
        ...(meta.kind === 'recipe' ? { 메뉴목록: ctx.productNames } : {}),
      }),
      schema: ParseSchema,
      name: 'cost_answer',
    })
    return { summary: `답 정리: ${meta.name}`, output, usage, model }
  })
  const parsed = result.output

  const proposal: CostProposal = { ...parsed, preview: [] }
  const ingByName = new Map(ctx.ingredients.map((i) => [i.name, i]))
  const preview = proposal.preview
  const issues: string[] = []

  // 재료 줄 미리보기 + 단가로 원가 계산 (단가 없는 재료는 표시만)
  const describeItems = (items: Item[]) => {
    let total = 0
    let complete = true
    for (const it of items) {
      const known = ingByName.get(it.ingredient)
      if (!known && !it.is_new) issues.push(`'${it.ingredient}'을(를) 재료 목록에서 찾지 못했어요`)
      const unit = known?.unit ?? it.unit
      const price = known ? ctx.latest.get(known.id) : undefined
      if (price != null) total += price * it.quantity
      else complete = false
      preview.push(
        `· ${it.ingredient} ${it.quantity.toLocaleString()}${unit}` +
          (it.is_new ? ' (새 재료 — 가격은 다음에 물어볼게요)' : price != null ? ` = ${won(price * it.quantity)}` : known?.kind === 'made' ? ' (직접 만드는 재료)' : ' (가격 아직 없음)')
      )
    }
    return { total, complete }
  }

  if (parsed.ok && meta.kind === 'price' && parsed.price) {
    const { total_price, amount } = parsed.price
    if (amount <= 0) issues.push('산 양이 0이에요')
    else {
      preview.push(`${meta.name}: ${amount.toLocaleString()}${meta.unit ?? ''}에 ${won(total_price)} → ${perUnit(total_price / amount, meta.unit ?? '단위')}`)
    }
  } else if (parsed.ok && meta.kind === 'sub_recipe' && parsed.sub_recipe) {
    const { output_quantity, items } = parsed.sub_recipe
    preview.push(`${meta.name} 한 번 만들 때 (완성 ${output_quantity.toLocaleString()}${meta.unit ?? ''})`)
    const { total, complete } = describeItems(items)
    if (output_quantity <= 0) issues.push('완성량이 0이에요')
    else if (complete && items.length > 0) preview.push(`→ 재료비 ${won(total)} ÷ ${output_quantity.toLocaleString()} = ${perUnit(total / output_quantity, meta.unit ?? '단위')}`)
    else preview.push('→ 가격이 없는 재료가 있어서, 그 가격까지 들어오면 원가가 계산돼요')
  } else if (parsed.ok && meta.kind === 'recipe' && parsed.recipe) {
    const same = parsed.recipe.same_as_menu
    if (same) {
      const { data: rows } = await supabase.from('recipes').select('ingredient_id').eq('product_name_normalized', stripVariantSuffix(same))
      if (!rows?.length) issues.push(`'${same}'은(는) 아직 레시피가 없어서 그대로 가져올 수 없어요`)
      else preview.push(`${meta.name} = ${same}와 같은 레시피 (재료 ${rows.length}개)`)
    } else {
      preview.push(`${meta.name} 한 ${meta.category === 'dessert' ? '개' : '잔'}에`)
      const { total, complete } = describeItems(parsed.recipe.items)
      if (parsed.recipe.items.length === 0) issues.push('들어가는 재료가 없어요')
      else if (complete) preview.push(`→ 재료비 ${won(total)}${meta.menuPrice ? ` (판매가 ${won(meta.menuPrice)}의 ${Math.round((total / meta.menuPrice) * 100)}%, 포장재 별도)` : ''}`)
    }
  }

  if (parsed.ok && issues.length > 0) {
    proposal.ok = false
    proposal.follow_up = issues.join(' · ')
  }
  await supabase.from('ai_inbox').update({ answer, proposal }).eq('id', itemId)
  return proposal
}

// 점장이 [이대로 저장] — 저장안을 DB에 반영하고 질문을 완료 처리
export async function applyProposal(itemId: number) {
  const supabase = createServerClient()
  const { data: item, error } = await supabase.from('ai_inbox').select('id, agent, kind, meta, proposal, status').eq('id', itemId).single()
  if (error || !item || item.agent !== 'cost' || item.kind !== 'question') throw new Error('원가 AI 질문이 아니에요')
  if (item.status !== 'new') throw new Error('이미 처리한 질문이에요')
  const meta = item.meta as CostQuestionMeta
  const p = item.proposal as CostProposal | null
  if (!p?.ok) throw new Error('저장할 수 있는 정리안이 없어요. 답을 먼저 정리해 주세요')
  const ctx = await loadContext()
  const today = kstDate(new Date())

  // 새 재료 등록 (매입 재료, 가격은 다음 질문에서)
  const items = p.sub_recipe?.items ?? p.recipe?.items ?? []
  const fresh = items.filter((it) => it.is_new && !ctx.ingredients.some((i) => i.name === it.ingredient))
  if (fresh.length > 0) {
    const { error: e } = await supabase
      .from('ingredients')
      .upsert(fresh.map((it) => ({ name: it.ingredient, unit: it.unit, kind: 'purchased', is_active: true })), { onConflict: 'name' })
    if (e) throw new Error(`새 재료 저장 실패: ${e.message}`)
  }
  const { data: ingRows } = await supabase.from('ingredients').select('id, name')
  const idOf = new Map((ingRows ?? []).map((r) => [r.name as string, r.id as number]))
  const rowsOf = (list: Item[]) => {
    const seen = new Set<number>()
    return list
      .map((it) => ({ id: idOf.get(it.ingredient), quantity: it.quantity }))
      .filter((r): r is { id: number; quantity: number } => r.id != null && !seen.has(r.id) && !!seen.add(r.id))
  }

  if (meta.kind === 'price' && p.price && meta.ingredientId) {
    // 처음 들어가는 단가는 기존 재료들과 같은 시작일로 (지난달 분석에도 같은 가격이 쓰이게)
    const hasPrice = ctx.latest.has(meta.ingredientId)
    const effective_date = hasPrice ? today : (ctx.firstDate ?? today)
    const { error: e } = await supabase.from('ingredient_prices').upsert(
      { ingredient_id: meta.ingredientId, unit_price: p.price.total_price / p.price.amount, set_size: p.price.amount, effective_date },
      { onConflict: 'ingredient_id,effective_date' }
    )
    if (e) throw new Error(`단가 저장 실패: ${e.message}`)
  } else if (meta.kind === 'sub_recipe' && p.sub_recipe && meta.ingredientId) {
    const { data: sub, error: e1 } = await supabase
      .from('sub_recipes')
      .upsert({ output_ingredient_id: meta.ingredientId, output_quantity: p.sub_recipe.output_quantity }, { onConflict: 'output_ingredient_id' })
      .select('id')
      .single()
    if (e1 || !sub) throw new Error(`배합 저장 실패: ${e1?.message}`)
    await supabase.from('sub_recipe_items').delete().eq('sub_recipe_id', sub.id)
    const { error: e2 } = await supabase
      .from('sub_recipe_items')
      .insert(rowsOf(p.sub_recipe.items).map((r) => ({ sub_recipe_id: sub.id, ingredient_id: r.id, quantity: r.quantity })))
    if (e2) throw new Error(`배합 재료 저장 실패: ${e2.message}`)
  } else if (meta.kind === 'recipe' && p.recipe && meta.menuKey) {
    let rows: { id: number; quantity: number }[]
    if (p.recipe.same_as_menu) {
      const { data } = await supabase.from('recipes').select('ingredient_id, quantity').eq('product_name_normalized', stripVariantSuffix(p.recipe.same_as_menu))
      rows = (data ?? []).map((r) => ({ id: r.ingredient_id as number, quantity: r.quantity as number }))
    } else rows = rowsOf(p.recipe.items)
    if (rows.length === 0) throw new Error('저장할 레시피 재료가 없어요')
    await supabase.from('recipes').delete().eq('product_name_normalized', meta.menuKey)
    const { error: e } = await supabase
      .from('recipes')
      .insert(rows.map((r) => ({ product_name_normalized: meta.menuKey, ingredient_id: r.id, quantity: r.quantity })))
    if (e) throw new Error(`레시피 저장 실패: ${e.message}`)
  } else {
    throw new Error('저장안 형식이 질문과 맞지 않아요')
  }

  // 저장 후 관련 메뉴 원가 다시 계산
  const costs = await getAllMenuCosts()
  const related = new Set(meta.kind === 'recipe' ? [meta.menuKey] : meta.menus.map(stripVariantSuffix))
  const result: string[] = []
  const done = new Set<string>()
  for (const c of costs) {
    const k = stripVariantSuffix(c.productName)
    if (!related.has(k) || done.has(k)) continue
    done.add(k)
    if (c.status === 'ok') result.push(`${c.productName}: 원가 ${won(c.totalCost ?? 0)} · 원가율 ${Math.round((c.costRatio ?? 0) * 100)}%`)
    else result.push(`${c.productName}: 아직 ${c.status === 'no_recipe' ? '레시피' : (c.missingIngredients ?? []).slice(0, 2).join(', ')} 필요`)
  }

  const proposal: CostProposal = { ...p, applied: { at: new Date().toISOString(), result } }
  await supabase.from('ai_inbox').update({ status: 'done', resolved_at: new Date().toISOString(), proposal }).eq('id', itemId)
  return result
}
