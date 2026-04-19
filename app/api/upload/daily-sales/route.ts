import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// POS 파일 파싱 결과 타입
export interface DailySalesRow {
  date: string       // YYYY-MM-DD
  category: string
  amount: number
}

// 카테고리 매핑 (POS 파일 컬럼명 → DB category)
const CATEGORY_MAP: Record<string, string> = {
  '커피': 'coffee',
  '말차': 'matcha',
  '음료': 'beverage',
  '디저트': 'dessert',
}

function mapCategory(raw: string): string {
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (raw.includes(key)) return value
  }
  return raw.toLowerCase().replace(/\s+/g, '_')
}

// 파일명에서 날짜 추출 (YYYYMMDD.xlsx 또는 MMDD.xlsx)
function parseDateFromFilename(filename: string): string | null {
  const base = filename.replace(/\.(xlsx|xls)$/i, '')
  if (/^\d{8}$/.test(base)) {
    return `${base.slice(0, 4)}-${base.slice(4, 6)}-${base.slice(6, 8)}`
  }
  if (/^\d{4}$/.test(base)) {
    const year = new Date().getFullYear()
    return `${year}-${base.slice(0, 2)}-${base.slice(2, 4)}`
  }
  return null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const date = parseDateFromFilename(file.name)
  if (!date) {
    return NextResponse.json(
      { error: '파일명이 올바르지 않습니다. YYYYMMDD.xlsx 형식으로 업로드해주세요.' },
      { status: 400 }
    )
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const result: DailySalesRow[] = []

  for (const row of rows) {
    for (const [col, val] of Object.entries(row)) {
      if (col === '__rowNum__') continue
      const amount = Number(val)
      if (!isNaN(amount) && amount > 0) {
        result.push({
          date,
          category: mapCategory(col),
          amount,
        })
      }
    }
  }

  return NextResponse.json({ date, rows: result, filename: file.name })
}
