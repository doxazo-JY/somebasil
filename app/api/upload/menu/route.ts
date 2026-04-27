import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// POS 메뉴 마스터 파일 파서
// v2 포맷 (5컬럼): [빈, ID, Y/N, 명칭, 단가]
// - row 0~1: 헤더/타이틀, row 2부터 데이터
// - Y/N은 사용 여부 → is_active
export interface MenuRow {
  id: string
  name: string
  price: number
  is_active: boolean
}

function parseAmount(val: unknown): number {
  if (val == null || val === '') return 0
  const str = String(val).replace(/,/g, '').trim()
  const num = Number(str)
  return isNaN(num) ? 0 : Math.round(num)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  // 데이터 행: row 2 이후 (row 0=타이틀, row 1=헤더)
  const dataRows = allRows.slice(2) as unknown[][]

  const result: MenuRow[] = []
  for (const row of dataRows) {
    if (!row) continue
    const id = String(row[1] ?? '').trim()
    const status = String(row[2] ?? '').trim().toUpperCase()
    const name = String(row[3] ?? '').trim()
    const price = parseAmount(row[4])

    if (!id || !name) continue
    // 메뉴 ID 패턴: 알파벳+숫자 (예: C00001, SCC011)
    if (!/^[A-Z]+\d+$/i.test(id)) continue

    result.push({
      id,
      name,
      price,
      is_active: status === 'Y',
    })
  }

  return NextResponse.json({ rows: result, filename: file.name })
}
