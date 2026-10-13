import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { getWeeklySummary } from '@/lib/supabase/queries/weekly'
import { getDiagnosisMonths } from '@/lib/supabase/queries/diagnosis'
import { getAllMenuCosts } from '@/lib/supabase/queries/recipe-costs'
import { kstDate } from '@/lib/attendance/tokens'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 경영 AI — 이번 주 추천 (매주 수요일 아침, 그날 밤 주간 보고서 쓸 때 참고)
// 지난주 숫자 분석(business.ts)과 달리 이번 주 데이터 업로드와 상관없음:
//   다가오는 2주 (계절·기념일) + 우리 카페의 긴 흐름 (월별·카테고리·원가율) + 카페 운영 상식 → 경험 없는 사람에게 도움될 추천 1~2개
// 업무함 항목은 agent 'business', meta.type 'tip' (처리 안 한 지난 추천은 새 추천으로 교체)

const TipSchema = z.object({
  title: z.string().describe('한 줄 추천 (예: 다음 주부터 따뜻한 시즌 음료 하나 먼저 내보기)'),
  why_now: z.string().describe('왜 지금인지 2~3문장. 다가오는 날짜·계절과 우리 카페 데이터 숫자로'),
  try: z.string().describe('작게 해 보는 방법 1~2문장 (돈·시간이 적게 드는 크기)'),
  check: z.string().describe('효과를 확인하는 방법 한 문장 (언제, 어떤 숫자를 보면 되는지)'),
  evidence: z.array(z.object({ label: z.string(), value: z.string() })).describe('근거 숫자 1~3개. 데이터에 있는 값만'),
})
const OutputSchema = z.object({
  headline: z.string().describe('이번 주 추천을 한 문장으로'),
  tips: z.array(TipSchema).describe('1~2개. 정말 도움될 것만'),
})

const SYSTEM = `당신은 카페 "썸바실"의 경영 담당 AI입니다. 매주 수요일, 점장과 대표에게 "이번 주 추천"을 1~2개 줍니다. 두 사람 모두 카페 운영 경험이 많지 않은 비전문가입니다.

추천은 세 가지를 함께 보고 고릅니다:
1) 다가오는 2주 — 계절 변화, 기념일·행사 (입력의 다가오는날 목록)
2) 우리 카페의 긴 흐름 — 월별 매출·카테고리 비중 변화, 메뉴 원가율, 최근 8주 추이
3) 카페 운영 상식 — 시즌 메뉴 교체 시기, 재고·발주, 단골 만들기, 가격·세트 구성, 인력 배치 같은 일반적인 요령

규칙:
- 우리 카페 숫자는 입력 데이터에 있는 것만 씁니다. 지어내지 않습니다. 금액은 "38만원"처럼.
- 날씨·업계 이야기는 일반 상식 수준으로만 씁니다 ("보통 11월부터 따뜻한 음료가 늘어요"). 구체적인 통계나 날짜를 단정하지 않습니다. 음력 명절처럼 날짜가 해마다 바뀌는 건 확실하지 않으면 쓰지 않습니다.
- 지난추천에 있는 것과 같은 내용은 다시 쓰지 않습니다.
- 크게 바꾸라는 말보다 이번 주에 작게 시험해 볼 수 있는 크기로 씁니다. 전문 용어는 쉬운 말로 풉니다.
- 억지로 2개를 채우지 않습니다. 확실히 도움될 것 1개면 1개만.`

// 해마다 날짜가 같은 기념일 (음력 명절은 빼고, 수능은 11월 셋째 목요일)
const FIXED_DAYS: [string, string][] = [
  ['01-01', '새해'], ['02-14', '밸런타인데이'], ['03-01', '삼일절'], ['03-14', '화이트데이'], ['05-05', '어린이날'],
  ['05-08', '어버이날'], ['05-15', '스승의 날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'],
  ['10-09', '한글날'], ['10-31', '핼러윈'], ['11-11', '빼빼로데이'], ['12-24', '크리스마스이브'], ['12-25', '크리스마스'], ['12-31', '연말'],
]

