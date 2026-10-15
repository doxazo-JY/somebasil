import type * as XLSX from 'xlsx'
import { sheetRows } from './read'

// POS 메뉴 목록 파일 → 메뉴 행 — 열 이름으로 읽음 (POS에서 받는 화면에 따라 형식이 2가지)
//   예전 형식 (4/25): 1행 매장명 / 2행 헤더 [빈, 상품ID, 사용, 명칭, 단가]
//   새 형식 (10월):   1행 헤더 [빈, ID, 상품명, 사용, 순서, 상품 소분류, 판매 단가, …60여 열]
//   [공백] 칸·옵션(소분류 "옵션하위")은 메뉴가 아니라서 뺌

export interface MenuRow {
  id: string
  name: string
  price: number
  is_active: boolean // 파일의 "사용" Y/N — 저장할 때 이미 있는 메뉴는 정리해 둔 값을 유지 (saveMenu)
}

function parseAmount(val: unknown): number {
  if (val == null || val === '') return 0
  const str = String(val).replace(/,/g, '').trim()
  const num = Number(str)
  return isNaN(num) ? 0 : Math.round(num)
}

// 헤더 행 찾기 → 열 위치 (예전/새 형식 공통)
function findColumns(wb: XLSX.WorkBook) {
  const rows = sheetRows(wb)
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const h = (rows[i] ?? []).map((c) => String(c ?? '').trim())
    const col = (...names: string[]) => names.map((n) => h.indexOf(n)).find((x) => x >= 0) ?? -1
    const cols = { id: col('상품ID', 'ID'), name: col('명칭', '상품명'), use: col('사용'), price: col('단가', '판매 단가'), group: col('상품 소분류') }
    if (cols.id >= 0 && cols.name >= 0 && cols.use >= 0 && cols.price >= 0) return { headerRow: i, ...cols }
  }
  return null
}

export function isMenuWorkbook(wb: XLSX.WorkBook): boolean {
  return findColumns(wb) != null
}

export function parseMenu(wb: XLSX.WorkBook): MenuRow[] {
  const c = findColumns(wb)
  if (!c) return []
  const result: MenuRow[] = []
  for (const row of sheetRows(wb, wb.SheetNames[0], true).slice(c.headerRow + 1)) {
    if (!row) continue
    const id = String(row[c.id] ?? '').trim()
    const name = String(row[c.name] ?? '').trim()
    // 메뉴 ID 패턴: 알파벳+숫자 (예: C00001, SCC011)
    if (!id || !/^[A-Z]+\d+$/i.test(id)) continue
    // 빈 칸·옵션은 메뉴가 아님
    if (!name || /^\[?공백\]?$/.test(name)) continue
    if (c.group >= 0 && String(row[c.group] ?? '').trim() === '옵션하위') continue
    result.push({ id, name, price: parseAmount(row[c.price]), is_active: String(row[c.use] ?? '').trim().toUpperCase() === 'Y' })
  }
  return result
}
