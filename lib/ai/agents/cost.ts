import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { kstDate } from '@/lib/attendance/tokens'
import { generateStructured, recordRun, type RunTrigger } from '../client'
import { findCostGaps, type CostGap } from '../cost/gaps'

// 원가 AI (cost) — 매주 월요일 아침. 원가 계산이 막힌 곳을 찾아 점장에게 질문으로 올림
//   빈 곳 찾기·우선순위 = 규칙 (lib/ai/cost/gaps.ts), AI는 질문 문장만 씀
//   처리 안 한 질문이 있으면 합쳐서 최대 3개까지만 (한 번에 많이 물으면 안 채우게 됨)
//   숨긴 질문은 4주 동안 다시 묻지 않음
// 점장 답 → 저장안 정리·저장은 lib/ai/cost/answer.ts

export const MAX_OPEN_QUESTIONS = 3
const SKIP_DISMISSED_DAYS = 28

export type CostQuestionMeta = Pick<CostGap, 'key' | 'kind' | 'name' | 'unit' | 'ingredientId' | 'menuKey' | 'menus' | 'menuPrice' | 'category'> & {
  example: string // 답 예시 (입력칸 안내 글)
}

const QuestionSchema = z.object({
  key: z.string().describe('입력으로 받은 빈 곳의 key 그대로'),
  title: z.string().describe('한 줄 질문 제목 (예: 바닐라시럽은 어떻게 만들어요?)'),
  question: z.string().describe('점장에게 묻는 말 1~2문장. 무엇을 어떤 단위로 알려 주면 되는지 구체적으로'),
  example: z.string().describe('답 예시 한 줄 (예: 바닐라빈 2개, 설탕 500g, 물 500ml 넣고 끓이면 600ml 나와요)'),
})
const OutputSchema = z.object({ questions: z.array(QuestionSchema) })

const SYSTEM = `당신은 카페 "썸바실"의 원가 담당 AI입니다. 메뉴 원가를 계산하려면 재료 단가, 직접 만드는 재료(시럽·청·크림 등)의 배합, 메뉴 레시피가 필요한데 일부가 비어 있습니다. 점장에게 빈 정보를 묻는 질문을 씁니다.

점장은 바쁘고 원가 계산에 익숙하지 않습니다. 짧고 쉬운 말로, 저울·계량컵으로 바로 답할 수 있게 묻습니다.

빈 곳 종류:
- price: 사서 쓰는 재료의 가격이 없음 → "얼마짜리를 얼마만큼 사는지" (예: 1kg에 12,000원). 묶음이면 묶음 크기와 가격.
- sub_recipe: 매장에서 직접 만드는 재료의 배합이 없음 → "한 번 만들 때 무엇을 얼마나 넣고, 다 만들면 총 얼마나 나오는지". 완성량은 재료 무게 합이 아니라 다 만들고 통에 담은 양.
- recipe: 메뉴 레시피가 없음 → "한 잔(디저트면 한 개)에 무엇을 얼마나 넣는지". 컵·뚜껑 같은 포장재는 따로 계산되니 묻지 않음.

규칙:
- 입력의 unit(단위)이 있으면 그 단위로 답하도록 안내합니다 (g, ml, 개 등).
- 물·얼음은 원가 계산에서 빼므로 묻지 않습니다.
- 질문은 입력으로 받은 빈 곳마다 하나씩, key를 그대로 돌려줍니다.
- 지어내지 않습니다. 재료 구성을 추측해서 단정하지 말고, 예시는 "예:"처럼 가볍게 씁니다.`

export async function runCostAgent(trigger: RunTrigger, now = new Date()) {
  return recordRun<{ gaps: number; asked: number; keys: string[] }>('cost', trigger, async (runId) => {
    const supabase = createServerClient()
    const today = kstDate(now)
    const { gaps, menuCount, okCount } = await findCostGaps(now)

    // 이미 올린 질문 (처리 전) · 최근 숨긴 질문은 건너뜀
    const since = new Date(now.getTime() - SKIP_DISMISSED_DAYS * 86400000).toISOString()
    const { data: questions } = await supabase
      .from('ai_inbox')
      .select('status, meta, resolved_at')
      .eq('agent', 'cost')
      .eq('kind', 'question')
      .in('status', ['new', 'dismissed'])
    const asked = (questions ?? []).filter((a) => a.status === 'new' || (a.resolved_at && a.resolved_at >= since))
    const openCount = asked.filter((a) => a.status === 'new').length
    const skip = new Set(asked.map((a) => (a.meta as CostQuestionMeta | null)?.key).filter(Boolean))
    const picks = gaps.filter((g) => !skip.has(g.key)).slice(0, Math.max(0, MAX_OPEN_QUESTIONS - openCount))

    const status = `메뉴 ${menuCount}개 중 ${okCount}개 원가 계산됨 · 빈 곳 ${gaps.length}개`
    if (picks.length === 0) {
      return {
        summary: gaps.length === 0 ? `${status} — 다 채워졌어요` : `${status} · 기다리는 질문 ${openCount}개라 새 질문 없음`,
        output: { gaps: gaps.length, asked: 0, keys: [] },
        period: today,
      }
    }

    const input = picks.map((g) => ({
      key: g.key,
      종류: g.kind,
      이름: g.name,
      단위: g.unit,
      판매가: g.menuPrice,
      분류: g.category,
      풀리는메뉴: g.menus,
    }))
    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: `원가 계산이 막힌 곳입니다. 각각 점장에게 물을 질문을 써 주세요.\n\n${JSON.stringify(input)}`,
      schema: OutputSchema,
      name: 'cost_questions',
    })

    const byKey = new Map(output.questions.map((q) => [q.key, q]))
    const rows = picks
      .map((g) => {
        const q = byKey.get(g.key)
        if (!q) return null
        const meta: CostQuestionMeta = {
          key: g.key, kind: g.kind, name: g.name, unit: g.unit, ingredientId: g.ingredientId,
          menuKey: g.menuKey, menus: g.menus, menuPrice: g.menuPrice, category: g.category, example: q.example,
        }
        const unlock = g.kind === 'recipe' ? '이 메뉴' : `메뉴 ${g.menus.length}개(${g.menus.slice(0, 4).join(', ')}${g.menus.length > 4 ? ' 등' : ''})`
        return {
          run_id: runId,
          agent: 'cost',
          kind: 'question',
          severity: 'info',
          title: q.title,
          body: `이게 채워지면 ${unlock}의 원가를 계산할 수 있어요.`,
          evidence: [
            { label: g.kind === 'recipe' ? '판매가' : '관련 메뉴', value: g.kind === 'recipe' ? `${(g.menuPrice ?? 0).toLocaleString()}원` : `${g.menus.length}개` },
            { label: '최근 60일 매출', value: `${Math.round(g.sales60 / 10000).toLocaleString()}만원` },
          ],
          action: q.question,
          period: today,
          link: '/menu?view=cost',
          meta,
        }
      })
      .filter((r) => r != null)
    if (rows.length > 0) {
      const { error } = await supabase.from('ai_inbox').insert(rows)
      if (error) throw error
    }

    return {
      summary: `${status} · 질문 ${rows.length}개 올림`,
      output: { gaps: gaps.length, asked: rows.length, keys: rows.map((r) => r.meta.key) },
      period: today,
      usage,
      model,
    }
  })
}
