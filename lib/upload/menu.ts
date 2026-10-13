import type * as XLSX from 'xlsx'
import { sheetRows } from './read'

// POS 메뉴 목록 파일 → 메뉴 행
// 구조: 1행 매장명 / 2행 헤더 [빈, 상품ID, 사용, 명칭, 단가] / 3행부터 데이터. 사용 Y/N → is_active

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

export function isMenuWorkbook(wb: XLSX.WorkBook): boolean {
  const header = (sheetRows(wb).slice(0, 3).find((r) => r.some((c) => String(c ?? '').trim() === '상품ID')) ?? []).map((c) => String(c ?? '').trim())
  return ['상품ID', '사용', '명칭', '단가'].every((h) => header.includes(h))
}

export function parseMenu(wb: XLSX.WorkBook): MenuRow[] {
  const result: MenuRow[] = []
  for (const row of sheetRows(wb, wb.SheetNames[0], true).slice(2)) {
    if (!row) continue
    const id = String(row[1] ?? '').trim()
    const status = String(row[2] ?? '').trim().toUpperCase()
    const name = String(row[3] ?? '').trim()
    if (!id || !name) continue
    // 메뉴 ID 패턴: 알파벳+숫자 (예: C00001, SCC011)
    if (!/^[A-Z]+\d+$/i.test(id)) continue
    result.push({ id, name, price: parseAmount(row[4]), is_active: status === 'Y' })
  }
  return result
}
