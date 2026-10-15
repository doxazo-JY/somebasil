import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { kstDate } from '@/lib/attendance/tokens'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 자금 관리 AI (내부 키 cashflow) — 통장 업로드 직후(주 1번, after-upload.ts) 또는 [지금 점검]. 통장 거래(입금·출금)로 앞으로 30일 동안 잔고가 부족해질 위험을 미리 알림
// AI에 원본 거래를 다 보내지 않고 요약해서 보냄: 현재 잔고 · 최근 90일 일별 입출금 · 반복 지출(매달 나가는 돈) · 큰 지출
// 위험이 없으면 업무함에 아무것도 올리지 않음

type Tx = { date: string; tx_time: string | null; amount: number; balance_after: number | null; who: string }

const AlertSchema = z.object({
  title: z.string().describe('한 줄 제목 (예: 다음 주 월세와 재료 대금이 겹쳐요)'),
  why: z.string().describe('왜 위험한지 2~3문장. 아래 데이터의 실제 숫자로'),
  evidence: z.array(z.object({ label: z.string(), value: z.string() })).describe('근거 숫자 2~4개'),
  action: z.string().describe('점장이 할 수 있는 구체적인 행동 (예: 큰 재료 주문을 둘째 주로 미루기)'),
  severity: z.enum(['info', 'warn']),
})

const OutputSchema = z.object({
  summary: z.string().describe('앞으로 30일 현금 흐름을 한 문장으로'),
  alerts: z.array(AlertSchema).describe('실제 위험이 있을 때만 0~2개. 문제가 없으면 빈 배열'),
})

const SYSTEM = `당신은 카페 "썸바실"의 자금 관리 담당 AI입니다. 통장 거래 데이터를 보고, 앞으로 30일 안에 통장 잔고가 부족해지거나 큰 지출이 몰리는 위험을 점장에게 미리 알립니다.

점장과 대표 모두 경영 경험이 많지 않습니다. 쉬운 말로, 근거 숫자와 함께, 이번 주에 할 수 있는 행동으로 씁니다.

규칙:
- 아래 데이터의 숫자만 씁니다. 지어내지 않습니다. 금액은 "38만원"처럼 읽기 쉽게 씁니다.
- "반복지출"은 여러 달에 걸쳐 같은 상대에게 나간 돈입니다. 다음 달에도 비슷한 날짜에 나갈 가능성이 높습니다.
- 위험이 없으면 alerts를 빈 배열로 둡니다. 억지로 만들지 않습니다.
- 데이터가 오래됐으면(마지막 거래일이 2주 이상 전) 통장 거래 업로드가 필요하다는 것을 알림으로 올립니다.
- 오늘 날짜를 기준으로 판단합니다.
- 잔고는 올라온 통장 파일의 마지막 거래 잔액이라, 그 뒤 거래는 반영되지 않습니다. 잔고를 쓸 때는 항상 기준을 붙입니다 (예: "10/13 오전 11시 통장 기준 잔고 78만원"). "현재 잔고"라고만 쓰지 않습니다.
- 기준후지난날이 3일 이상이면 "그 뒤 거래가 반영되지 않았을 수 있어요"를 함께 쓰고, 통장 파일을 새로 올리면 정확해진다고 안내합니다.`

// 거래 시각(UTC ISO) → "10/13 오전 11시" + 오늘까지 지난 날 (한국 시간)
function balanceBasis(txTime: string, now: Date) {
  const kst = new Date(new Date(txTime).getTime() + 9 * 3600000)
  const h = kst.getUTCHours()
  const label = `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시 통장 기준`
  const days = Math.floor((new Date(kstDate(now)).getTime() - new Date(kst.toISOString().slice(0, 10)).getTime()) / 86400000)
  return { label, days }
}

