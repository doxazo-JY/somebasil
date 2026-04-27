import { createServerClient } from '../server'
import { fetchAllRows } from '../fetchAll'
import { normalizeProductName, stripVariantSuffix } from '@/lib/menu-utils'

// ─────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────
type RawRow = {
  date: string
  order_id: string | null
  product_name: string | null
  category: string
  quantity: number | null
  amount: number
  order_time: string | null
}

// ─────────────────────────────────────────────
// 전체 POS 데이터 (기간 필터)
// ─────────────────────────────────────────────
async function fetchPosRows(sinceDate: string): Promise<RawRow[]> {
  const supabase = createServerClient()
  return fetchAllRows<RawRow>((from, to) =>
    supabase
      .from('daily_sales')
      .select('date, order_id, product_name, category, quantity, amount, order_time')
      .gte('date', sinceDate)
      .eq('source', 'pos')
      .order('date')
      .range(from, to),
  )
}

// ─────────────────────────────────────────────
// 요일 × 시간대 히트맵
// 요일: 0=일 ~ 6=토, 시간대: 0~23시
// ─────────────────────────────────────────────
export interface HeatmapCell {
  weekday: number
  hour: number
  amount: number
  orderCount: number
}

// DB의 TIMESTAMPTZ는 UTC로 정규화되어 반환됨 (예: "2025-12-11T03:04:00+00:00")
// 절대 시점을 파싱 후 +9시간 시프트해서 KST wall-clock 추출
function extractKSTWeekdayAndHour(
  isoString: string,
): { weekday: number; hour: number } | null {
  const utcMs = Date.parse(isoString)
  if (isNaN(utcMs)) return null
  const kst = new Date(utcMs + 9 * 3600 * 1000)
  return {
    weekday: kst.getUTCDay(),
    hour: kst.getUTCHours(),
  }
}

export async function getWeekdayHourHeatmap(sinceDate: string): Promise<HeatmapCell[]> {
  const rows = await fetchPosRows(sinceDate)

  // (weekday, hour, order_id) 단위로 집계 — KST 기준
  const amountMap = new Map<string, number>()
  const orderMap = new Map<string, Set<string>>()

  for (const r of rows) {
    if (!r.order_time) continue
    const parsed = extractKSTWeekdayAndHour(r.order_time)
    if (!parsed) continue
    const { weekday, hour } = parsed
    const key = `${weekday}|${hour}`

    amountMap.set(key, (amountMap.get(key) ?? 0) + r.amount)

    const orderSet = orderMap.get(key) ?? new Set<string>()
    if (r.order_id) orderSet.add(`${r.date}|${r.order_id}`)
    orderMap.set(key, orderSet)
  }

  const result: HeatmapCell[] = []
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      const key = `${w}|${h}`
      result.push({
        weekday: w,
        hour: h,
        amount: amountMap.get(key) ?? 0,
        orderCount: orderMap.get(key)?.size ?? 0,
      })
    }
  }
  return result
}

// ─────────────────────────────────────────────
// 죽은 메뉴 리스트
// 메뉴 유니버스(전체 기간 등장)에 대해 선택 기간 내 판매량을 계산.
// 기간 내 0건도 포함 → 정렬은 기간 내 판매량 ASC, 하위 N개.
// 핫/아이스 정규화 후 합산 (2026-04-23 점장 합의)
// ─────────────────────────────────────────────
export interface DeadMenu {
  product_id: string | null // 마스터 있을 때만 (수동 매칭 UI용)
  product_name: string
  category: string
  quantity: number // 기간 내 판매량
  amount: number // 기간 내 매출
  lastSoldDate: string | null // 기간 내 마지막 판매일 (없으면 null)
  daysSinceLastSold: number | null
}

