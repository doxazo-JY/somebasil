import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions, getWeekDetail, getWeeklySummary, type WeekDetail } from '@/lib/supabase/queries/weekly'
import { getDiagnosisMonths } from '@/lib/supabase/queries/diagnosis'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 경영 AI — 매주 수요일 아침, 지난주(월~일)를 분석해 "이번 주 꼭 볼 것 3가지"를 업무함에 올림
// 읽는 데이터: 지난주 상세 · 그 전주 상세 · 최근 8주 추이 · 최근 3개월 비용 구조
// 결과의 marketing_topic은 마케팅 AI가 이어받을 주제 (ai_runs.output에 보관)

const ItemSchema = z.object({
  title: z.string().describe('한 줄 제목. 무엇을 발견했는지 (예: 화요일 매출이 3주 연속 낮음)'),
  why: z.string().describe('왜 중요한지 2~3문장. 반드시 아래 데이터의 실제 숫자로 설명'),
  evidence: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe('근거 숫자 2~4개. 데이터에 있는 값만 (예: {label: "지난주 화요일 매출", value: "38만원"})'),
  action: z.string().describe('이번 주에 점장이 실제로 할 수 있는 구체적인 행동 1~2문장'),
  severity: z.enum(['info', 'warn']).describe('warn = 손실이 생기고 있거나 바로 확인이 필요한 것'),
})

const OutputSchema = z.object({
  headline: z.string().describe('지난주를 한 문장으로 (업무함 상단·실행 기록에 표시)'),
  items: z.array(ItemSchema).describe('정확히 3개. 중요한 순서대로'),
  marketing_topic: z
    .string()
    .describe('이번 주 인스타 게시글로 다루면 좋을 주제 한 줄 (마케팅 AI가 이어받음). 없으면 빈 문자열'),
})

export type BusinessOutput = z.infer<typeof OutputSchema>

const SYSTEM = `당신은 카페 "썸바실"의 경영 담당 AI입니다. 매주 수요일 아침, 지난주 숫자를 보고 점장에게 "이번 주 꼭 볼 것 3가지"를 전달합니다.

점장과 대표 모두 카페 경영 경험이 많지 않습니다. 그래서:
- 전문 용어 없이 쉬운 말로 씁니다. 꼭 필요한 개념(객단가, 원가율 등)은 한 번 짧게 풀어 줍니다.
- 결론만 말하지 않고, 어떤 숫자를 보고 그렇게 판단했는지 함께 씁니다. 점장이 알림을 읽으며 운영 감각을 익히는 것이 목표입니다.
- 할 일은 이번 주 안에 실제로 할 수 있는 크기로 씁니다. "마케팅 강화" 같은 막연한 말은 쓰지 않습니다.

숫자 규칙:
- 아래 JSON 데이터에 있는 숫자만 씁니다. 추측하거나 지어내지 않습니다.
- 금액은 원 단위 데이터를 "38만원", "1,234,000원"처럼 읽기 쉽게 씁니다.
- 데이터가 비어 있거나 업로드가 안 된 것으로 보이면(예: 지출 0원, hasExpenseData=false), 그것 자체를 항목으로 짚을 수 있습니다.
- 날짜·요일은 한국 기준입니다. weekday는 0=일요일 ~ 6=토요일입니다.

고르는 기준: 매출·이익에 영향이 큰 것, 추세가 바뀐 것(연속 하락·급증), 점장이 행동으로 바꿀 수 있는 것을 우선합니다. 세 항목은 서로 다른 내용이어야 합니다.`

// 프롬프트용으로 주간 상세를 줄임
function compactWeek(w: WeekDetail) {
  return {
    기간: `${w.weekStart} ~ ${w.weekEnd}`,
    매출: w.income,
    지출: w.expense,
    이익: w.profit,
    지출데이터있음: w.hasExpenseData,
    주문수: w.orderCount,
    객단가: Math.round(w.aov),
    요일별: w.daily.map((d) => ({ date: d.date, weekday: d.weekday, 매출: d.income, 주문수: d.orderCount })),
    카테고리비중: w.categoryMix.map((c) => ({ category: c.category, 매출: c.amount, 비중: Math.round(c.pct * 10) / 10 })),
    상위메뉴: w.topProducts.slice(0, 10).map((p) => ({ 메뉴: p.product_name, 수량: p.quantity, 매출: p.amount })),
    지출카테고리: w.expenseByCategory,
  }
}

export async function runBusinessAgent(trigger: RunTrigger) {
  return recordRun('business', trigger, async (runId) => {
    // 지난주 = 이번 주 바로 전 월~일
    const weeks = getRecentWeekOptions(3)
    const last = weeks[1]
    const prev = weeks[2]
    const [lastDetail, prevDetail, trend, months] = await Promise.all([
      getWeekDetail(last.weekStart, last.weekEnd),
      getWeekDetail(prev.weekStart, prev.weekEnd),
      getWeeklySummary(8),
      getDiagnosisMonths(),
    ])

    const data = {
      분석대상주: compactWeek(lastDetail),
      그전주: compactWeek(prevDetail),
      최근8주추이: trend.map((w) => ({ 주: w.label, 시작: w.weekStart, 매출: w.income, 지출: w.expense, 이익: w.profit, 지출데이터있음: w.hasExpenseData })),
      최근월비용구조: months.slice(-3),
    }

    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: `지난주(${last.label}, ${last.weekStart} ~ ${last.weekEnd}) 데이터입니다. 이번 주 꼭 볼 것 3가지를 정리해 주세요.\n\n${JSON.stringify(data)}`,
      schema: OutputSchema,
      name: 'weekly_business_report',
    })

    // 같은 주에 다시 돌리면 아직 처리 안 한 이전 항목은 새 결과로 교체
    const supabase = createServerClient()
    await supabase.from('ai_inbox').delete().eq('agent', 'business').eq('period', last.weekStart).eq('status', 'new')
    const { error } = await supabase.from('ai_inbox').insert(
      output.items.slice(0, 3).map((item) => ({
        run_id: runId,
        agent: 'business',
        kind: 'insight',
        severity: item.severity,
        title: item.title,
        body: item.why,
        evidence: item.evidence,
        action: item.action,
        period: last.weekStart,
      }))
    )
    if (error) throw error

    return {
      summary: output.headline,
      output,
      period: last.weekStart,
      usage,
      model,
    }
  })
}
