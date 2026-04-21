import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { DailySalesRow } from '../daily-sales/route'
import type { BankRow } from '../bank/route'

export async function POST(req: NextRequest) {
  const { type, rows, filename } = await req.json() as {
    type: 'daily_sales' | 'bank_transaction'
    rows: (DailySalesRow | BankRow)[]
    filename: string
  }

  const supabase = createServerClient()

  if (type === 'daily_sales') {
    const salesRows = rows as DailySalesRow[]
    // POS 데이터 → source='pos' 태그
    const rowsWithSource = salesRows.map((r) => ({ ...r, source: 'pos' }))
    const { error } = await supabase
      .from('daily_sales')
      .upsert(rowsWithSource, { onConflict: 'date,category' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // POS 업로드 시 monthly_summary.income도 갱신 (daily_sales 기준으로 재집계)
    const monthsAffected = new Set(
      salesRows.map((r) => {
        const [year, month] = r.date.split('-').map(Number)
        return `${year}-${month}`
      })
    )
    for (const key of monthsAffected) {
      const [year, month] = key.split('-').map(Number)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      // POS 있는 날은 pos만, 없는 날은 bank 합산
      const { data: allSales } = await supabase
        .from('daily_sales')
        .select('date, amount, source')
        .gte('date', startDate)
        .lt('date', endDate)

      const totalIncome = calcIncomePreferPos(allSales ?? [])

      const { data: existing } = await supabase
        .from('monthly_summary')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        await supabase.from('monthly_summary').update({ income: totalIncome }).eq('id', existing.id)
      } else {
        await supabase.from('monthly_summary').insert({ year, month, income: totalIncome, total_expense: 0 })
      }
    }
  }

  if (type === 'bank_transaction') {
    const bankRows = rows as BankRow[]

    // 수입 = POS only 원칙: 통장 입금은 DB에 저장하지 않음
    // (대여금/개인이체/선불충전 등이 섞여있고, 카드사 입금은 POS와 중복)

    // 지출 항목 → monthly_expenses 삽입 (date 포함)
    const expenseRows = bankRows.filter((r) => r.type === 'expense')
    const expenseInserts = expenseRows.map((row) => {
      const [year, month] = row.date.split('-').map(Number)
      return { year, month, date: row.date, category: row.category, item: row.memo, amount: row.expense ?? 0 }
    })

    if (expenseInserts.length > 0) {
      const { error } = await supabase.from('monthly_expenses').insert(expenseInserts)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 월별 지출 합산 → monthly_summary.total_expense 업데이트
    // excluded 카테고리는 집계에서 제외 (박기선 개인 출금 등)
    const expenseByMonth: Record<string, number> = {}
    for (const row of expenseRows) {
      if (row.category === 'excluded') continue
      const [year, month] = row.date.split('-').map(Number)
      const key = `${year}-${month}`
      expenseByMonth[key] = (expenseByMonth[key] ?? 0) + (row.expense ?? 0)
    }

    for (const [key, totalExpense] of Object.entries(expenseByMonth)) {
      const [year, month] = key.split('-').map(Number)
      const { data: existing } = await supabase
        .from('monthly_summary')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        await supabase.from('monthly_summary').update({ total_expense: totalExpense }).eq('id', existing.id)
      } else {
        await supabase.from('monthly_summary').insert({ year, month, income: 0, total_expense: totalExpense })
      }
    }
  }

  // 업로드 히스토리 기록
  await supabase.from('upload_history').insert({
    file_name: filename,
    file_type: type,
    status: 'success',
  })

  return NextResponse.json({ ok: true })
}

// POS 우선: 날짜에 pos 데이터 있으면 pos만, 없으면 bank 사용
function calcIncomePreferPos(rows: { date: string; amount: number; source: string }[]): number {
  const byDate: Record<string, { pos: number; bank: number }> = {}
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { pos: 0, bank: 0 }
    if (r.source === 'pos') byDate[r.date].pos += r.amount
    else byDate[r.date].bank += r.amount
  }
  return Object.values(byDate).reduce((sum, d) => sum + (d.pos > 0 ? d.pos : d.bank), 0)
}