export async function getDeadMenus(
  rangeStartDate: string,
  options: { limit?: number } = {},
): Promise<DeadMenu[]> {
  const { limit = 30 } = options
  const supabase = createServerClient()

  // 1) 활성 메뉴 마스터 (products.is_active=true) → 유니버스
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)

  // 2) 기간 내 POS 판매 (통계용)
  const periodRows = await fetchPosRows(rangeStartDate)

  // 3) 카테고리 매핑은 전체 기간(daily_sales의 distinct 페어) 기준
  // — 4주 selector 선택해도 옛날에 팔렸던 메뉴 카테고리 정확히 잡힘
  const categoryByName = new Map<string, string>()
  const allCatRows = await fetchAllRows<{ product_name: string | null; category: string }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('product_name, category')
        .eq('source', 'pos')
        .range(from, to),
  )
  for (const r of allCatRows) {
    if (!r.product_name) continue
    const norm = stripVariantSuffix(r.product_name)
    if (!categoryByName.has(norm)) categoryByName.set(norm, r.category)
  }

  const useMaster = !!products && products.length > 0

  // 4) 수동 매칭 (alias) 먼저 조회 — 카테고리 폴백 학습에도 사용
  // product_aliases 테이블이 없거나 비어있으면 무해
  const aliasesByProductId = new Map<string, string[]>() // product_id → [stripped pos_name]
  let aliasRows: { product_id: string; pos_name: string }[] = []
  if (useMaster) {
    try {
      const { data } = await supabase
        .from('product_aliases')
        .select('product_id, pos_name')
      aliasRows = data ?? []
      for (const a of aliasRows) {
        const list = aliasesByProductId.get(a.product_id) ?? []
        list.push(stripVariantSuffix(a.pos_name))
        aliasesByProductId.set(a.product_id, list)
      }
    } catch {
      // 테이블 없으면 그냥 스킵
    }
  }

  type Bucket = {
    product_id: string | null
    product_name: string // 표시용 (마스터 원본 또는 정규화된 POS 이름)
    category: string
    quantity: number
    amount: number
    lastSoldDate: string | null
  }
  const universe = new Map<string, Bucket>() // key = stripped name (매칭 키)
  const idToKey = new Map<string, string>() // master id → stripped key

  // 5) 유니버스 시드
  if (useMaster) {
    for (const p of products!) {
      const norm = stripVariantSuffix(p.name)
      if (universe.has(norm)) continue
      // 카테고리 학습: 1) 마스터 이름 직접, 2) alias의 pos_name 폴백
      let cat = categoryByName.get(norm)
      if (!cat) {
        for (const ak of aliasesByProductId.get(p.id) ?? []) {
          const c = categoryByName.get(ak)
          if (c) { cat = c; break }
        }
      }
      if (!cat) cat = 'etc'
      // 기타 카테고리는 메뉴가 아닌 운영 항목 (할인·수정 등) → 제외
      if (cat === 'etc') continue
      universe.set(norm, {
        product_id: p.id,
        product_name: p.name, // 마스터 원본 (공백 유지)
        category: cat,
        quantity: 0,
        amount: 0,
        lastSoldDate: null,
      })
      idToKey.set(p.id, norm)
    }
  } else {
    // fallback (마스터 미등록): POS에 등장한 메뉴 — 기존 동작
    for (const r of periodRows) {
      if (!r.product_name || r.category === 'etc') continue
      const display = normalizeProductName(r.product_name, r.category)
      const key = stripVariantSuffix(r.product_name)
      if (!universe.has(key)) {
        universe.set(key, {
          product_id: null,
          product_name: display,
          category: r.category,
          quantity: 0,
          amount: 0,
          lastSoldDate: null,
        })
      }
    }
  }

  // 5-1) alias 매칭 사전 — raw pos_name (정확 매치) → master_key
  // 점장이 명시한 매핑이 자동 정규화보다 우선
  const aliasByPosName = new Map<string, string>()
  for (const a of aliasRows) {
    const masterKey = idToKey.get(a.product_id)
    if (masterKey) aliasByPosName.set(a.pos_name, masterKey)
  }

  // 5-2) 기간 내 판매량/매출 누적 — alias 우선, 없으면 자동 정규화 매칭
  for (const r of periodRows) {
    if (!r.product_name) continue
    // alias 우선 (점장이 명시적으로 지정한 매핑)
    let masterKey = aliasByPosName.get(r.product_name)
    // 폴백: 자동 정규화 매칭
    if (!masterKey) masterKey = stripVariantSuffix(r.product_name)
    const u = universe.get(masterKey)
    if (!u) continue // 마스터에 없거나 'etc'로 필터된 항목
    u.quantity += r.quantity ?? 0
    u.amount += r.amount
    if (!u.lastSoldDate || r.date > u.lastSoldDate) {
      u.lastSoldDate = r.date
    }
  }

  // 6) days since today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result: DeadMenu[] = [...universe.values()].map((u) => {
    let daysSince: number | null = null
    if (u.lastSoldDate) {
      const d = new Date(u.lastSoldDate)
      daysSince = Math.floor(
        (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
      )
    }
    return { ...u, daysSinceLastSold: daysSince }
  })

  // 7) 마지막 판매일 오래된 순 (null = 한 번도 안 팔림 → 최우선) → 하위 N개
  return result
    .sort((a, b) => {
      const aKey = a.lastSoldDate ?? '' // null → 빈 문자열 → 가장 앞
      const bKey = b.lastSoldDate ?? ''
      const cmp = aKey.localeCompare(bKey)
      if (cmp !== 0) return cmp
      // 같은 날짜(또는 둘 다 null)면 판매량 적은 순
      return a.quantity - b.quantity
    })
    .slice(0, limit)
}

