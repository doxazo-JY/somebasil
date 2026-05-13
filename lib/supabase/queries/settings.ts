import { createServerClient } from '../server'

// system_settings — 키/값 저장소 (jsonb)
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return (data?.value as T) ?? null
}

export async function setSetting<T = unknown>(key: string, value: T): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) throw error
}

// 대표 개인 거래 포함 여부 (기본 false = 집계에서 제외)
export async function getIncludeOwnerPersonal(): Promise<boolean> {
  const val = await getSetting<boolean>('include_owner_personal')
  return val === true
}

// 순이익 계산 기준 — 'pos' (POS 매출 기준, 기본) | 'bank' (통장 입금 기준)
// 매출/통장 입금 카드 자체는 영향 X — 순이익/이익률만 swap
export type IncomeBasis = 'pos' | 'bank'
export async function getIncomeBasis(): Promise<IncomeBasis> {
  const val = await getSetting<IncomeBasis>('income_basis')
  return val === 'bank' ? 'bank' : 'pos'
}
