import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { kstDate } from '@/lib/attendance/tokens'
import { getShiftsBetween } from '@/lib/supabase/queries/attendance-admin'
import { guideAsText, guideForPath } from '@/lib/guide'
import { recordRun, runToolChat, type AiTool } from '../client'

// 비서 AI — 점장의 자연어 질문에 데이터를 직접 조회해서 답함 (조회 전용 도구만)
//   사이트 사용법("시급 어디서 바꿔?")은 site_guide 도구 = lib/guide.ts (가이드 화면과 같은 내용)
//   오른쪽 아래 버튼으로 물으면 지금 보고 있는 화면 주소(page)를 같이 받아서 "이 화면"을 알아들음
// 직원 이름은 AI에 보내지 않음: 질문·도구 결과의 이름을 [직원N]으로 바꿔 보내고, 답에서 다시 이름으로 되돌림

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD (한국 날짜)')

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피', drip_coffee: '드립커피', dutch_coffee: '더치커피', matcha: '말차', beverage: '음료',
  ade: '에이드', tea: '차', dessert: '디저트', season: '시즌', etc: '기타',
}
const EXPENSE_LABEL: Record<string, string> = {
  ingredients_cash: '재료비(현금)', ingredients_card: '재료비(카드)', labor: '인건비', fixed: '고정비', equipment: '설비투자',
}
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

const nextDay = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}
const weekdayOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()

type SaleRow = { date: string; order_id: string | null; product_name: string | null; category: string; quantity: number; amount: number; order_time: string | null }

async function salesRows(start: string, end: string) {
  const supabase = createServerClient()
  return fetchAllRows<SaleRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, order_id, product_name, category, quantity, amount, order_time')
      .eq('source', 'pos')
      .gte('date', start)
      .lte('date', end)
      .range(from, to)
  )
}

// 직원 이름 ↔ [직원N]
class NameMask {
  private toToken = new Map<string, string>()
  private toName = new Map<string, string>()
  constructor(names: string[]) {
    // 긴 이름부터 (부분 겹침 방지)
    for (const n of [...new Set(names)].sort((a, b) => b.length - a.length)) this.token(n)
  }
  token(name: string) {
    let t = this.toToken.get(name)
    if (!t) {
      t = `[직원${this.toToken.size + 1}]`
      this.toToken.set(name, t)
      this.toName.set(t, name)
    }
    return t
  }
  mask(text: string) {
    let out = text
    for (const [name, t] of this.toToken) if (name) out = out.split(name).join(t)
    return out
  }
  unmask(text: string) {
    return text.replace(/\[직원\d+\]/g, (t) => this.toName.get(t) ?? t)
  }
}

