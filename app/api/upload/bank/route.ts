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

// 카드사명 패턴 (입금 → 수입)
const CARD_COMPANIES = [
  '비씨카드', '현대카드', '국민카드', '신한카드', '롯데카드',
  '삼성카드', '우리카드', '하나카드', '케이비국민카드', '케이뱅크',
]

// 재료비 키워드
const INGREDIENT_KEYWORDS = ['원두', '말차', '우유', '햄', '원두값', '말차값']

// 고정비 키워드
const FIXED_KEYWORDS = ['전기세', '지방세', '세금', '임대료', '보험료', '근로소득세']

function classifyRow(memo: string, counterpart: string, isIncome: boolean): {
  category: string
  type: 'income' | 'expense'
} {
  const text = `${memo} ${counterpart}`.toLowerCase()

  // 카드사 입금 → 수입
  if (isIncome && CARD_COMPANIES.some((c) => text.includes(c.toLowerCase()))) {
    return { category: 'income', type: 'income' }
  }

  // 급여 → 인건비
  if (!isIncome && memo.includes('급여')) {
    return { category: 'labor', type: 'expense' }
  }

  // 재료비 키워드
  if (!isIncome && INGREDIENT_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'ingredients', type: 'expense' }
  }

  // 고정비 키워드
  if (!isIncome && FIXED_KEYWORDS.some((k) => memo.includes(k))) {
    return { category: 'fixed', type: 'expense' }
  }

  // 나머지 입금 → 수입 (개인이체 등)
  if (isIncome) {
    return { category: 'income', type: 'income' }
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
    if (!row || !row[0]) continue // 빈 행 스킵

    const date = parseDateCell(row[0])
    if (!date || date.length < 10) continue // 날짜 파싱 실패 시 스킵

    const memo = String(row[1] ?? '')
    const counterpart = String(row[2] ?? '')
    const income = parseAmount(row[3])
    const expense = parseAmount(row[4])

    // 입금/출금 모두 없으면 스킵
    if (income === null && expense === null) continue

    const isIncome = income !== null && income > 0
    const { category, type } = classifyRow(memo, counterpart, isIncome)

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
