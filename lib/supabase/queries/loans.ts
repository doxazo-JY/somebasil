import { createServerClient } from '../server'

export interface Loan {
  id: number
  date: string
  direction: 'borrow' | 'repay'
  amount: number
  counterpart: string | null
  memo: string | null
  created_at: string
}

export async function getLoans(): Promise<Loan[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error
  return (data ?? []) as Loan[]
}

// 잔액 = Σ(borrow) - Σ(repay)  (양수면 외부에 돈을 빌려준 상태 아님, 외부로부터 빌린 상태)
// 카페 관점: +면 갚아야 할 돈, -면 받아야 할 돈
export async function getLoanBalance(): Promise<number> {
  const loans = await getLoans()
  return loans.reduce(
    (s, l) => s + (l.direction === 'borrow' ? l.amount : -l.amount),
    0,
  )
}

// 상대방별 잔액 요약
export async function getLoanBalanceByCounterpart(): Promise<
  { counterpart: string; balance: number; borrow: number; repay: number }[]
> {
  const loans = await getLoans()
  const map = new Map<string, { borrow: number; repay: number }>()
  for (const l of loans) {
    const key = l.counterpart ?? '—'
    const cur = map.get(key) ?? { borrow: 0, repay: 0 }
    if (l.direction === 'borrow') cur.borrow += l.amount
    else cur.repay += l.amount
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([counterpart, v]) => ({
      counterpart,
      balance: v.borrow - v.repay,
      borrow: v.borrow,
      repay: v.repay,
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
}
