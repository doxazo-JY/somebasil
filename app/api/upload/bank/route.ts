import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
// @ts-expect-error — xlsx-populate는 타입 정의 없음
import XlsxPopulate from 'xlsx-populate'

// Node.js 런타임 강제 (xlsx-populate는 Buffer/Node crypto 사용)
export const runtime = 'nodejs'

// 하나은행 다운로드 파일에 걸려 있는 고정 암호. 점장 생년월일 6자리.
// 변경 필요 시 Vercel 환경변수 BANK_FILE_PASSWORD로 override 가능.
const BANK_FILE_PASSWORD = process.env.BANK_FILE_PASSWORD || '710320'

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
  return { category: 'ingredients_card', type: 'expense' }
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

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  let bytes = new Uint8Array(buffer)

  // 파일 시그니처 감지
  // - PK (50 4B) = 진짜 xlsx (zip)
  // - D0 CF 11 E0 = CFB (구형 .xls 또는 암호 걸린 modern xlsx — Excel은 암호 보호 시 OOXML을 CFB로 감쌈)
  // - < (3C) = HTML/XML
  const sig = bytes.slice(0, 4)
  const isCfb = sig[0] === 0xd0 && sig[1] === 0xcf
  const isText = sig[0] === 0x3c || sig[0] === 0xef /* UTF-8 BOM */

  let workbook: XLSX.WorkBook | null = null
  let lastErr: unknown = null
  let decryptedFromCfb = false

  // CFB면 먼저 암호 복호화 시도 (하나은행 다운로드 파일은 기본 암호 걸려 있음)
  if (isCfb) {
    try {
      const wb = await XlsxPopulate.fromDataAsync(Buffer.from(buffer), { password: BANK_FILE_PASSWORD })
      const decrypted = await wb.outputAsync('nodebuffer')
      bytes = new Uint8Array(decrypted) // SheetJS에 넘길 바이트 교체
      decryptedFromCfb = true
    } catch (err) {
      // 복호화 실패 — 암호 안 걸린 그냥 .xls일 수 있으므로 SheetJS에 그대로 시도
      lastErr = err
    }
  }

  const decryptedBuffer = decryptedFromCfb ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : buffer

  const attempts: Array<() => XLSX.WorkBook> = []
  if (decryptedFromCfb) {
    // 복호화된 zip(.xlsx) → array로 읽기
    attempts.push(() => XLSX.read(decryptedBuffer, { type: 'array', cellDates: true }))
  } else if (isCfb) {
    // 암호 안 걸린 구형 .xls
    attempts.push(() => XLSX.read(bytes, { type: 'array', cellDates: true }))
  } else if (isText) {
    const text = new TextDecoder('utf-8').decode(bytes)
    attempts.push(() => XLSX.read(text, { type: 'string', cellDates: true }))
    attempts.push(() => {
      const eucText = new TextDecoder('euc-kr').decode(bytes)
      return XLSX.read(eucText, { type: 'string', cellDates: true })
    })
  } else {
    // 진짜 xlsx (PK 시그니처) 또는 미상
    attempts.push(() => XLSX.read(buffer, { type: 'array', cellDates: true }))
    attempts.push(() => XLSX.read(bytes, { type: 'array', cellDates: true }))
  }

  for (const attempt of attempts) {
    try {
      workbook = attempt()
      break
    } catch (err) {
      lastErr = err
    }
  }

  if (!workbook) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
    const sigHex = Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join(' ')
    console.error('[bank-upload] XLSX.read 실패', { name: file.name, size: file.size, sig: sigHex, msg })

    // 암호 걸린 파일 — 점장이 알아볼 수 있는 메시지로
    if (msg.includes('password')) {
      return NextResponse.json(
        {
          error:
            '🔒 암호가 걸린 파일입니다. 하나은행에서 다운받을 때 "암호 설정"을 해제하거나, ' +
            '엑셀에서 파일 열고 "다른 이름으로 저장 → .xlsx" 형식으로 암호 없이 저장한 뒤 다시 올려주세요.',
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: `엑셀 파일 형식을 읽을 수 없습니다. 하나은행 PC 사이트에서 직접 다운받은 .xlsx 파일인지 확인해주세요. (file: ${file.name}, ${file.size}B, sig: ${sigHex}, ${msg})`,
      },
      { status: 400 },
    )
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) {
    return NextResponse.json(
      { error: `엑셀에 시트가 없습니다. (sheets: ${workbook.SheetNames.join(',') || '(없음)'})` },
      { status: 400 },
    )
  }

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

    const tx_time = parseTxTime(row[0])
    if (!tx_time) continue // 거래일시 파싱 실패 시 스킵 (dedup key 필수)

    const memo = String(row[1] ?? '')
    const counterpart = String(row[2] ?? '')
    const income = parseAmount(row[3])
    const expense = parseAmount(row[4])
    const balance_after = parseAmount(row[5]) ?? 0

    // 0원 거래 스킵 (입금/출금 모두 0 또는 null)
    const hasIncome = income != null && income > 0
    const hasExpense = expense != null && expense > 0
    if (!hasIncome && !hasExpense) continue

    const { category, type } = classifyRow(memo, counterpart, hasIncome)

    result.push({
      date,
      tx_time,
      balance_after,
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
