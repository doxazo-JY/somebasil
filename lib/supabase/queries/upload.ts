import { createServerClient } from '../server'

// 업로드 히스토리 최근 20건
export async function getUploadHistory() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('upload_history')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

// 월별 지출 항목 전체 (수정용)
export async function getEditableExpenses(year: number, month: number) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('id, category, item, amount')
    .eq('year', year)
    .eq('month', month)
    .order('category')
    .order('amount', { ascending: false })

  if (error) throw error
  return data ?? []
}
