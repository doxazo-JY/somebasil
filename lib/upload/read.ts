import * as XLSX from 'xlsx'
// @ts-expect-error — xlsx-populate는 타입 정의 없음
import XlsxPopulate from 'xlsx-populate'

// 업로드 파일 → 엑셀 통합문서 (서버 전용)
// - PK(zip) = xlsx / D0 CF = 구형 .xls 또는 암호 걸린 xlsx(하나은행 파일) / < = HTML·XML로 저장된 엑셀
// - 암호가 걸려 있으면 하나은행 고정 암호로 먼저 풀어 봄

// 하나은행 다운로드 파일에 걸려 있는 고정 암호. 점장 생년월일 6자리. Vercel 환경변수 BANK_FILE_PASSWORD로 바꿀 수 있음
const BANK_FILE_PASSWORD = process.env.BANK_FILE_PASSWORD || '710320'

export class UploadError extends Error {}

export async function readWorkbook(buffer: ArrayBuffer): Promise<XLSX.WorkBook> {
  const bytes = new Uint8Array(buffer)
  const isCfb = bytes[0] === 0xd0 && bytes[1] === 0xcf
  const isText = bytes[0] === 0x3c || bytes[0] === 0xef // '<' 또는 UTF-8 BOM

  const attempts: (() => XLSX.WorkBook | Promise<XLSX.WorkBook>)[] = []
  if (isCfb) {
    // 암호 걸린 xlsx → 풀어서 읽기, 안 되면 그냥 .xls로 읽기
    attempts.push(async () => {
      const wb = await XlsxPopulate.fromDataAsync(Buffer.from(buffer), { password: BANK_FILE_PASSWORD })
      const decrypted: Buffer = await wb.outputAsync('nodebuffer')
      return XLSX.read(decrypted, { type: 'buffer', cellDates: true })
    })
    attempts.push(() => XLSX.read(bytes, { type: 'array', cellDates: true }))
  } else if (isText) {
    attempts.push(() => XLSX.read(new TextDecoder('utf-8').decode(bytes), { type: 'string', cellDates: true }))
    attempts.push(() => XLSX.read(new TextDecoder('euc-kr').decode(bytes), { type: 'string', cellDates: true }))
  } else {
    attempts.push(() => XLSX.read(bytes, { type: 'array', cellDates: true }))
  }

  let lastErr: unknown = null
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastErr = err
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  if (msg.includes('password')) {
    throw new UploadError('암호가 걸려 있어서 열 수 없어요. 엑셀에서 암호 없이 다시 저장한 뒤 올려 주세요.')
  }
  throw new UploadError('엑셀 파일을 읽을 수 없어요.')
}

// 시트를 배열 행으로 (raw=false면 엑셀에 보이는 글자 그대로)
export function sheetRows(wb: XLSX.WorkBook, name = wb.SheetNames[0], raw = false): unknown[][] {
  const sheet = wb.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw, defval: null })
}
