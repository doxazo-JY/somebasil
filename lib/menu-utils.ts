// 메뉴 표시 / 정규화 공통 유틸
// - 핫/아이스 suffix 제거: 같은 음료를 한 줄로 합산
// - 카테고리별 수량 단위 매핑 (잔 / 개)
// 점장 미팅(2026-04-23) 합의 사항

// 음료 성격 카테고리 — 핫/아이스 정규화 대상이자 "잔" 단위
export const DRINK_CATEGORIES = new Set([
  'coffee',
  'matcha',
  'ade',
  'tea',
  'beverage',
  'drip_coffee',
  'dutch_coffee',
  'season',
])

// 핫/아이스 표기 패턴
// - 괄호형: (HOT) / (ICE) / (H) / (I) / (핫) / (아이스) / (ICE Only) / (Only Ice)
const PAREN_RE = /\s*\((?:HOT|ICE|H|I|핫|아이스|ICE\s*Only|Only\s*Ice)\)/gi
// - 분리형 단어: HOT / ICE / 핫 / 아이스 (단어 경계)
const WORD_RE = /(?:^|\s)(?:HOT|ICE|핫|아이스)(?=\s|$)/gi

// 표시용 정규화 — HOT/ICE suffix만 제거, 공백은 유지 (사람이 읽는 이름)
// 음료끼리 합산할 때 그룹 키로도 사용
export function normalizeProductName(
  name: string,
  category: string,
): string {
  if (!DRINK_CATEGORIES.has(category)) return name.trim()
  return name
    .replace(PAREN_RE, '')
    .replace(WORD_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 카테고리 무관 — 매칭용 정규화 (products ↔ daily_sales 이름 비교용)
// HOT/ICE suffix 제거 + 공백·괄호·특수문자 모두 제거 + 소문자
// 예: "말차 티라미수 미니" / "말차 티라미수(미니)" → 둘 다 "말차티라미수미니"
export function stripVariantSuffix(name: string): string {
  return name
    .replace(PAREN_RE, '') // (HOT) (ICE) 통째 제거
    .replace(WORD_RE, ' ') // HOT ICE 단어 제거
    .replace(/[\s()\[\]{}.,·_/\\-]/g, '') // 공백·괄호·구두점 모두 제거
    .toLowerCase()
}

// 매칭 2차 키 — 끝의 "티"만 다른 이름 (도원결의 ↔ 도원결의티, TWG 캐모마일 ↔ TWG 캐모마일티)
// 1차 키(stripVariantSuffix)로 못 찾을 때만 씀. [단품]·(5개) 같은 말은 빼지 않음 (드립백5개 ↔ 드립백10개가 합쳐지지 않게)
export function looseMenuKey(name: string): string {
  return stripVariantSuffix(name).replace(/티$/, '')
}

export type MatchProduct = { id: string; name: string; is_active: boolean }
export type MatchAlias = { product_id: string; pos_name: string }

// POS 판매 이름 → 메뉴 마스터 id. 순서: 수동 매칭(alias) → 이름 같음 → 끝 "티"만 다름
// 자동 매칭은 사용 중인 메뉴만. 2차 키가 메뉴 두 개에 걸리면 매칭 안 함 (잘못 붙느니 수동으로)
export function createMenuMatcher(products: MatchProduct[], aliases: MatchAlias[]) {
  const alias = new Map(aliases.map((a) => [a.pos_name, a.product_id]))
  const exact = new Map<string, string>()
  const loose = new Map<string, string | null>()
  for (const p of products) {
    if (!p.is_active) continue
    const k = stripVariantSuffix(p.name)
    if (!exact.has(k)) exact.set(k, p.id)
    const l = looseMenuKey(p.name)
    loose.set(l, loose.has(l) && loose.get(l) !== p.id ? null : p.id)
  }
  return (posName: string): { productId: string; via: 'alias' | 'auto' } | null => {
    const a = alias.get(posName)
    if (a) return { productId: a, via: 'alias' }
    const e = exact.get(stripVariantSuffix(posName))
    if (e) return { productId: e, via: 'auto' }
    const l = loose.get(looseMenuKey(posName))
    return l ? { productId: l, via: 'auto' } : null
  }
}

// 수량 단위 — 디저트는 "개", 음료/시즌/기타는 "잔"
export function unitFor(category: string): string {
  return category === 'dessert' ? '개' : '잔'
}
