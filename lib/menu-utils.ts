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
// - 괄호형: (HOT) / (ICE) / (H) / (I) / (핫) / (아이스)
const PAREN_RE = /\s*\((?:HOT|ICE|H|I|핫|아이스)\)/gi
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

// 수량 단위 — 디저트는 "개", 음료/시즌/기타는 "잔"
export function unitFor(category: string): string {
  return category === 'dessert' ? '개' : '잔'
}
