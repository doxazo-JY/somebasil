import { NextRequest, NextResponse } from 'next/server'
// @ts-expect-error — xlsx-populate는 타입 정의 없음
import XlsxPopulate from 'xlsx-populate'
import {
  buildTimesheet,
  firstTimesheetMonth,
  getPayRates,
  getSourcePriority,
  type Timesheet,
  type TimesheetBlock,
} from '@/lib/supabase/queries/attendance-admin'
import { fmtTime, fmtWorkDate, isSunday } from '@/lib/attendance/format'

// xlsx-populate는 Node 전용
export const runtime = 'nodejs'

// 점장(관리 화면): 근무일지 엑셀 — 세무사 전달용. 관리 화면 로그인 대상
// 지금 쓰는 파일처럼 누적: 기록이 있는 첫 달 ~ 선택한 달, 월마다 시트 하나 ("26년 10월")
// 시트 구조 = "썸바실 YY년 M월 P.T. 근무일지": 평일 근무 블록 → 주일 근무 블록 → M월분 총 인건비(세전)
// 날짜별 출처: 기준 기록(종이 우선/QR 우선)으로 직원·날짜마다 한쪽 (buildTimesheet · mergeShifts 참고)
// 계산은 값으로 넣음 (수식 아님 — 미리보기/모바일에서도 숫자가 보이도록)

const KIND_LABEL = { fixed_salary: '고정급', weekly_holiday_pay: '주휴수당', other: '기타' } as const

// 'HH:MM' → 엑셀 시각(하루 비율)
function excelTime(iso: string): number {
  const [h, m] = fmtTime(iso).split(':').map(Number)
  return (h * 60 + m) / 1440
}

type Range = { merged: (v: boolean) => Range; style: (s: object) => Range }
type Sheet = {
  cell: (r: number, c: number) => Cell
  range: (r1: number, c1: number, r2: number, c2: number) => Range
  column: (c: number) => { width: (w: number) => unknown }
  name: (n: string) => unknown
}
type Cell = { value: (v: unknown) => Cell; style: (s: object | string, v?: unknown) => Cell }

const BORDER = { border: true, borderColor: 'BBBBBB' }
const HEAD = { ...BORDER, bold: true, horizontalAlignment: 'center', verticalAlignment: 'center', fill: 'EEF3EF' }
const BODY = { ...BORDER, horizontalAlignment: 'center' }

// 블록 하나(평일 또는 주일) 쓰기 → 다음 빈 행 번호
function writeBlock(sh: Sheet, startRow: number, title: string, hourly: number | null, block: TimesheetBlock, dates: string[], sundayBlock: boolean) {
  let r = startRow
  const lastCol = Math.max(1 + block.staff.length * 3, 4)

  sh.cell(r, 1).value(title).style({ bold: true, fontSize: 12 })
  sh.cell(r, lastCol - 1).value(sundayBlock ? '주일 시급' : '평일 시급').style({ bold: true, horizontalAlignment: 'right' })
  sh.cell(r, lastCol).value(hourly ?? '미등록').style({ numberFormat: '#,##0' })
  r++

  // 이름 행
  sh.range(r, 1, r + 1, 1).merged(true).style(HEAD)
  sh.cell(r, 1).value('날짜')
  block.staff.forEach((s, i) => {
    const c = 2 + i * 3
    sh.range(r, c, r, c + 2).merged(true).style(HEAD)
    sh.cell(r, c).value(s.name)
    ;['출근', '퇴근', '근무시간'].forEach((h, j) => sh.cell(r + 1, c + j).value(h).style(HEAD))
  })
  r += 2

  if (block.staff.length === 0) {
    sh.cell(r, 1).value('기록 없음').style({ fontColor: '999999' })
    return r + 2
  }

  // 날짜 행
  for (const date of dates) {
    const offDay = sundayBlock !== isSunday(date)
    sh.cell(r, 1).value(fmtWorkDate(date)).style({ ...BODY, horizontalAlignment: 'left', fontColor: offDay ? 'BBBBBB' : '333333' })
    block.staff.forEach((s, i) => {
      const c = 2 + i * 3
      const day = block.days[s.id]?.[date]
      const cells = [sh.cell(r, c), sh.cell(r, c + 1), sh.cell(r, c + 2)]
      cells.forEach((cell) => cell.style(BODY))
      if (!day) return
      cells[0].value(excelTime(day.clock_in)).style('numberFormat', 'hh:mm')
      if (day.clock_out && !day.open) cells[1].value(excelTime(day.clock_out)).style('numberFormat', 'hh:mm')
      else cells[1].value('누락').style({ fontColor: 'C0392B', bold: true })
      cells[2].value(Math.round((day.minutes / 60) * 100) / 100).style('numberFormat', '0.00')
    })
    r++
  }

  // 합계 행
  block.staff.forEach((_, i) => {
    const c = 2 + i * 3
    ;['근무일수', '지급액', '근무시간'].forEach((h, j) => sh.cell(r, c + j).value(h).style(HEAD))
  })
  sh.cell(r, 1).value('합계').style(HEAD)
  r++
  block.staff.forEach((s, i) => {
    const c = 2 + i * 3
    const t = block.totals[s.id]
    sh.cell(r, c).value(t.days).style(BODY)
    sh.cell(r, c + 1).value(t.pay).style({ ...BODY, numberFormat: '#,##0' })
    sh.cell(r, c + 2).value(Math.round((t.minutes / 60) * 100) / 100).style({ ...BODY, numberFormat: '0.00' })
  })
  sh.cell(r, 1).style(BODY)
  r++
  sh.cell(r, 1).value('지급액 합계').style({ bold: true })
  sh.cell(r, 2).value(block.pay).style({ bold: true, numberFormat: '#,##0' })
  return r + 2
}

