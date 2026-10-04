import * as XLSX from 'xlsx'

// 근무일지 엑셀 파서 (점장 작성 양식 — "썸바실 YY년 M월 P.T. 근무일지")
// 시트 = 한 달. 시트 안에 블록 2개:
//   1) 평일 블록 — "이름" 행 + "시간/휴게" 헤더 + "출근/퇴근/실근무시간" + 날짜 행(M/D)
//   2) "주일 근무" 블록 — 같은 구조, 시급 1.5배 (일요일·공휴일)
// 직원 1명당 4칸: 출근 | 퇴근 | 실근무시간 | 휴게
// 시급 = "최저시급" 셀 바로 아래 셀
// 검증: 블록마다 직원별 "총 지급액" 행이 있어서 계산값과 대조 → 다르면 경고 (양식 변경 감지용)

export interface WorkShift {
  name: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
  hours: number
  rate: number
  /** 주일(1.5배) 블록에서 나온 근무 */
  sunday: boolean
}

export interface WorklogStaff {
  name: string
  weekdayRate: number | null
  sundayRate: number | null
  firstDate: string
  lastDate: string
}

export interface WorklogParseResult {
  shifts: WorkShift[]
  staff: WorklogStaff[]
  /** 'YYYY-MM' 오름차순 */
  months: string[]
  warnings: string[]
}

type Cell = string | null

function cellText(v: unknown): string {
  return v == null ? '' : String(v).replace(/\s+/g, ' ').trim()
}

function parseRate(v: unknown): number | null {
  const n = Number(cellText(v).replace(/[^\d.]/g, ''))
  return n > 0 ? Math.round(n) : null
}

// "9:05" / "09:05" / "9:05:00" → 분
function parseTime(v: unknown): number | null {
  const m = cellText(v).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

function fmtTime(mins: number) {
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// 블록 시작("이름" 행) 근처에서 "최저시급" 아래 셀을 찾음
function findRate(rows: Cell[][], nameRowIdx: number): number | null {
  for (let r = Math.max(0, nameRowIdx - 2); r <= nameRowIdx + 1 && r < rows.length; r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < row.length; c++) {
      if (cellText(row[c]) === '최저시급') return parseRate(rows[r + 1]?.[c])
    }
  }
  return null
}

export function parseWorklog(buffer: ArrayBuffer): WorklogParseResult {
  return parseWorklogBook(XLSX.read(buffer, { type: 'array' }))
}

export function parseWorklogBook(wb: XLSX.WorkBook): WorklogParseResult {
  const shifts: WorkShift[] = []
  const warnings: string[] = []

  for (const sheetName of wb.SheetNames) {
    const ym = sheetName.match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월/)
    if (!ym) continue
    const year = Number(ym[1]) < 100 ? 2000 + Number(ym[1]) : Number(ym[1])

    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: null,
    })

    // 블록 상태
    let people: { col: number; name: string }[] = []
    let rate: number | null = null
    let sunday = false
    // 블록 내 직원별 계산 지급액 (엑셀 "총 지급액"과 대조용)
    let blockPay = new Map<string, number>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? []
      const first = cellText(row[0])

      if (first === '이름') {
        // 주일 블록 여부 — 바로 위 2행에 "주일" 표기
        sunday = [rows[i - 1], rows[i - 2]].some((r) => (r ?? []).some((c) => cellText(c).includes('주일')))
        rate = findRate(rows, i)
        // 직원 열 = 다음 행 헤더의 "시간" 위치
        const header = rows[i + 1] ?? []
        const cols = header.map((c, idx) => (cellText(c) === '시간' ? idx : -1)).filter((idx) => idx > 0)
        people = cols
          .map((col) => ({ col, name: cellText(row[col]) }))
          .filter((p) => p.name && !/^[\d,₩.]+$/.test(p.name))
        if (rate === null) warnings.push(`${sheetName}: ${sunday ? '주일' : '평일'} 블록 시급을 찾지 못함`)
        blockPay = new Map()
        continue
      }

      // 블록 끝 "총 지급액" 헤더 → 다음 행 값과 계산값 대조
      if (people.length > 0 && row.some((c) => cellText(c).includes('지급액'))) {
        const totals = rows[i + 1] ?? []
        for (const p of people) {
          const payCol = [p.col, p.col + 1, p.col + 2, p.col + 3].find((c) => cellText(row[c]).includes('지급액'))
          if (payCol === undefined) continue
          const sheetPay = parseRate(totals[payCol]) ?? 0
          const calcPay = Math.round(blockPay.get(p.name) ?? 0)
          // 근무시간 반올림 오차 허용 (1,000원 또는 1%)
          if (Math.abs(sheetPay - calcPay) > Math.max(1000, sheetPay * 0.01)) {
            warnings.push(
              `${sheetName} ${sunday ? '주일' : '평일'} ${p.name}: 엑셀 지급액 ${sheetPay.toLocaleString()}원 ≠ 계산 ${calcPay.toLocaleString()}원`,
            )
          }
        }
        people = []
        continue
      }

      const dm = first.match(/^(\d{1,2})\/(\d{1,2})$/)
      if (!dm || people.length === 0) continue
      const date = `${year}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}`

      for (const p of people) {
        const start = parseTime(row[p.col])
        const end = parseTime(row[p.col + 1])
        if (start === null && end === null) continue
        if (start === null || end === null) {
          warnings.push(`${sheetName} ${first} ${p.name}: 출근/퇴근 중 하나만 있음 — 건너뜀`)
          continue
        }
        let mins = end - start
        if (mins <= 0) mins += 24 * 60 // 자정 넘김
        blockPay.set(p.name, (blockPay.get(p.name) ?? 0) + (mins / 60) * (rate ?? 0))
        shifts.push({
          name: p.name,
          date,
          start: fmtTime(start),
          end: fmtTime(end),
          hours: Math.round((mins / 60) * 100) / 100,
          rate: rate ?? 0,
          sunday,
        })
      }
    }
  }

  // 직원 요약 — 시급은 가장 최근 근무 기준
  const byName = new Map<string, WorklogStaff>()
  for (const s of [...shifts].sort((a, b) => a.date.localeCompare(b.date))) {
    const cur = byName.get(s.name) ?? {
      name: s.name,
      weekdayRate: null,
      sundayRate: null,
      firstDate: s.date,
      lastDate: s.date,
    }
    cur.lastDate = s.date
    if (s.rate > 0) {
      if (s.sunday) cur.sundayRate = s.rate
      else cur.weekdayRate = s.rate
    }
    byName.set(s.name, cur)
  }

  const months = [...new Set(shifts.map((s) => s.date.slice(0, 7)))].sort()
  return { shifts, staff: [...byName.values()], months, warnings }
}