// ─────────────────────────────────────────────
// 메뉴 마스터 리스트 + 각 마스터의 alias 개수 — 마스터 관리 UI용
// ─────────────────────────────────────────────
export interface MasterMatch {
  pos_name: string
  via: 'alias' | 'auto' // alias = 수동 매핑, auto = 자동 정규화 매칭
}

export interface MasterProduct {
  id: string
  name: string
  is_active: boolean
  /** 이 마스터에 매칭된 POS 이름들 (수동 + 자동) */
  matches: MasterMatch[]
}

export async function getMasterProducts(): Promise<MasterProduct[]> {
  const supabase = createServerClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, is_active')
    .order('name')

  // alias 사전: pos_name → product_id
  const aliasByPosName = new Map<string, string>()
  try {
    const { data: aliases } = await supabase
      .from('product_aliases')
      .select('product_id, pos_name')
    for (const a of aliases ?? []) {
      aliasByPosName.set(a.pos_name, a.product_id)
    }
  } catch {
    // alias 테이블 없으면 무시
  }

  // 마스터 stripped key → product_id (활성 마스터만 자동 매칭 대상)
  const strippedToProductId = new Map<string, string>()
  for (const p of products ?? []) {
    if (!p.is_active) continue
    strippedToProductId.set(stripVariantSuffix(p.name), p.id)
  }

  // POS distinct product_name 수집 (etc 제외)
  const posNames = new Set<string>()
  const rows = await fetchAllRows<{ product_name: string | null; category: string }>(
    (from, to) =>
      supabase
        .from('daily_sales')
        .select('product_name, category')
        .eq('source', 'pos')
        .range(from, to),
  )
  for (const r of rows) {
    if (r.product_name && r.category !== 'etc') posNames.add(r.product_name)
  }

  // 각 POS 이름의 매칭 결정 — alias 우선, 없으면 자동 정규화
  const matchesByProduct = new Map<string, MasterMatch[]>()
  for (const posName of posNames) {
    let productId: string | undefined
    let via: 'alias' | 'auto' = 'auto'
    if (aliasByPosName.has(posName)) {
      productId = aliasByPosName.get(posName)
      via = 'alias'
    } else {
      productId = strippedToProductId.get(stripVariantSuffix(posName))
    }
    if (!productId) continue
    const list = matchesByProduct.get(productId) ?? []
    list.push({ pos_name: posName, via })
    matchesByProduct.set(productId, list)
  }

  return (products ?? []).map((p) => {
    const matches = (matchesByProduct.get(p.id) ?? []).sort((a, b) =>
      a.pos_name.localeCompare(b.pos_name, 'ko'),
    )
    return { ...p, matches }
  })
}

