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
