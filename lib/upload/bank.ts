import type * as XLSX from 'xlsx'
import { sheetRows } from './read'

// 하나은행 거래내역 파일 → 거래 행 + 조회기간 (규칙 분류)
// 구조: 1행 "거래내역" / 3~5행 예금주·계좌·조회기간 / 6행 헤더 / 7행부터 데이터
// 컬럼: 거래일시 | 적요 | 의뢰인/수취인 | 입금액 | 출금액 | 거래후잔액 | 구분 | 거래점 | 거래특이사항

// 파싱된 거래 행 타입
export interface BankRow {
  date: string        // YYYY-MM-DD
  tx_time: string     // ISO 8601 거래일시 (초 단위) — dedup key
  balance_after: number // 거래후잔액 — dedup key
  memo: string        // 적요
  counterpart: string // 의뢰인/수취인
  income: number | null
  expense: number | null
  category: string    // 파싱 규칙 적용 결과
  type: 'income' | 'expense'
  uncertain?: boolean   // 자동 분류가 기본값(재료비-카드)으로 떨어진 출금
}

// 재료비(현금) — 정기 공급처 (매달 반복, 주로 현금/계좌이체)
const INGREDIENT_CASH_COUNTERPARTS = ['홍인호', '김인성', '한성욱', '소금집']

// 재료비(카드) — 비정기 구매 (마트·편의점·도매·부자재 등)
const INGREDIENT_CARD_KEYWORDS = [
  // 원재료
  '원두', '말차', '우유', '햄', '원두값', '말차값',
  // 일반 재료/포장/비품
  '재료', '비품', '포장', '페트병', '드립백',
  // 구매처 키워드
  '쿠팡', '이마트', '씨유', '최강식자재', '농부의외양간', '딸기청', '화과자',
]

// 고정비 키워드 (전기·세금·보험·공과금·전문가 서비스·POS 시스템 등)
const FIXED_KEYWORDS = [
  '전기', '지방세', '세금', '임대료', '보험료', '근로소득세',
  '직장합산', '건강보험', '국민연금', '회계사', '지코드',
]

// 설비투자 키워드 (일회성 자본적 지출)
const EQUIPMENT_KEYWORDS = [
  '테이블', '스피커', '반죽기', '액자', '소분기', '더치기구',
]

// 제외 수취인 (대표 개인 인출 — 설정에서 on/off 토글)
const EXCLUDED_COUNTERPARTS = ['박기선']

export function classifyRow(memo: string, counterpart: string, isIncome: boolean): {
  category: string
  type: 'income' | 'expense'
  uncertain?: boolean // 어떤 규칙에도 안 걸려 기본값으로 분류됨 → 업로드 후 확인 목록에
} {
  // 입금은 POS only 원칙에 따라 전부 'income' 타입으로만 반환
  // (save 단계에서 DB에 저장하지 않음 — 미리보기 확인용)
  if (isIncome) {
    return { category: 'income', type: 'income' }
  }

  // 급여 → 인건비
  if (memo.includes('급여')) {
    return { category: 'labor', type: 'expense' }
  }

  // 고정비 (excluded보다 먼저 — "지방세_인천계양구(박기선)" 같은 케이스를 고정비로 귀속)
  if (FIXED_KEYWORDS.some((k) => memo.includes(k) || counterpart.includes(k))) {
    return { category: 'fixed', type: 'expense' }
  }

  // 제외 수취인 (대표 개인 인출). 수취인 정확 매칭 — "지방세_인천계양구(박기선)" 같은 포함 매칭 방지
  if (EXCLUDED_COUNTERPARTS.some((c) => counterpart === c || memo === c)) {
    return { category: 'excluded', type: 'expense' }
  }

  // 설비투자 (재료비보다 먼저 — "드립백소분기"처럼 재료 키워드와 겹치는 경우 대비)
  if (EQUIPMENT_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'equipment', type: 'expense' }
  }

  // 재료비(현금) — 정기 공급처 수취인 매칭 먼저
  if (INGREDIENT_CASH_COUNTERPARTS.some((c) => counterpart.includes(c) || memo.includes(c))) {
    return { category: 'ingredients_cash', type: 'expense' }
  }

  // 재료비(카드) — 비정기 구매 키워드
  if (INGREDIENT_CARD_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'ingredients_card', type: 'expense' }
  }

  // 나머지 출금 → 재료비(카드) 기본값
  // (카드사 묶음결제는 사실상 재료 — 점장 수동분류 패턴을 자동화. outlier는 ReclassifyTable에서 옮김)
  return { category: 'ingredients_card', type: 'expense', uncertain: true }
}

// 콤마 포함 문자열 숫자 파싱
function parseAmount(val: unknown): number | null {
  if (val == null || val === '') return null
  const str = String(val).replace(/,/g, '').trim()
  const num = Number(str)
  return isNaN(num) || str === '' ? null : num
}

// Excel 날짜 값 → YYYY-MM-DD 변환
function parseDateCell(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // 문자열: "2026-04-17 12:34:00" 또는 "2026-04-17" 형태
  const str = String(val ?? '')
  return str.slice(0, 10)
}

// 거래일시 → ISO 8601 (KST)
function parseTxTime(val: unknown): string | null {
  if (val instanceof Date) return val.toISOString()
  const str = String(val ?? '').trim()
  const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${(s ?? '00').padStart(2, '0')}+09:00`
}


export function isBankWorkbook(wb: XLSX.WorkBook): boolean {
  const rows = sheetRows(wb).slice(0, 8)
  const text = rows.map((r) => r.map((c) => String(c ?? '')).join('|')).join('\n')
  return text.includes('거래내역') && text.includes('거래일시') && text.includes('적요')
}

export function parseBank(wb: XLSX.WorkBook): { rows: BankRow[]; from: string | null; to: string | null } {
  const allRows = sheetRows(wb, wb.SheetNames[0], true)

  // 조회기간 : 2026-04-17 ~ 2026-04-21
  let from: string | null = null
  let to: string | null = null
  for (const r of allRows.slice(0, 6)) {
    const m = String(r?.[0] ?? '').match(/조회기간\s*:\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
    if (m) [, from, to] = m
  }

  // 헤더(거래일시) 다음 행부터 데이터
  const headerIdx = allRows.findIndex((r) => String(r?.[0] ?? '').trim() === '거래일시')
  const dataRows = allRows.slice(headerIdx >= 0 ? headerIdx + 1 : 6)

  const result: BankRow[] = []
  for (const row of dataRows) {
    // 빈 행 / 합계 행 스킵
    if (!row || row[0] == null || row[0] === '') continue
    const date = parseDateCell(row[0])
    if (!date || date.length < 10) continue
    const tx_time = parseTxTime(row[0])
    if (!tx_time) continue // 거래일시 = 중복 판별 키

    const memo = String(row[1] ?? '')
    const counterpart = String(row[2] ?? '')
    const income = parseAmount(row[3])
    const expense = parseAmount(row[4])
    const balance_after = parseAmount(row[5]) ?? 0
    const hasIncome = income != null && income > 0
    const hasExpense = expense != null && expense > 0
    if (!hasIncome && !hasExpense) continue

    const { category, type, uncertain } = classifyRow(memo, counterpart, hasIncome)
    result.push({ date, tx_time, balance_after, memo, counterpart, income, expense, category, type, uncertain })
  }
  return { rows: result, from, to }
}
