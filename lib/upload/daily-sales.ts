import * as XLSX from 'xlsx'

// POS "일일매출 상세내역" 파일 → 상품 라인 + 파일이 담은 기간
// 1행 헤더 (판매번호 · No · 상품명 · 상태 · 주문 시간 · 수량 · 판매 금액 …), 열 순서는 이름으로 찾음
// 기간 = 파일명 "20260417 - 20260421 일일매출 상세내역.xls" (없으면 들어 있는 날짜 범위)

// POS 파일 파싱 결과 타입 (상품 라인 단위)
export interface DailySalesRow {
  date: string            // YYYY-MM-DD
  order_id: string        // 판매번호
  line_no: number         // 주문 내 상품 순번
  product_name: string
  category: string
  quantity: number
  amount: number          // 판매 금액 (할인 반영 후 실매출)
  order_time: string      // ISO 8601 타임스탬프
}

// 상품명 → 카테고리 매핑 (메뉴판 기준 9개 + etc)
// 카테고리: coffee, drip_coffee, dutch_coffee, beverage, dessert, season, matcha, ade, tea, etc
function mapProductToCategory(name: string): string {
  const n = name.trim()
  // 기타/조정 항목
  if (/할인|샷\s?추가|사이즈\s?업|디카페인\s?변경|연하게|미등록/.test(n)) return 'etc'
  // 디저트 (베이글/샌드위치 포함. 바스크 치즈케익(말차)도 dessert로 귀결)
  if (/케익|케이크|마들렌|티라미수|파이|스콘|쿠키|붕어빵|베이글|크로와상|구움과자|샌드위치/.test(n)) return 'dessert'
  // 시즌 메뉴 (봄 생딸기주스 등)
  if (/봄\s?딸기|생딸기|봄\s?생딸기/.test(n)) return 'season'
  // 말차 (말차 라떼/크림/세트 등 전부)
  if (/말차/.test(n)) return 'matcha'
  // 에이드 (tea 검사보다 먼저 — 도원결의 에이드 등)
  if (/에이드/.test(n)) return 'ade'
  // 티 (차)
  if (/TWG|밀크티|레이디\s?그레이|페퍼민트|캐모마일|얼그레이|블루오브런던|팔레데떼|블랙퍼스트|잉글리시|애플시나몬|오미자|도원결의|패션후르츠티|자몽티|레몬티|아이스티/.test(n)) return 'tea'
  // 더치커피 (원액)
  if (/원액|엑스트랙트/.test(n)) return 'dutch_coffee'
  // 드립커피 (핸드드립)
  if (/핸드드립/.test(n)) return 'drip_coffee'
  // 커피&슈페너
  if (/아메리카노|에스프레소|카페\s?라떼|카페모카|카라멜\s?마끼아또|카푸치노|슈페너|더치커피|더치라떼|드립백|바닐라빈\s?라떼|리얼\s?바닐라빈\s?라떼/.test(n)) return 'coffee'
  // 나머지 (아이스초코/핫초코/딸기라떼/리얼바닐라빈밀크/라우치 주스 등)
  return 'beverage'
}

// "2025/12/11 12:04" → { date: "2025-12-11", iso: "2025-12-11T12:04:00+09:00" }
function parseOrderTime(raw: unknown): { date: string; iso: string } | null {
  if (!raw) return null
  const str = String(raw).trim()
  const m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  const iso = `${date}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${(s ?? '00').padStart(2, '0')}+09:00`
  return { date, iso }
}

// POS 엑셀 헤더명 → 컬럼 인덱스. 열 순서가 바뀌어도 안 깨지도록 이름으로 찾는다.
const REQUIRED_COLUMNS = {
  orderId: '판매번호',
  lineNo: 'No',
  productName: '상품명',
  status: '상태',
  orderTime: '주문 시간',
  quantity: '수량',
  amount: '판매 금액',
} as const

function resolveColumnIndexes(headerRow: unknown[]): Record<keyof typeof REQUIRED_COLUMNS, number> {
  const indexes = {} as Record<keyof typeof REQUIRED_COLUMNS, number>
  const missing: string[] = []

  for (const [key, headerName] of Object.entries(REQUIRED_COLUMNS)) {
    const idx = headerRow.findIndex((h) => String(h ?? '').trim() === headerName)
    if (idx === -1) missing.push(headerName)
    indexes[key as keyof typeof REQUIRED_COLUMNS] = idx
  }

  if (missing.length > 0) {
    throw new Error(`POS 엑셀에서 다음 컬럼을 찾을 수 없습니다: ${missing.join(', ')}`)
  }

  return indexes
}

export function isDailySalesWorkbook(wb: XLSX.WorkBook): boolean {
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return false
  // 첫 행(헤더)만 읽음 — 큰 매출 파일 전체를 변환하지 않게
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  const header: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) header.push(String(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v ?? '').trim())
  return ['판매번호', '상품명', '주문 시간', '판매 금액'].every((h) => header.includes(h))
}

// 파일명 "YYYYMMDD - YYYYMMDD" 또는 "YYYYMMDD"
function periodFromName(name: string): { from: string; to: string } | null {
  const iso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  const range = name.match(/(20\d{6})\s*[-~]\s*(20\d{6})/)
  if (range) return { from: iso(range[1]), to: iso(range[2]) }
  const one = name.match(/(20\d{6})/)
  return one ? { from: iso(one[1]), to: iso(one[1]) } : null
}

export function parseDailySales(buffer: ArrayBuffer, fileName: string): { rows: DailySalesRow[]; from: string | null; to: string | null } {
  // 엑셀에 보이는 글자 그대로 읽음 (주문 시간 "2026/04/17 09:43")
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })
  if (rows.length === 0) throw new Error('엑셀에 데이터가 없어요')
  const col = resolveColumnIndexes(rows[0] as unknown[])

  const result: DailySalesRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !Array.isArray(r)) continue
    const productName = r[col.productName]
    const status = r[col.status]
    if (!productName || typeof productName !== 'string') continue
    // 취소만 제외 (반품은 음수로 저장되어 있어 그대로 반영 → 총액에서 자동 차감)
    if (status === '취소') continue
    const parsed = parseOrderTime(r[col.orderTime])
    if (!parsed) continue
    const amount = Number(String(r[col.amount] ?? '').replace(/,/g, ''))
    if (isNaN(amount) || amount === 0) continue
    result.push({
      date: parsed.date,
      order_id: String(r[col.orderId] ?? '').trim(),
      line_no: Number(r[col.lineNo]) || 0,
      product_name: productName.trim(),
      category: mapProductToCategory(productName),
      quantity: Number(String(r[col.quantity] ?? '').replace(/,/g, '')) || 0,
      amount,
      order_time: parsed.iso,
    })
  }

  const dates = result.map((r) => r.date).sort()
  const period = periodFromName(fileName) ?? (dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null)
  return { rows: result, from: period?.from ?? null, to: period?.to ?? null }
}
