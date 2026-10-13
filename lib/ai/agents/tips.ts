import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { getWeeklySummary } from '@/lib/supabase/queries/weekly'
import { getDiagnosisMonths } from '@/lib/supabase/queries/diagnosis'
import { getAllMenuCosts } from '@/lib/supabase/queries/recipe-costs'
import { kstDate } from '@/lib/attendance/tokens'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 경영 AI의 기획 — 지난주 숫자 분석(business.ts, 업로드 직후)과 달리 앞으로 할 일을 제안
//   runTipsAgent : 매주 수요일 아침 "이번 주 추천" 1~2개 (그날 밤 주간 보고서 참고)
//   runPlanAgent : 점장이 주제를 적어 요청한 기획안 1개 (예: 크리스마스 시즌 메뉴)
// 보는 것: 다가오는 2주 계절·기념일 + 우리 카페 긴 흐름(월별 카테고리·시간대·메뉴·원가율) + 카페 운영 상식
// 업무함 항목은 agent 'business', meta.type 'tip' | 'plan'

const Evidence = z.array(z.object({ label: z.string(), value: z.string() })).describe('근거 숫자 1~3개. 데이터에 있는 값만')

const TipSchema = z.object({
  title: z.string().describe('한 줄 추천 (예: 다음 주부터 따뜻한 시즌 음료 하나 먼저 내보기)'),
  why_now: z.string().describe('왜 지금인지 2~3문장. 다가오는 날짜·계절과 우리 카페 데이터 숫자로'),
  try: z.string().describe('작게 해 보는 방법 1~2문장 (돈·시간이 적게 드는 크기)'),
  check: z.string().describe('효과를 확인하는 방법 한 문장 (언제, 어떤 숫자를 보면 되는지)'),
  evidence: Evidence,
})
const TipsOutput = z.object({
  headline: z.string().describe('이번 주 추천을 한 문장으로'),
  tips: z.array(TipSchema).describe('1~2개. 정말 도움될 것만'),
})

const PlanOutput = z.object({
  title: z.string().describe('기획안 제목 한 줄'),
  goal: z.string().describe('목표 한 문장 (가능하면 숫자로, 예: 평일 3~5시 매출을 4주 안에 10% 올리기)'),
  why: z.string().describe('왜 이렇게 제안하는지 2~4문장. 우리 카페 데이터 숫자와 계절·상식을 근거로'),
  steps: z.array(z.string()).describe('해 볼 것 2~4단계. 이번 주에 시작할 수 있는 작은 단위부터'),
  prep: z.string().describe('필요한 준비물·비용·사람 (대략)'),
  check: z.string().describe('잘 됐는지 확인하는 방법 (언제, 어떤 숫자를)'),
  evidence: Evidence,
})

const BASE = `당신은 카페 "썸바실"의 경영 담당 AI입니다. 점장과 대표 모두 카페 운영 경험이 많지 않은 비전문가입니다.

판단할 때 세 가지를 함께 봅니다:
1) 다가오는 2주 — 계절 변화, 기념일·행사 (입력의 다가오는날 목록)
2) 우리 카페의 긴 흐름 — 월별 매출·카테고리 비중, 시간대별 매출, 메뉴별 판매량, 메뉴 원가율, 최근 8주 추이
3) 카페 운영 상식 — 시즌 메뉴 교체 시기, 재고·발주, 단골 만들기, 가격·세트 구성, 인력 배치 같은 일반적인 요령

규칙:
- 우리 카페 숫자는 입력 데이터에 있는 것만 씁니다. 지어내지 않습니다. 금액은 "38만원"처럼.
- 날씨·업계 이야기는 일반 상식 수준으로만 씁니다 ("보통 11월부터 따뜻한 음료가 늘어요"). 구체적인 통계나 날짜를 단정하지 않습니다. 음력 명절처럼 날짜가 해마다 바뀌는 건 확실하지 않으면 쓰지 않습니다.
- 크게 바꾸라는 말보다 이번 주에 작게 시험해 볼 수 있는 크기로 씁니다. 전문 용어는 쉬운 말로 풉니다.
- 데이터로 알 수 없는 것은 모른다고 쓰고, 점장이 직접 확인할 방법을 알려 줍니다.`

