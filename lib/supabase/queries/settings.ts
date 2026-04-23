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