function upcomingDays(today: string, days = 14) {
  const out: { date: string; 이름: string }[] = []
  const start = new Date(`${today}T00:00:00Z`)
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const iso = d.toISOString().slice(0, 10)
    const md = iso.slice(5)
    for (const [day, name] of FIXED_DAYS) if (day === md) out.push({ date: iso, 이름: name })
    // 수능: 11월 셋째 목요일
    if (d.getUTCMonth() === 10 && d.getUTCDay() === 4 && Math.ceil(d.getUTCDate() / 7) === 3) out.push({ date: iso, 이름: '수능' })
  }
  return out
}

export async function runTipsAgent(trigger: RunTrigger, now = new Date()) {
  return recordRun('business', trigger, async (runId) => {
    const supabase = createServerClient()
    const today = kstDate(now)
    const since = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10)

    const [trend, months, costs, lines, { data: pastTips }] = await Promise.all([
      getWeeklySummary(8),
      getDiagnosisMonths(),
      getAllMenuCosts(),
      fetchAllRows<{ date: string; category: string; amount: number }>((from, to) =>
        supabase.from('daily_sales').select('date, category, amount').eq('source', 'pos').gte('date', since).range(from, to)
      ),
      supabase.from('ai_inbox').select('title, created_at').eq('agent', 'business').eq('meta->>type', 'tip').order('created_at', { ascending: false }).limit(12),
    ])

    // 월별 카테고리 매출 (계절 흐름)
    const byMonth = new Map<string, Record<string, number>>()
    for (const l of lines) {
      const m = l.date.slice(0, 7)
      const row = byMonth.get(m) ?? {}
      row[l.category] = (row[l.category] ?? 0) + (l.amount ?? 0)
      byMonth.set(m, row)
    }

    const ok = costs.filter((c) => c.status === 'ok')
    const data = {
      오늘: today,
      다가오는날: upcomingDays(today),
      월별카테고리매출: [...byMonth.entries()].sort().map(([month, cats]) => ({ month, ...cats })),
      최근월손익: months.slice(-4).map((m) => ({ 월: `${m.year}-${m.month}`, 매출: m.sales, 주문수: m.orderCount, 영업일: m.operatingDays, 재료비: m.variableCost, 인건비: m.labor, 고정비: m.fixed })),
      최근8주: trend.map((w) => ({ 주: w.label, 매출: w.income, 지출: w.expense })),
      메뉴원가율: {
        계산된메뉴: `${ok.length}/${costs.length}개`,
        높은순: [...ok].sort((a, b) => (b.costRatio ?? 0) - (a.costRatio ?? 0)).slice(0, 8).map((c) => ({ 메뉴: c.productName, 판매가: c.price, 원가율: `${Math.round((c.costRatio ?? 0) * 100)}%` })),
      },
      지난추천: (pastTips ?? []).map((t) => t.title),
    }

    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: `오늘(${today}) 기준입니다. 이번 주 추천을 골라 주세요.\n\n${JSON.stringify(data)}`,
      schema: OutputSchema,
      name: 'weekly_tips',
    })

    // 처리 안 한 지난 추천은 새 추천으로 교체
    await supabase.from('ai_inbox').delete().eq('agent', 'business').eq('status', 'new').eq('meta->>type', 'tip')
    const tips = output.tips.slice(0, 2)
    if (tips.length > 0) {
      const { error } = await supabase.from('ai_inbox').insert(
        tips.map((t) => ({
          run_id: runId,
          agent: 'business',
          kind: 'insight',
          severity: 'info',
          title: t.title,
          body: t.why_now,
          evidence: t.evidence,
          action: `${t.try}\n확인: ${t.check}`,
          period: `tip:${today}`,
          meta: { type: 'tip' },
        }))
      )
      if (error) throw error
    }

    return { summary: `이번 주 추천 · ${output.headline}`, output, period: `tip:${today}`, usage, model }
  })
}
