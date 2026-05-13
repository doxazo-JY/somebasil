import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { recalcMonthlySummary } from '@/lib/supabase/recalc'
import type { DailySalesRow } from '../daily-sales/route'
import type { BankRow } from '../bank/route'
import type { MenuRow } from '../menu/route'

export async function POST(req: NextRequest) {
  const { type, rows, filename } = await req.json() as {
    type: 'daily_sales' | 'bank_transaction' | 'menu'
    rows: (DailySalesRow | BankRow | MenuRow)[]
    filename: string
  }

  const supabase = createServerClient()

  if (type === 'daily_sales') {
    const salesRows = rows as DailySalesRow[]
    // POS 데이터 → source='pos' 태그
    const rowsWithSource = salesRows.map((r) => ({ ...r, source: 'pos' }))
    // 라인 단위 upsert (date, order_id, line_no, source)
    // supabase-js는 배치 크기 제한이 있어 청크로 나눠서 처리
    const CHUNK = 500
    for (let i = 0; i < rowsWithSource.length; i += CHUNK) {
      const chunk = rowsWithSource.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('daily_sales')
        .upsert(chunk, { onConflict: 'date,order_id,line_no,source' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 영향받은 월 monthly_summary 재계산 (POS 우선 + 토글 + 수동 조정 반영)
    const monthsAffected = new Set(
      salesRows.map((r) => {
        const [year, month] = r.date.split('-').map(Number)
        return `${year}-${month}`
      })
    )
    for (const key of monthsAffected) {
      const [year, month] = key.split('-').map(Number)
      await recalcMonthlySummary(supabase, year, month)
    }
  }

  if (type === 'bank_transaction') {
    const bankRows = rows as BankRow[]

    // 통장 입금 → bank_income upsert
    // POS '매출'과 별개의 지표 — 카드 정산 지연·선불카드 차감 때문에 둘이 갈림 (의도된 갭)
    const incomeRows = bankRows.filter((r) => r.type === 'income')
    const incomeInserts = incomeRows.map((row) => ({
      date: row.date,
      tx_time: row.tx_time,
      balance_after: row.balance_after,
      memo: row.memo,
      counterpart: row.counterpart,
      amount: row.income ?? 0,
    }))
    if (incomeInserts.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < incomeInserts.length; i += CHUNK) {
        const chunk = incomeInserts.slice(i, i + CHUNK)
        const { error } = await supabase
          .from('bank_income')
          .upsert(chunk, { onConflict: 'tx_time,balance_after' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // 지출 항목 → monthly_expenses upsert (tx_time + balance_after로 중복 방지)
    const expenseRows = bankRows.filter((r) => r.type === 'expense')
    const expenseInserts = expenseRows.map((row) => {
      const [year, month] = row.date.split('-').map(Number)
      return {
        year,
        month,
        date: row.date,
        tx_time: row.tx_time,
        balance_after: row.balance_after,
        category: row.category,
        item: row.memo,
        counterpart: row.counterpart, // 거래처별 누적 매칭용 (memo 변동성 대응)
        amount: row.expense ?? 0,
      }
    })

    if (expenseInserts.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < expenseInserts.length; i += CHUNK) {
        const chunk = expenseInserts.slice(i, i + CHUNK)
        const { error } = await supabase
          .from('monthly_expenses')
          .upsert(chunk, { onConflict: 'tx_time,balance_after' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // 영향받은 월 monthly_summary 재계산 (토글 + 수동 조정 반영)
    const monthsAffected = new Set(
      expenseRows.map((r) => {
        const [y, m] = r.date.split('-').map(Number)
        return `${y}-${m}`
      })
    )
    for (const key of monthsAffected) {
      const [year, month] = key.split('-').map(Number)
      await recalcMonthlySummary(supabase, year, month)
    }
  }

  if (type === 'menu') {
    const menuRows = rows as MenuRow[]
    const inserts = menuRows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.price,
      is_active: r.is_active,
      updated_at: new Date().toISOString(),
    }))
    const CHUNK = 500
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const chunk = inserts.slice(i, i + CHUNK)
      const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