// 한 달 = 시트 하나
function writeMonthSheet(sh: Sheet, ts: Timesheet) {
  const { year, month } = ts
  sh.name(`${String(year).slice(2)}년 ${month}월`)
  sh.cell(1, 1).value(`썸바실 ${String(year).slice(2)}년 ${month}월 P.T. 근무일지`).style({ bold: true, fontSize: 14 })
  if (ts.openCount > 0) {
    sh.cell(2, 1).value(`※ 퇴근 기록이 없는 근무 ${ts.openCount}건은 근무시간에서 빠져 있습니다 (관리 화면에서 수정 후 다시 내려받기)`).style({ fontColor: 'C0392B' })
  }

  let r = 4
  r = writeBlock(sh, r, '평일 근무', ts.rates.weekday, ts.weekday, ts.dates, false)
  r = writeBlock(sh, r, '주일 근무', ts.rates.sunday, ts.sunday, ts.dates, true)

  // 인건비 요약
  sh.cell(r, 1).value(`${month}월분 총 인건비(세전)`).style({ bold: true, fontSize: 12 })
  r++
  const lines: [string, number][] = [
    ['주간', ts.weekday.pay],
    ['주일', ts.sunday.pay],
    ...ts.payrollItems.map((i) => [`${i.label} (${KIND_LABEL[i.kind]})`, i.amount] as [string, number]),
  ]
  for (const [label, amount] of lines) {
    sh.cell(r, 1).value(label).style(BODY)
    sh.cell(r, 2).value(amount).style({ ...BODY, numberFormat: '#,##0', horizontalAlignment: 'right' })
    r++
  }
  sh.cell(r, 1).value('합계').style(HEAD)
  sh.cell(r, 2).value(ts.total).style({ ...HEAD, numberFormat: '#,##0', horizontalAlignment: 'right' })

  const staffCols = Math.max(ts.weekday.staff.length, ts.sunday.staff.length) * 3 + 1
  sh.column(1).width(14)
  for (let c = 2; c <= Math.max(staffCols, 4); c++) sh.column(c).width(10)
}

export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get('year'))
  const month = Number(req.nextUrl.searchParams.get('month'))
  if (!Number.isInteger(year) || !(month >= 1 && month <= 12)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    // 첫 달 ~ 선택한 달
    const first = (await firstTimesheetMonth()) ?? { year, month }
    const months: { year: number; month: number }[] = []
    for (let y = first.year, m = first.month; y < year || (y === year && m <= month); m === 12 ? (y++, (m = 1)) : m++) {
      months.push({ year: y, month: m })
    }
    if (months.length === 0) months.push({ year, month })

    const [rates, priority] = await Promise.all([getPayRates(), getSourcePriority()])
    const sheets: Timesheet[] = []
    for (const m of months) sheets.push(await buildTimesheet(m.year, m.month, { rates, priority }))

    const wb = await XlsxPopulate.fromBlankAsync()
    sheets.forEach((ts, i) => {
      const sh: Sheet = i === 0 ? wb.sheet(0) : wb.addSheet(`${String(ts.year).slice(2)}년 ${ts.month}월`)
      writeMonthSheet(sh, ts)
    })
    // 열었을 때 선택한 달 시트가 보이도록
    wb.activeSheet(wb.sheet(sheets.length - 1))

    const buf: Buffer = await wb.outputAsync()
    const filename = `썸바실_근무일지_~${year}-${String(month).padStart(2, '0')}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (error) {
    console.error('[GET /api/attendance/export] error:', error)
    return NextResponse.json({ error: 'export_failed' }, { status: 500 })
  }
}
