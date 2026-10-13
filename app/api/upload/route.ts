import { NextRequest, NextResponse } from 'next/server'
import type * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase/server'
import { readWorkbook, UploadError } from '@/lib/upload/read'
import { isDailySalesWorkbook, parseDailySales } from '@/lib/upload/daily-sales'
import { isBankWorkbook, parseBank } from '@/lib/upload/bank'
import { isMenuWorkbook, parseMenu } from '@/lib/upload/menu'
import { isRecipeWorkbook, saveRecipeWorkbook } from '@/lib/upload/recipe'
import { saveBank, saveDailySales, saveMenu, type UncertainTx } from '@/lib/upload/save'
import { parseWorklog } from '@/lib/worklog-parser'
import { saveWorklog } from '@/lib/supabase/worklog-save'

// 통합 업로드 — 파일 하나를 받아 내용으로 종류를 알아보고 바로 저장 (미리보기·저장 버튼 없음)
//   POS 일일매출 / 하나은행 통장 / POS 메뉴 목록 / 근무일지 / 레시피 양식
// 같은 파일을 다시 넣어도 중복되지 않음 (lib/upload/save.ts). 여러 파일은 화면에서 하나씩 보내고,
// 다 끝나면 /api/upload/finish 로 체크리스트·AI 분석 판단
export const maxDuration = 120

export type UploadKind = 'daily_sales' | 'bank_transaction' | 'menu' | 'work_logs' | 'recipe'

export type UploadResult = {
  kind: UploadKind
  label: string // 화면 표시 이름
  summary: string // "10/5~10/11 · 1,234줄 저장"
  from: string | null
  to: string | null
  uncertain?: UncertainTx[] // 통장: 분류가 애매한 새 출금
  warnings?: string[] // 근무일지: 엑셀 합계와 계산이 다른 곳 등
}

const LABEL: Record<UploadKind, string> = {
  daily_sales: 'POS 매출',
  bank_transaction: '통장',
  menu: 'POS 메뉴',
  work_logs: '근무일지',
  recipe: '레시피 양식',
}

const isWorklog = (wb: XLSX.WorkBook) => wb.SheetNames.some((n) => /\d{2,4}\s*년\s*\d{1,2}\s*월/.test(n))

function detect(wb: XLSX.WorkBook): UploadKind | null {
  if (isRecipeWorkbook(wb)) return 'recipe'
  if (isBankWorkbook(wb)) return 'bank_transaction'
  if (isDailySalesWorkbook(wb)) return 'daily_sales'
  if (isMenuWorkbook(wb)) return 'menu'
  if (isWorklog(wb)) return 'work_logs'
  return null
}

const md = (d: string | null) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')
const span = (from: string | null, to: string | null) => (from && to ? (from === to ? md(from) : `${md(from)}~${md(to)}`) : '')

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없어요' }, { status: 400 })

  try {
    const buffer = await file.arrayBuffer()
    const wb = await readWorkbook(buffer)
    const kind = detect(wb)
    if (!kind) throw new UploadError('어떤 파일인지 알아보지 못했어요 (POS 매출·통장·메뉴·근무일지·레시피 양식만 받아요)')

    let result: UploadResult
    if (kind === 'daily_sales') {
      const { rows, from, to } = parseDailySales(buffer, file.name)
      if (rows.length === 0) throw new UploadError('매출 줄을 찾지 못했어요')
      await saveDailySales(rows)
      result = { kind, label: LABEL[kind], from, to, summary: `${span(from, to)} · ${rows.length.toLocaleString()}줄` }
    } else if (kind === 'bank_transaction') {
      const { rows, from, to } = parseBank(wb)
      const saved = await saveBank(rows)
      result = {
        kind, label: LABEL[kind], from, to,
        summary: `${span(from, to)} · 입금 ${saved.incomes}건 · 새 출금 ${saved.newExpenses}건`,
        uncertain: saved.uncertain,
      }
    } else if (kind === 'menu') {
      const rows = parseMenu(wb)
      await saveMenu(rows)
      result = { kind, label: LABEL[kind], from: null, to: null, summary: `메뉴 ${rows.length}개 (판매 중 ${rows.filter((r) => r.is_active).length}개)` }
    } else if (kind === 'work_logs') {
      const parsed = parseWorklog(buffer)
      if (parsed.shifts.length === 0) throw new UploadError('근무 기록을 찾지 못했어요. 시트 이름이 "26년 8월"처럼 되어 있는지 확인해 주세요')
      const saved = await saveWorklog(createServerClient(), parsed.shifts, parsed.staff, parsed.months, parsed.payrollItems)
      const months = parsed.months.map((m) => `${Number(m.slice(5))}월`)
      result = {
        kind, label: LABEL[kind], from: null, to: null,
        summary: `${months.length > 2 ? `${months[0]}~${months.at(-1)}` : months.join('·')} · 근무 ${saved.savedShifts}건${saved.createdStaff.length ? ` · 새 직원 ${saved.createdStaff.join(', ')}` : ''}`,
        warnings: parsed.warnings,
      }
    } else {
      const s = await saveRecipeWorkbook(buffer)
      result = { kind, label: LABEL[kind], from: null, to: null, summary: `재료 ${s.ingredientCount}개 · 수제 배합 ${s.subRecipeCount}개 · 메뉴 레시피 ${s.recipeMenuCount}개` }
    }

    const supabase = createServerClient()
    const history = { file_name: file.name, file_type: kind, status: 'success' }
    // 기간 칸(20261016_upload_period.sql)이 아직 없으면 기간 없이 기록
    const { error } = await supabase.from('upload_history').insert({ ...history, period_start: result.from, period_end: result.to })
    if (error) await supabase.from('upload_history').insert(history)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/upload]', file.name, err)
    const msg = err instanceof UploadError ? err.message : `저장하지 못했어요 (${err instanceof Error ? err.message : String(err)})`
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
