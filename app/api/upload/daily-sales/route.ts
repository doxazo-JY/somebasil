import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// POS 파일 파싱 결과 타입 (상품 라인 단위)
export interface DailySalesRow {
  date: string            // YYYY-MM-DD
  order_id: string        // 판매번호
  line_no: number         // 주문 내 상품 순번
  product_name: string
  category: string
  quantity: number
  amount: number          // 합계 (할인 전)
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

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })

  // 컬럼: 4=판매번호 | 5=No | 8=상품명 | 9=상태 | 11=주문시간 | 13=수량 | 15=합계
  const result: DailySalesRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !Array.isArray(r)) continue

    const productName = r[8]
    const status = r[9]
    if (!productName || typeof productName !== 'string') continue
    // 취소만 제외 (반품은 음수로 저장되어 있어 그대로 반영 → 총액에서 자동 차감)
    if (status === '취소') continue

    const parsed = parseOrderTime(r[11])
    if (!parsed) continue

    const amount = Number(String(r[15] ?? '').replace(/,/g, ''))
    if (isNaN(amount) || amount === 0) continue

    const quantity = Number(String(r[13] ?? '').replace(/,/g, '')) || 0
    const orderId = String(r[4] ?? '').trim()
    const lineNo = Number(r[5]) || 0

    result.push({
      date: parsed.date,
      order_id: orderId,
      line_no: lineNo,
      product_name: productName.trim(),
      category: mapProductToCategory(productName),
      quantity,
      amount,
      order_time: parsed.iso,
    })
  }

  return NextResponse.json({ rows: result, filename: file.name })
}
