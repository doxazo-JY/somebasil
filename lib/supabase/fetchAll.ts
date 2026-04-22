// Supabase PostgREST의 max_rows(기본 1000) 우회용 페이지네이션 헬퍼
// build(from, to) 팩토리를 받아 .range()로 반복 호출해서 전체 결과 수집
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw error
    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}
