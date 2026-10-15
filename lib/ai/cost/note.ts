import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/attendance/tokens'
import { stripVariantSuffix } from '@/lib/menu-utils'
import { generateStructured, recordRun } from '../client'
import type { CostQuestionMeta } from '../agents/cost'
import { proposeFromAnswer, type CostProposal } from './answer'

// 원가 AI "직접 알려 주기" — 질문을 기다리지 않고 점장이 먼저 적은 내용
//   1) AI가 무엇에 대한 내용인지만 고름 (재료 가격 / 직접 만드는 재료 배합 / 메뉴 레시피 + 대상 이름)
//   2) 그 대상으로 원가 AI 질문 항목을 만들고, 적은 내용을 답으로 바로 정리 (answer.ts — 질문에 답할 때와 같은 흐름)
//   3) 저장은 점장이 [이대로 저장]을 눌렀을 때만

const TargetSchema = z.object({
  kind: z.enum(['price', 'sub_recipe', 'recipe', 'unknown']).describe('price = 사서 쓰는 재료의 가격, sub_recipe = 매장에서 만드는 재료의 배합, recipe = 메뉴 한 잔(개) 레시피, unknown = 판단 불가'),
  target: z.string().nullable().describe('대상 이름 — price·sub_recipe면 재료 목록의 이름 그대로, recipe면 메뉴 목록의 이름 그대로. 목록에 없으면 null'),
  reason: z.string().describe('unknown이거나 target이 null이면 점장에게 보여줄 한 문장 (무엇을 더 적어 주면 되는지)'),
})

const SYSTEM = `당신은 카페 "썸바실"의 원가 담당 AI입니다. 점장이 원가 정보를 먼저 적어 보냈습니다. 이 내용이 무엇에 대한 것인지만 고릅니다 (숫자 정리는 다음 단계에서 합니다).

- 재료를 얼마에 샀는지 → price, target = 재료 이름
- 시럽·청·크림처럼 매장에서 만드는 재료를 어떻게 만드는지 → sub_recipe, target = 그 재료 이름
- 메뉴 한 잔(디저트면 한 개)에 무엇이 들어가는지 → recipe, target = 메뉴 이름
- 이름은 목록에서 같은 것을 찾아 목록의 이름 그대로 씁니다 (띄어쓰기·HOT/ICE 표기만 다르면 같은 것). 없으면 target = null.
- 한 번에 하나만 고릅니다. 여러 가지가 섞여 있으면 unknown으로 하고 하나씩 보내 달라고 reason에 씁니다.`

type Result = { ok: true; proposal: CostProposal } | { ok: false; error: string }

export async function startFromNote(text: string): Promise<Result> {
  const supabase = createServerClient()
  const [{ data: ings }, { data: products }] = await Promise.all([
    supabase.from('ingredients').select('id, name, unit, kind').eq('is_active', true),
    supabase.from('products').select('name, price').eq('is_active', true),
  ])
  const ingredients = (ings ?? []) as { id: number; name: string; unit: string; kind: 'purchased' | 'made' }[]
  const menus = (products ?? []) as { name: string; price: number | null }[]

  const run = await recordRun('cost', 'manual', async () => {
    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: JSON.stringify({
        점장이적은내용: text,
        재료목록: ingredients.map((i) => ({ 이름: i.name, 단위: i.unit, 종류: i.kind === 'made' ? '매장에서 만듦' : '사서 씀' })),
        메뉴목록: menus.map((m) => m.name),
      }),
      schema: TargetSchema,
      name: 'cost_note_target',
      tier: 'chat',
    })
    return { summary: `직접 알려 준 내용: ${output.target ?? '대상 모름'}`, output, usage, model }
  })
  const { kind, target, reason } = run.output
  if (kind === 'unknown' || !target) return { ok: false, error: reason || '무엇에 대한 내용인지 모르겠어요. 재료·메뉴 이름을 같이 적어 주세요.' }

  let meta: CostQuestionMeta
  let title: string
  if (kind === 'recipe') {
    const menu = menus.find((m) => m.name === target) ?? menus.find((m) => stripVariantSuffix(m.name) === stripVariantSuffix(target))
    if (!menu) return { ok: false, error: `'${target}' 메뉴를 메뉴 목록에서 찾지 못했어요` }
    const { data: sale } = await supabase.from('daily_sales').select('category').eq('product_name', menu.name).limit(1)
    meta = {
      key: `note:recipe:${stripVariantSuffix(menu.name)}`, kind, name: menu.name, unit: null, ingredientId: null,
      menuKey: stripVariantSuffix(menu.name), menus: [menu.name], menuPrice: menu.price ?? null, category: sale?.[0]?.category ?? 'etc', example: '',
    }
    title = `${menu.name} 레시피`
  } else {
    const ing = ingredients.find((i) => i.name === target)
    if (!ing) return { ok: false, error: `'${target}' 재료를 재료 목록에서 찾지 못했어요` }
    // 이 재료가 들어가는 메뉴 — 저장 뒤 원가를 다시 보여줄 대상
    const { data: used } = await supabase.from('recipes').select('product_name_normalized').eq('ingredient_id', ing.id)
    meta = {
      key: `note:${kind}:${ing.id}`, kind, name: ing.name, unit: ing.unit, ingredientId: ing.id,
      menuKey: null, menus: [...new Set((used ?? []).map((r) => r.product_name_normalized as string))], menuPrice: null, category: null, example: '',
    }
    title = kind === 'price' ? `${ing.name} 가격` : `${ing.name} 만드는 법`
  }

  // 원가 AI 질문 항목으로 남김 (업무함에 기록 · 같은 화면에서 확인 후 저장)
  const { data: row, error } = await supabase
    .from('ai_inbox')
    .insert({
      agent: 'cost',
      kind: 'question',
      severity: 'info',
      title: `점장님이 알려 줌 — ${title}`,
      body: '',
      evidence: [],
      action: text,
      period: kstDate(new Date()),
      link: '/menu?view=cost',
      meta,
    })
    .select('id')
    .single()
  if (error || !row) throw new Error(`기록 실패: ${error?.message}`)

  return { ok: true, proposal: await proposeFromAnswer(row.id as number, text) }
}