export async function runCashflowAgent(trigger: RunTrigger, now = new Date()) {
  return recordRun('cashflow', trigger, async (runId) => {
    const supabase = createServerClient()
    const today = kstDate(now)
    const since = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)

    const [expenses, income] = await Promise.all([
      fetchAllRows<{ date: string | null; tx_time: string | null; amount: number; balance_after: number | null; counterpart: string | null; item: string; category: string }>(
        (from, to) =>
          supabase
            .from('monthly_expenses')
            .select('date, tx_time, amount, balance_after, counterpart, item, category')
            .gte('date', since)
            .neq('category', 'excluded')
            .range(from, to)
      ),
      fetchAllRows<{ date: string; tx_time: string | null; amount: number; balance_after: number | null; counterpart: string | null; memo: string | null }>(
        (from, to) =>
          supabase.from('bank_income').select('date, tx_time, amount, balance_after, counterpart, memo').gte('date', since).range(from, to)
      ),
    ])

    // 인건비는 직원 이름을 AI에 보내지 않도록 "직원 급여" 하나로 묶음
    const out: Tx[] = expenses
      .filter((e) => e.date)
      .map((e) => ({
        date: e.date!,
        tx_time: e.tx_time,
        amount: e.amount,
        balance_after: e.balance_after,
        who: e.category === 'labor' ? '직원 급여' : (e.counterpart || e.item || '').trim(),
      }))
    const inc: Tx[] = income.map((i) => ({ date: i.date, tx_time: i.tx_time, amount: i.amount, balance_after: i.balance_after, who: (i.counterpart || i.memo || '').trim() }))

    // 현재 잔고 = 가장 최근 거래의 거래후잔액
    const latest = [...out, ...inc]
      .filter((t) => t.balance_after != null && t.tx_time)
      .sort((a, b) => (a.tx_time! < b.tx_time! ? 1 : -1))[0]

    // 일별 입출금
    const daily = new Map<string, { 입금: number; 출금: number }>()
    for (const t of inc) daily.set(t.date, { ...(daily.get(t.date) ?? { 입금: 0, 출금: 0 }), 입금: (daily.get(t.date)?.입금 ?? 0) + t.amount })
    for (const t of out) daily.set(t.date, { ...(daily.get(t.date) ?? { 입금: 0, 출금: 0 }), 출금: (daily.get(t.date)?.출금 ?? 0) + t.amount })

    // 반복 지출 — 2개월 이상 같은 상대에게 나간 돈
    const byWho = new Map<string, Tx[]>()
    for (const t of out) if (t.who) byWho.set(t.who, [...(byWho.get(t.who) ?? []), t])
    const recurring = [...byWho.entries()]
      .map(([who, txs]) => {
        const months = new Set(txs.map((t) => t.date.slice(0, 7)))
        const days = txs.map((t) => Number(t.date.slice(8, 10))).sort((a, b) => a - b)
        return {
          상대: who,
          나간달수: months.size,
          보통날짜: `${days[Math.floor(days.length / 2)]}일 전후`,
          한달평균: Math.round(txs.reduce((s, t) => s + t.amount, 0) / months.size),
          마지막: txs.map((t) => t.date).sort().at(-1),
        }
      })
      .filter((r) => r.나간달수 >= 2)
      .sort((a, b) => b.한달평균 - a.한달평균)
      .slice(0, 15)

    // 잔고는 통장 파일의 마지막 거래 잔액 — 파일 이후 거래는 모름. 기준 시각을 한국 시간 글로 같이 줌
    const basis = latest ? balanceBasis(latest.tx_time!, now) : null
    const data = {
      오늘: today,
      현재잔고: latest && basis ? { 금액: latest.balance_after, 기준: basis.label, 기준후지난날: basis.days } : '알 수 없음',
      마지막거래일: [...out, ...inc].map((t) => t.date).sort().at(-1) ?? '없음',
      최근90일합계: { 입금: inc.reduce((s, t) => s + t.amount, 0), 출금: out.reduce((s, t) => s + t.amount, 0) },
      일별입출금: [...daily.entries()].sort().map(([date, v]) => ({ date, ...v })),
      반복지출: recurring,
      큰지출15: [...out].sort((a, b) => b.amount - a.amount).slice(0, 15).map((t) => ({ date: t.date, 상대: t.who, 금액: t.amount })),
    }

    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: `오늘(${today}) 기준 통장 데이터입니다. 앞으로 30일 현금 흐름 위험을 점검해 주세요.\n\n${JSON.stringify(data)}`,
      schema: OutputSchema,
      name: 'cashflow_check',
    })

    // 같은 주에 다시 돌리면 처리 안 한 이전 알림 교체
    const period = today.slice(0, 10)
    await supabase.from('ai_inbox').delete().eq('agent', 'cashflow').eq('status', 'new')
    if (output.alerts.length > 0) {
      const { error } = await supabase.from('ai_inbox').insert(
        output.alerts.slice(0, 2).map((a) => ({
          run_id: runId,
          agent: 'cashflow',
          kind: 'alert',
          severity: a.severity,
          title: a.title,
          body: a.why,
          evidence: a.evidence,
          action: a.action,
          period,
        }))
      )
      if (error) throw error
    }

    return {
      summary: output.alerts.length > 0 ? `${output.summary} (알림 ${output.alerts.length}건)` : `${output.summary} · 챙길 위험 없음`,
      output,
      period,
      usage,
      model,
    }
  })
}
