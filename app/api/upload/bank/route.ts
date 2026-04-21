import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// 파싱된 거래 행 타입
export interface BankRow {
  date: string        // YYYY-MM-DD
  memo: string        // 적요
  counterpart: string // 의뢰인/수취인
  income: number | null
  expense: number | null
  category: string    // 파싱 규칙 적용 결과
  type: 'income' | 'expense'
}

// 재료비 키워드 (적요 매칭)
const INGREDIENT_KEYWORDS = [
  '원두', '말차', '우유', '햄', '원두값', '말차값',
  '재료', '비품', '포장', '페트병', '드립백',
]

// 재료비 수취인 (카페 구매 대납/거래처)
const INGREDIENT_COUNTERPARTS = ['홍인호']

// 고정비 키워드
const FIXED_KEYWORDS = [
  '전기세', '전기요금', '지방세', '세금', '임대료', '보험료', '근로소득세',
  '직장합산', '건강보험', '국민연금', '회계사', '지코드',
]

// 설비투자 키워드 (일회성 자본적 지출)
const EQUIPMENT_KEYWORDS = [
  '테이블', '스피커', '반죽기', '액자', '소분기', '더치기구',
]

// 제외 수취인 (집계에서 빼는 개인 출금)
const EXCLUDED_COUNTERPARTS = ['박기선']

function classifyRow(memo: string, counterpart: string, isIncome: boolean): {
  category: string
  type: 'income' | 'expense'
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

  // 제외 수취인 (박기선 등)
  if (EXCLUDED_COUNTERPARTS.some((c) => counterpart.includes(c) || memo.includes(c))) {
    return { category: 'excluded', type: 'expense' }
  }

  // 설비투자 키워드 (재료비보다 먼저 체크 — "드립백소분기"처럼 재료 키워드와 겹치는 경우 대비)
  if (EQUIPMENT_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'equipment', type: 'expense' }
  }

  // 재료비 키워드/수취인
  if (INGREDIENT_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'ingredients', type: 'expense' }
  }
  if (INGREDIENT_COUNTERPARTS.some((c) => counterpart.includes(c) || memo.includes(c))) {
    return { category: 'ingredients', type: 'expense' }
  }

  // 고정비 키워드
  if (FIXED_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'fixed', type: 'expense' }
  }

  // 나머지 출금 → 카드대금 (기본값)
  return { category: 'card', type: 'expense' }
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

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  // cellDates: true → Excel 날짜 시리얼을 JS Date로 자동 변환
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  // sheet_to_json으로 전체 읽기 (header: 1 → 배열 형태)
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  // 상단 5행 스킵 → 6행이 헤더, 7행부터 데이터
  // index: 0~4 스킵, 5 = 헤더, 6+ = 데이터
  const dataRows = allRows.slice(6) as unknown[][]

  const result: BankRow[] = []

  for (const row of dataRows) {
    // 빈 행 / 합계 행 스킵 (row[0]=null인 합계 행 방어)
    if (!row || row[0] == null || row[0] === '') continue

    const date = parseDateCell(row[0])
    if (!date || date.length < 10) continue // 날짜 파싱 실패 시 스킵

    const memo = String(row[1] ?? '')
    const counterpart = String(row[2] ?? '')
    const income = parseAmount(row[3])
    const expense = parseAmount(row[4])

    // 0원 거래 스킵 (입금/출금 모두 0 또는 null)
    const hasIncome = income != null && income > 0
    const hasExpense = expense != null && expense > 0
    if (!hasIncome && !hasExpense) continue

    const { category, type } = classifyRow(memo, counterpart, hasIncome)

    result.push({
      date,
      memo,
      counterpart,
      income,
      expense,
      category,
      type,
    })
  }

  return NextResponse.json({ rows: result, filename: file.name })
}