const TIPS_SYSTEM = `${BASE}

지금 할 일: 매주 수요일 "이번 주 추천"을 1~2개 줍니다. 지난추천에 있는 것과 같은 내용은 다시 쓰지 않습니다. 억지로 2개를 채우지 않습니다.`

const PLAN_SYSTEM = `${BASE}

지금 할 일: 점장이 적은 주제로 기획안 1개를 씁니다. 주제가 막연하면 우리 데이터에서 가장 효과가 클 방향으로 좁혀서 씁니다. 회의에서 바로 보여 줄 수 있게 짧고 구체적으로 씁니다.`

// 해마다 날짜가 같은 기념일 (음력 명절은 빼고, 수능은 11월 셋째 목요일)
const FIXED_DAYS: [string, string][] = [
  ['01-01', '새해'], ['02-14', '밸런타인데이'], ['03-01', '삼일절'], ['03-14', '화이트데이'], ['05-05', '어린이날'],
  ['05-08', '어버이날'], ['05-15', '스승의 날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'],
  ['10-09', '한글날'], ['10-31', '핼러윈'], ['11-11', '빼빼로데이'], ['12-24', '크리스마스이브'], ['12-25', '크리스마스'], ['12-31', '연말'],
]

function upcomingDays(today: string, days: number) {
  const out: { date: string; 이름: string }[] = []
  const start = new Date(`${today}T00:00:00Z`)
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const iso = d.toISOString().slice(0, 10)
    const md = iso.slice(5)
    for (const [day, name] of FIXED_DAYS) if (day === md) out.push({ date: iso, 이름: name })
    if (d.getUTCMonth() === 10 && d.getUTCDay() === 4 && Math.ceil(d.getUTCDate() / 7) === 3) out.push({ date: iso, 이름: '수능' })
  }
  return out
}

