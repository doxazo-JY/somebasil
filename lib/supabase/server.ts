import { createClient } from '@supabase/supabase-js'

// 서버 컴포넌트 전용 — 클라이언트 번들에 포함되지 않음
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
