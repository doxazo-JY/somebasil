import { createClient } from '@supabase/supabase-js'

// 서버 컴포넌트 전용 — 클라이언트 번들에 포함되지 않음
// service_role key 사용 — RLS를 우회하므로 절대 클라이언트에 노출 금지 (NEXT_PUBLIC_ 접두사 금지)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