function buildTools(mask: NameMask): AiTool[] {
  return [
    {
      name: 'site_guide',
      description: '이 관리 사이트의 화면별 안내 (어느 화면에 무엇이 있는지, 설정·버튼이 어디 있는지, 자주 하는 일 하는 법). "어디서 ~해?", "~하려면 어떻게 해?", "이 화면 뭐야?" 같은 사용법 질문에 사용',
      schema: z.object({}),
      run: async () => guideAsText(),
    },
    {
      name: 'data_coverage',
      description: '각 데이터가 언제부터 언제까지 들어와 있는지 확인. 기간이 데이터 밖이면 답하기 전에 먼저 확인',
      schema: z.object({}),
      run: async () => {
        const supabase = createServerClient()
        const sales = (asc: boolean) =>
          supabase.from('daily_sales').select('date').eq('source', 'pos').order('date', { ascending: asc }).limit(1).maybeSingle()
        const exp = (asc: boolean) =>
          supabase.from('monthly_expenses').select('date').not('date', 'is', null).order('date', { ascending: asc }).limit(1).maybeSingle()
        const [sMin, sMax, eMin, eMax] = await Promise.all([sales(true), sales(false), exp(true), exp(false)])
        const v = (r: { data: { date: string } | null }) => r.data?.date ?? null
        return {
          POS매출: { 처음: v(sMin), 마지막: v(sMax) },
          통장지출: { 처음: v(eMin), 마지막: v(eMax) },
          참고: '근무시간은 종이 근무일지 업로드 + QR 출퇴근 기록',
        }
      },
    },
    {
      name: 'sales_summary',
      description: 'POS 매출 합계·주문 수. group_by로 날짜별·요일별(하루 평균 포함)·월별·카테고리별·시간대별로 나눔',
      schema: z.object({
        start: DATE,
        end: DATE.describe('YYYY-MM-DD, 이 날 포함'),
        group_by: z.enum(['total', 'day', 'weekday', 'month', 'category', 'hour']),
      }),
      run: async (input) => {
        const { start, end, group_by } = input as { start: string; end: string; group_by: string }
        const rows = await salesRows(start, end)
        if (rows.length === 0) return { 기간: `${start}~${end}`, 결과: '이 기간 POS 매출 기록이 없음' }
        const key = (r: SaleRow): string => {
          switch (group_by) {
            case 'day': return r.date
            case 'weekday': return WEEKDAY[weekdayOf(r.date)]
            case 'month': return r.date.slice(0, 7)
            case 'category': return CATEGORY_LABEL[r.category] ?? r.category
            case 'hour': {
              if (!r.order_time) return '시간 정보 없음'
              const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(new Date(r.order_time)))
              return `${String(h).padStart(2, '0')}시`
            }
            default: return '전체'
          }
        }
        const groups = new Map<string, { 매출: number; orders: Set<string>; days: Set<string> }>()
        for (const r of rows) {
          const g = groups.get(key(r)) ?? { 매출: 0, orders: new Set(), days: new Set() }
          g.매출 += r.amount
          if (r.order_id) g.orders.add(`${r.date}|${r.order_id}`)
          g.days.add(r.date)
          groups.set(key(r), g)
        }
        return {
          기간: `${start}~${end}`,
          출처: 'POS 업로드',
          결과: [...groups.entries()].sort().map(([k, g]) => ({
            구분: k,
            매출: g.매출,
            주문수: g.orders.size,
            영업일수: g.days.size,
            ...(group_by === 'weekday' ? { 하루평균매출: Math.round(g.매출 / g.days.size) } : {}),
          })),
        }
      },
    },
    {
      name: 'menu_sales',
      description: '메뉴별 판매 수량·매출 (많이 팔린 순). search로 메뉴 이름 일부 검색 (예: "마들렌")',
      schema: z.object({
        start: DATE,
        end: DATE.describe('YYYY-MM-DD, 이 날 포함'),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      run: async (input) => {
        const { start, end, search, limit } = input as { start: string; end: string; search?: string; limit?: number }
        const rows = (await salesRows(start, end)).filter((r) => !search || (r.product_name ?? '').includes(search))
        const byMenu = new Map<string, { 카테고리: string; 수량: number; 매출: number }>()
        for (const r of rows) {
          const name = r.product_name ?? '(이름 없음)'
          const m = byMenu.get(name) ?? { 카테고리: CATEGORY_LABEL[r.category] ?? r.category, 수량: 0, 매출: 0 }
          m.수량 += r.quantity
          m.매출 += r.amount
          byMenu.set(name, m)
        }
        return {
          기간: `${start}~${end}`,
          출처: 'POS 업로드',
          메뉴: [...byMenu.entries()].map(([메뉴, v]) => ({ 메뉴, ...v })).sort((a, b) => b.수량 - a.수량).slice(0, limit ?? 15),
        }
      },
    },
    {
      name: 'expenses',
      description: '통장 거래로 분류된 지출 합계 ("제외" 항목 빼고). group_by: 카테고리별·월별·거래 상대별',
      schema: z.object({
        start: DATE,
        end: DATE.describe('YYYY-MM-DD, 이 날 포함'),
        group_by: z.enum(['category', 'month', 'counterpart']),
        category: z.enum(['ingredients_cash', 'ingredients_card', 'labor', 'fixed', 'equipment']).optional(),
      }),
      run: async (input) => {
        const { start, end, group_by, category } = input as { start: string; end: string; group_by: string; category?: string }
        const supabase = createServerClient()
        const rows = await fetchAllRows<{ date: string; category: string; amount: number; counterpart: string | null; item: string }>((from, to) => {
          let q = supabase.from('monthly_expenses').select('date, category, amount, counterpart, item').gte('date', start).lte('date', end).neq('category', 'excluded')
          if (category) q = q.eq('category', category)
          return q.range(from, to)
        })
        const key = (r: (typeof rows)[number]) =>
          group_by === 'category' ? EXPENSE_LABEL[r.category] ?? r.category
            : group_by === 'month' ? r.date.slice(0, 7)
              : r.category === 'labor' ? '직원 급여' : (r.counterpart || r.item || '').trim()
        const groups = new Map<string, { 금액: number; 건수: number }>()
        for (const r of rows) {
          const g = groups.get(key(r)) ?? { 금액: 0, 건수: 0 }
          g.금액 += r.amount
          g.건수++
          groups.set(key(r), g)
        }
        return {
          기간: `${start}~${end}`,
          출처: '통장 거래 업로드 (분류 기준)',
          결과: [...groups.entries()].map(([구분, v]) => ({ 구분, ...v })).sort((a, b) => b.금액 - a.금액).slice(0, 30),
        }
      },
    },
    {
      name: 'monthly_profit',
      description: '월별 수입·지출·이익 (결산 기준)',
      schema: z.object({
        from_month: z.string().regex(/^\d{4}-\d{2}$/).describe('YYYY-MM'),
        to_month: z.string().regex(/^\d{4}-\d{2}$/).describe('YYYY-MM'),
      }),
      run: async (input) => {
        const { from_month, to_month } = input as { from_month: string; to_month: string }
        const supabase = createServerClient()
        const { data } = await supabase.from('monthly_summary').select('year, month, income, total_expense, profit').order('year').order('month')
        return {
          출처: '월별 결산 (손익 화면과 같은 값)',
          결과: (data ?? [])
            .map((r) => ({ 월: `${r.year}-${String(r.month).padStart(2, '0')}`, 수입: r.income, 지출: r.total_expense, 이익: r.profit }))
            .filter((r) => r.월 >= from_month && r.월 <= to_month),
        }
      },
    },
    {
      name: 'staff_hours',
      description: '알바생별 근무일수·근무시간·지급액(근무시간×시급, 주휴수당 제외). 직원은 [직원N]으로 표시됨',
      schema: z.object({ start: DATE, end: DATE.describe('YYYY-MM-DD, 이 날 포함') }),
      run: async (input) => {
        const { start, end } = input as { start: string; end: string }
        const shifts = await getShiftsBetween(start, nextDay(end))
        const byStaff = new Map<string, { days: Set<string>; minutes: number; pay: number }>()
        for (const s of shifts) {
          const g = byStaff.get(s.name) ?? { days: new Set(), minutes: 0, pay: 0 }
          g.days.add(s.work_date)
          g.minutes += s.minutes
          g.pay += s.rate ? (s.minutes / 60) * s.rate : 0
          byStaff.set(s.name, g)
        }
        return {
          기간: `${start}~${end}`,
          출처: '종이 근무일지 업로드 + QR 출퇴근 (QR 기록 시작일 기준)',
          결과: [...byStaff.entries()].map(([name, g]) => ({
            직원: mask.token(name),
            근무일수: g.days.size,
            근무시간: Math.round((g.minutes / 60) * 10) / 10,
            지급액: Math.round(g.pay),
          })),
        }
      },
    },
  ]
}

function systemPrompt(today: string, page?: string) {
  const here = page ? guideForPath(page) : null
  return `당신은 카페 "썸바실"의 비서 AI입니다. 점장의 질문에 도구로 데이터를 조회해서 답합니다.

오늘: ${today} (${WEEKDAY[weekdayOf(today)]}요일, 한국 날짜)
- "이번 주"·"지난주"는 월요일~일요일, "이번 달"은 1일~오늘입니다.

답하는 법:
- 숫자는 반드시 도구로 조회한 값만 씁니다. 추측하지 않습니다. 필요하면 도구를 여러 번 부릅니다.
- 2~5문장으로 짧게, 쉬운 말로 답합니다. 금액은 "38만원", "1,234,000원"처럼 읽기 쉽게 씁니다.
- 마크다운(**굵게**, #제목, 표)은 쓰지 않습니다. 화면에 그대로 보입니다. 여러 항목은 줄바꿈과 "·"로 나열합니다.
- 매출 기록이 없는 날·요일은 휴무일 수도 있습니다. 업로드 누락이라고 단정하지 말고 "휴무였거나 기록이 없음"처럼 씁니다.
- 마지막 줄에 "기준: 기간 · 출처"를 적습니다 (예: 기준: 10/1~10/13 · POS 업로드).
- 데이터가 없거나 기간이 업로드 범위 밖이면 그렇다고 말하고, 무엇을 업로드하면 되는지 알려 줍니다.
- 직원은 [직원N] 형태로만 보입니다. 답에도 그대로 [직원N]으로 씁니다.
- 데이터를 바꾸는 일(입력·수정·삭제)은 할 수 없습니다. 요청받으면 어느 화면에서 하면 되는지 안내합니다.
- 카페 운영 질문이 아니면 정중히 범위를 안내합니다.

사이트 사용법 질문:
- "어디서 ~해?", "~하려면?", "이 화면 뭐야?"는 site_guide 도구로 확인한 내용만 답합니다. 기억으로 추측하지 않습니다.
- 메뉴 경로를 "운영 > 직원 > 직원·설정 탭"처럼 쓰고, 마지막에 바로 가는 주소를 한 줄로 붙입니다 (예: 바로 가기: /staff?view=settings · 가이드: /guide#staff). 주소는 site_guide에 나온 것만 씁니다.
- 사용법 답에는 "기준:" 줄을 쓰지 않습니다.${here ? `

점장이 지금 보고 있는 화면: ${here.title} (${page}). "이 화면", "여기", "이 숫자"는 이 화면을 말합니다.` : ''}`
}

export async function askAssistant(question: string, history: { q: string; a: string }[] = [], page?: string) {
  const supabase = createServerClient()
  const { data: staff } = await supabase.from('staff').select('name')
  const mask = new NameMask((staff ?? []).map((s) => s.name as string))

  return recordRun('assistant', 'manual', async () => {
    const turns = [
      ...history.slice(-3).flatMap((h) => [
        { role: 'user' as const, content: mask.mask(h.q) },
        { role: 'assistant' as const, content: mask.mask(h.a) },
      ]),
      { role: 'user' as const, content: mask.mask(question) },
    ]
    const { text, toolsUsed, model, usage } = await runToolChat({
      system: systemPrompt(kstDate(new Date()), page),
      turns,
      tools: buildTools(mask),
    })
    const answer = mask.unmask(text.trim()) || '답을 만들지 못했어요. 질문을 조금 바꿔서 다시 물어봐 주세요.'
    return {
      summary: question.slice(0, 80),
      output: { question, answer, toolsUsed },
      usage,
      model,
    }
  })
}
