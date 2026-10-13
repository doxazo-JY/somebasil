import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions } from '@/lib/supabase/queries/weekly'

// 지난주(월~일) 매출·통장이 어디까지 들어왔나 — 업로드 화면 체크리스트 + 업로드 직후 AI 분석 조건
//   = max(업로드한 파일의 기간 끝 [upload_history.period_end], 실제 데이터의 마지막 날짜)
//   파일 기간을 같이 보는 이유: 일요일에 통장 거래·매출이 없어도 그 파일이 일요일까지 담고 있으면 다 들어온 것

export type WeekCoverage = {
  week: { start: string; end: string; label: string }
  sales: string | null // 매출이 들어온 마지막 날
  bank: string | null // 통장이 들어온 마지막 날
  salesReady: boolean
  bankReady: boolean
}

const maxDate = (...ds: (string | null | undefined)[]) => ds.filter((d): d is string => !!d).sort().at(-1) ?? null

async function lastData(table: 'daily_sales' | 'bank_income' | 'monthly_expenses') {
  const supabase = createServerClient()
  let q = supabase.from(table).select('date').not('date', 'is', null).order('date', { ascending: false }).limit(1)
  if (table === 'daily_sales') q = q.eq('source', 'pos')
  const { data } = await q
  return (data?.[0]?.date as string | undefined) ?? null
}

async function lastFilePeriod(fileType: 'daily_sales' | 'bank_transaction') {
  const supabase = createServerClient()
  // period_end 칸이 없으면(마이그레이션 전) 에러 → 데이터 날짜만으로 판단
  const { data, error } = await supabase.from('upload_history').select('period_end').eq('file_type', fileType).not('period_end', 'is', null).order('period_end', { ascending: false }).limit(1)
  if (error) return null
  return (data?.[0]?.period_end as string | undefined) ?? null
}

export async function getWeekCoverage(): Promise<WeekCoverage> {
  const [, lastWeek] = getRecentWeekOptions(2)
  const [salesData, bankIn, bankOut, salesFile, bankFile] = await Promise.all([
    lastData('daily_sales'),
    lastData('bank_income'),
    lastData('monthly_expenses'),
    lastFilePeriod('daily_sales'),
    lastFilePeriod('bank_transaction'),
  ])
  const sales = maxDate(salesData, salesFile)
  const bank = maxDate(bankIn, bankOut, bankFile)
  return {
    week: { start: lastWeek.weekStart, end: lastWeek.weekEnd, label: lastWeek.label },
    sales,
    bank,
    salesReady: !!sales && sales >= lastWeek.weekEnd,
    bankReady: !!bank && bank >= lastWeek.weekEnd,
  }
}