// 추천·기획 공통 데이터
async function planningData(now: Date, upcoming: number) {
  const supabase = createServerClient()
  const today = kstDate(now)
  const yearAgo = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10)
  const weeks8 = new Date(now.getTime() - 56 * 86400000).toISOString().slice(0, 10)

  const [trend, months, costs, lines] = await Promise.all([
    getWeeklySummary(8),
    getDiagnosisMonths(),
    getAllMenuCosts(),
    fetchAllRows<{ date: string; category: string; amount: number; quantity: number; product_name: string; order_time: string | null }>((from, to) =>
      supabase.from('daily_sales').select('date, category, amount, quantity, product_name, order_time').eq('source', 'pos').gte('date', yearAgo).range(from, to)
    ),
  ])

  // 월별 카테고리 매출 (계절 흐름)
  const byMonth = new Map<string, Record<string, number>>()
  // 최근 8주: 시간대별(평일/주말) 하루 평균 매출 · 메뉴별 판매
  const hourly = { 평일: new Map<number, number>(), 주말: new Map<number, number>() }
  const days = { 평일: new Set<string>(), 주말: new Set<string>() }
  const menus = new Map<string, { 수량: number; 매출: number }>()
  for (const l of lines) {
    const m = l.date.slice(0, 7)
    const row = byMonth.get(m) ?? {}
    row[l.category] = (row[l.category] ?? 0) + (l.amount ?? 0)
    byMonth.set(m, row)
    if (l.date < weeks8) continue
    const dow = new Date(`${l.date}T00:00:00Z`).getUTCDay()
    const kind = dow === 0 || dow === 6 ? '주말' : '평일'
    days[kind].add(l.date)
    if (l.order_time) {
      const h = new Date(new Date(l.order_time).getTime() + 9 * 3600000).getUTCHours()
      hourly[kind].set(h, (hourly[kind].get(h) ?? 0) + (l.amount ?? 0))
    }
    const mm = menus.get(l.product_name) ?? { 수량: 0, 매출: 0 }
    mm.수량 += l.quantity ?? 0
    mm.매출 += l.amount ?? 0
    menus.set(l.product_name, mm)
  }
  const hourAvg = (kind: '평일' | '주말') =>
    [...hourly[kind].entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ 시: h, 하루평균매출: Math.round(v / Math.max(1, days[kind].size)) }))
  const menuList = [...menus.entries()].map(([메뉴, v]) => ({ 메뉴, ...v })).sort((a, b) => b.매출 - a.매출)

  const ok = costs.filter((c) => c.status === 'ok')
  return {
    today,
    data: {
      오늘: today,
      다가오는날: upcomingDays(today, upcoming),
      월별카테고리매출: [...byMonth.entries()].sort().map(([month, cats]) => ({ month, ...cats })),
      최근월손익: months.slice(-4).map((m) => ({ 월: `${m.year}-${m.month}`, 매출: m.sales, 주문수: m.orderCount, 영업일: m.operatingDays, 재료비: m.variableCost, 인건비: m.labor, 고정비: m.fixed })),
      최근8주: trend.map((w) => ({ 주: w.label, 매출: w.income, 지출: w.expense })),
      최근8주시간대: { 평일: hourAvg('평일'), 주말: hourAvg('주말') },
      최근8주메뉴: { 많이팔린순: menuList.slice(0, 15), 적게팔린순: menuList.slice(-10).reverse() },
      메뉴원가율: {
        계산된메뉴: `${ok.length}/${costs.length}개`,
        높은순: [...ok].sort((a, b) => (b.costRatio ?? 0) - (a.costRatio ?? 0)).slice(0, 8).map((c) => ({ 메뉴: c.productName, 판매가: c.price, 원가율: `${Math.round((c.costRatio ?? 0) * 100)}%` })),
      },
    },
  }
}

// 수요일 아침 — 이번 주 추천
export async function runTipsAgent(trigger: RunTrigger, now = new Date()) {
  return recordRun('business', trigger, async (runId) => {
    const supabase = createServerClient()
    const [{ today, data }, { data: pastTips }] = await Promise.all([
      planningData(now, 14),
      supabase.from('ai_inbox').select('title').eq('agent', 'business').eq('meta->>type', 'tip').order('created_at', { ascending: false }).limit(12),
    ])

    const { output, model, usage } = await generateStructured({
      system: TIPS_SYSTEM,
      user: `오늘(${today}) 기준입니다. 이번 주 추천을 골라 주세요.\n\n${JSON.stringify({ ...data, 지난추천: (pastTips ?? []).map((t) => t.title) })}`,
      schema: TipsOutput,
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

// 점장 요청 — 주제를 받아 기획안 1개 (지난 기획안은 지우지 않음)
export async function runPlanAgent(topic: string, now = new Date()) {
  return recordRun('business', 'manual', async (runId) => {
    const { today, data } = await planningData(now, 45)
    const { output, model, usage } = await generateStructured({
      system: PLAN_SYSTEM,
      user: `오늘(${today}) 기준입니다. 점장 요청 주제: "${topic}"\n\n${JSON.stringify(data)}`,
      schema: PlanOutput,
      name: 'plan_request',
    })

    const supabase = createServerClient()
    const { error } = await supabase.from('ai_inbox').insert({
      run_id: runId,
      agent: 'business',
      kind: 'insight',
      severity: 'info',
      title: output.title,
      body: `${output.goal}\n${output.why}`,
      evidence: output.evidence,
      action: [...output.steps.map((s, i) => `${i + 1}. ${s}`), `준비: ${output.prep}`, `확인: ${output.check}`].join('\n'),
      period: `plan:${today}`,
      meta: { type: 'plan', topic },
    })
    if (error) throw error

    return { summary: `기획 요청 · ${topic}`, output, period: `plan:${today}`, usage, model }
  })
}
