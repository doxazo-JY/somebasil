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
    const { error } = await supabase
      .from('daily_sales')
      .upsert(salesRows, { onConflict: 'date,category' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (type === 'bank_transaction') {
    const bankRows = rows as BankRow[]

    // 수입 항목 → monthly_summary.income 누적
    const incomeRows = bankRows.filter((r) => r.type === 'income')
    const incomeByMonth: Record<string, number> = {}
    for (const row of incomeRows) {
      const [year, month] = row.date.split('-').map(Number)
      const key = `${year}-${month}`
      incomeByMonth[key] = (incomeByMonth[key] ?? 0) + (row.income ?? 0)
    }

    for (const [key, totalIncome] of Object.entries(incomeByMonth)) {
      const [year, month] = key.split('-').map(Number)
      const { data: existing } = await supabase
        .from('monthly_summary')
        .select('id, income')
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        await supabase
          .from('monthly_summary')
          .update({ income: existing.income + totalIncome })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('monthly_summary')
          .insert({ year, month, income: totalIncome, total_expense: 0 })
      }
    }

    // 지출 항목 → monthly_expenses 삽입
    const expenseRows = bankRows.filter((r) => r.type === 'expense')
    const expenseInserts = expenseRows.map((row) => {
      const [year, month] = row.date.split('-').map(Number)
      return { year, month, category: row.category, item: row.memo, amount: row.expense ?? 0 }
    })

    if (expenseInserts.length > 0) {
      const { error } = await supabase.from('monthly_expenses').insert(expenseInserts)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 월별로 지출 합산 → monthly_summary.total_expense 업데이트
    const expenseByMonth: Record<string, number> = {}
    for (const row of expenseRows) {
      const [year, month] = row.date.split('-').map(Number)
      const key = `${year}-${month}`
      expenseByMonth[key] = (expenseByMonth[key] ?? 0) + (row.expense ?? 0)
    }

    for (const [key, totalExpense] of Object.entries(expenseByMonth)) {
      const [year, month] = key.split('-').map(Number)
      const { data: existing } = await supabase
        .from('monthly_summary')
        .select('id, total_expense')
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existing) {
        await supabase
          .from('monthly_summary')
          .update({ total_expense: existing.total_expense + totalExpense })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('monthly_summary')
          .insert({ year, month, income: 0, total_expense: totalExpense })
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