// ─────────────────────────────────────────────
// 전체 POS 이름 + 매칭 상태 — 수동 매칭 모달 후보
// 매칭된 건 회색으로 보여주고, 미매칭 위쪽 정렬
// ─────────────────────────────────────────────
export interface PosNameWithStatus {
  pos_name: string
  quantity: number
  lastDate: string
  /** 이미 매칭된 마스터 이름 (없으면 null = 미매칭) */
  matchedMasterName: string | null
  /** 매칭 종류: 'master' = 자동 정규화 매칭, 'alias' = 수동 매칭 */
  matchedVia: 'master' | 'alias' | null
}

export async function getAllPosNamesWithStatus(): Promise<PosNameWithStatus[]> {
  const supabase = createServerClient()

  // 1) 마스터 이름 사전: stripped → 마스터 표시이름
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
  const masterByKey = new Map<string, string>()
  const masterById = new Map<string, string>()
  for (const p of products ?? []) {
    masterByKey.set(stripVariantSuffix(p.name), p.name)
    masterById.set(p.id, p.name)
  }

  // 2) alias 사전: pos_name (raw) → 매칭된 마스터 이름
  const aliasByPosName = new Map<string, string>()
  try {
    const { data: aliases } = await supabase
      .from('product_aliases')
      .select('product_id, pos_name')
    for (const a of aliases ?? []) {
      const masterName = masterById.get(a.product_id)
      if (masterName) aliasByPosName.set(a.pos_name, masterName)
    }
  } catch {
    // 테이블 없으면 무시
  }

  // 3) POS sales 전체 집계
  const rows = await fetchAllRows<{
    product_name: string | null
    quantity: number | null
    date: string
    category: string
  }>((from, to) =>
    supabase
      .from('daily_sales')
      .select('product_name, quantity, date, category')
      .eq('source', 'pos')
      .range(from, to),
  )

  type Agg = { quantity: number; lastDate: string }
  const map = new Map<string, Agg>()
  for (const r of rows) {
    if (!r.product_name) continue
    if (r.category === 'etc') continue
    const cur = map.get(r.product_name) ?? { quantity: 0, lastDate: '' }
    cur.quantity += r.quantity ?? 0
    if (r.date > cur.lastDate) cur.lastDate = r.date
    map.set(r.product_name, cur)
  }

  // 4) 매칭 상태 판정 — alias 우선 (점장이 명시적으로 지정)
  const result: PosNameWithStatus[] = []
  for (const [pos_name, agg] of map.entries()) {
    const aliasMaster = aliasByPosName.get(pos_name)
    const stripped = stripVariantSuffix(pos_name)
    const masterName = masterByKey.get(stripped)
    let matchedMasterName: string | null = null
    let matchedVia: 'master' | 'alias' | null = null
    if (aliasMaster) {
      matchedMasterName = aliasMaster
      matchedVia = 'alias'
    } else if (masterName) {
      matchedMasterName = masterName
      matchedVia = 'master'
    }
    result.push({ pos_name, ...agg, matchedMasterName, matchedVia })
  }

  // 5) 정렬: 미매칭 우선, 그 안에서 판매량 내림차순
  return result.sort((a, b) => {
    if (a.matchedMasterName === null && b.matchedMasterName !== null) return -1
    if (a.matchedMasterName !== null && b.matchedMasterName === null) return 1
    return b.quantity - a.quantity
  })
}
