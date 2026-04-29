'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FileDropZone from './FileDropZone'
import PreviewTable, { type PreviewRow } from './PreviewTable'
import MenuPreviewTable from './MenuPreviewTable'
import type { BankRow } from '@/app/api/upload/bank/route'
import type { DailySalesRow } from '@/app/api/upload/daily-sales/route'
import type { MenuRow } from '@/app/api/upload/menu/route'

type Tab = 'daily' | 'bank' | 'menu' | 'recipe'

type DailyPreview = { type: 'daily'; rows: DailySalesRow[] }
type BankPreview = { type: 'bank'; rows: PreviewRow[]; originals: BankRow[] }
type MenuPreview = { type: 'menu'; rows: MenuRow[] }
type PreviewState = DailyPreview | BankPreview | MenuPreview

interface RecipeUploadStats {
  ingredientCount: number
  pricedCount: number
  subRecipeCount: number
  subRecipeItemCount: number
  recipeMenuCount: number
  recipeItemCount: number
  packagingSetCount: number
}

// fetch 응답이 JSON이 아닐 때(서버 502/504 HTML 페이지 등) 안전하게 파싱
async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function bankRowToPreview(row: BankRow): PreviewRow {
  return {
    date: row.date,
    memo: row.memo,
    amount: row.type === 'income' ? (row.income ?? 0) : (row.expense ?? 0),
    category: row.category,
    type: row.type,
  }
}

interface UploadSectionProps {
  /** 통장 탭에서만 노출할 추가 컨텐츠 (재분류 테이블 등) */
  bankExtras?: React.ReactNode
  /** 메뉴 마스터 탭에서만 노출할 추가 컨텐츠 (마스터 관리 등) */
  menuExtras?: React.ReactNode
}

export default function UploadSection({ bankExtras, menuExtras }: UploadSectionProps = {}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('daily')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [recipeStats, setRecipeStats] = useState<RecipeUploadStats | null>(null)
  const [filename, setFilename] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setPreview(null)
    setRecipeStats(null)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // 레시피 탭: 파싱 + 저장이 한 번에 (파일 크고 시트 4개라 미리보기 생략)
      if (tab === 'recipe') {
        const res = await fetch('/api/upload/recipe', { method: 'POST', body: formData })
        const json = await safeJson(res)
        if (!res.ok) {
          setMessage({ text: json?.error ?? `업로드 실패 (${res.status})`, ok: false })
          return
        }
        setRecipeStats(json.stats as RecipeUploadStats)
        setMessage({ text: '저장 완료! 메뉴 원가 페이지에서 확인하세요.', ok: true })
        router.refresh()
        return
      }

      const endpointMap = {
        daily: '/api/upload/daily-sales',
        bank: '/api/upload/bank',
        menu: '/api/upload/menu',
      } as const
      const res = await fetch(endpointMap[tab], { method: 'POST', body: formData })
      const json = await safeJson(res)

      if (!res.ok) {
        setMessage({ text: json?.error ?? `파싱 실패 (${res.status})`, ok: false })
        return
      }

      setFilename(json.filename)

      if (tab === 'daily') {
        setPreview({ type: 'daily', rows: json.rows as DailySalesRow[] })
      } else if (tab === 'bank') {
        const originals = json.rows as BankRow[]
        setPreview({
          type: 'bank',
          rows: originals.map(bankRowToPreview),
          originals,
        })
      } else if (tab === 'menu') {
        setPreview({ type: 'menu', rows: json.rows as MenuRow[] })
      }
    } catch (err) {
      // 네트워크 끊김 / 타임아웃 / JSON 파싱 실패 — 모바일에서 흔함
      console.error('[upload]', err)
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      setMessage({ text: `업로드 실패: ${msg} (네트워크 확인 후 재시도)`, ok: false })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveMenu(rows: MenuRow[]) {
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/upload/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'menu', rows, filename }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setMessage({ text: json.error ?? '저장 실패', ok: false })
    } else {
      setMessage({ text: `저장 완료! ${rows.length}개 메뉴 반영됨.`, ok: true })
      setPreview(null)
      router.refresh()
    }
  }

  async function handleSaveDaily(rows: DailySalesRow[]) {
    setSaving(true)
    setMessage(null)

    const res = await fetch('/api/upload/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'daily_sales', rows, filename }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setMessage({ text: json.error ?? '저장 실패', ok: false })
    } else {
      setMessage({ text: '저장 완료!', ok: true })
      setPreview(null)
      router.refresh()
    }
  }

  async function handleSaveBank(rows: PreviewRow[], originals: BankRow[]) {
    setSaving(true)
    setMessage(null)

    // PreviewRow의 수정된 category를 originals에 병합 (tx_time / balance_after 보존)
    const payload = originals.map((orig, i) => ({
      date: orig.date,
      tx_time: orig.tx_time,
      balance_after: orig.balance_after,
      memo: orig.memo,
      counterpart: orig.counterpart, // 거래처별 누적 매칭용
      income: orig.income,
      expense: orig.expense,
      category: rows[i]?.category ?? orig.category,
      type: orig.type,
    }))

    const res = await fetch('/api/upload/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bank_transaction', rows: payload, filename }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setMessage({ text: json.error ?? '저장 실패', ok: false })
    } else {
      setMessage({ text: '저장 완료!', ok: true })
      setPreview(null)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 — 모바일은 짧은 라벨, 데스크탑은 풀 라벨 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit max-w-full">
        {(['daily', 'bank', 'menu', 'recipe'] as Tab[]).map((t) => {
          const short =
            t === 'daily' ? '일별' : t === 'bank' ? '통장' : t === 'menu' ? '메뉴' : '레시피'
          const full =
            t === 'daily'
              ? '📋 일별 매출'
              : t === 'bank'
                ? '🏦 통장 거래내역'
                : t === 'menu'
                  ? '🍽️ 메뉴 마스터'
                  : '🥄 레시피·원가'
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setPreview(null); setRecipeStats(null); setMessage(null) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{full}</span>
            </button>
          )
        })}
      </div>

      {/* 파일 업로드 */}
      <FileDropZone
        accept=".xlsx,.xls"
        hint={
          tab === 'daily'
            ? 'POS 일일매출 엑셀 파일 (기간·단일 모두 가능)'
            : tab === 'bank'
              ? '하나은행 거래내역 엑셀 파일'
              : tab === 'menu'
                ? 'POS 메뉴 마스터 엑셀 (5컬럼: ID·Y/N·명칭·단가)'
                : '레시피 템플릿 엑셀 v5 (4시트: 재료·서브레시피·레시피·포장세트). 부분 입력 OK'
        }
        onFile={handleFile}
        loading={loading}
      />

      {/* 메시지 */}
      {message && (
        <p className={`text-sm ${message.ok ? 'text-[#1a5c3a]' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      {/* 미리보기 */}
      {preview?.type === 'daily' && (
        <DailySalesSummary
          rows={preview.rows}
          saving={saving}
          onSave={() => handleSaveDaily(preview.rows)}
        />
      )}
      {preview?.type === 'bank' && (
        <PreviewTable
          rows={preview.rows}
          onSave={(edited) => handleSaveBank(edited, preview.originals)}
          saving={saving}
        />
      )}
      {preview?.type === 'menu' && (
        <MenuPreviewTable
          rows={preview.rows}
          saving={saving}
          onSave={() => handleSaveMenu(preview.rows)}
        />
      )}

      {recipeStats && <RecipeUploadResult stats={recipeStats} />}

      {/* 통장 탭 전용 추가 컨텐츠 (재분류 테이블 등) */}
      {tab === 'bank' && bankExtras && <div className="mt-4">{bankExtras}</div>}
      {/* 메뉴 탭 전용 추가 컨텐츠 (마스터 관리 등) */}
      {tab === 'menu' && menuExtras && <div className="mt-4">{menuExtras}</div>}
    </div>
  )
}

// 레시피 업로드 결과 — 시트별 카운트
function RecipeUploadResult({ stats }: { stats: RecipeUploadStats }) {
  const items = [
    { label: '재료', value: `${stats.ingredientCount}개 (단가 ${stats.pricedCount})` },
    { label: '서브레시피', value: `${stats.subRecipeCount}종 / 구성 ${stats.subRecipeItemCount}` },
    { label: '메뉴 레시피', value: `${stats.recipeMenuCount}메뉴 / 라인 ${stats.recipeItemCount}` },
    { label: '포장세트', value: `${stats.packagingSetCount}세트` },
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">반영 결과</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label} className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-0.5">{it.label}</p>
            <p className="text-sm text-gray-800 font-semibold">{it.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4 [word-break:keep-all]">
        부분 입력 시 단가/레시피 누락은 ‘원가 미등록’ 으로 표시됩니다. 추후 같은 양식 재업로드로 갱신 가능.
      </p>
    </div>
  )
}

// POS 업로드 요약 카드 (라인별 편집은 비효율)
function DailySalesSummary({
  rows,
  saving,
  onSave,
}: {
  rows: DailySalesRow[]
  saving: boolean
  onSave: () => void
}) {
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
  const orderIds = new Set(rows.map((r) => `${r.date}|${r.order_id}`))
  const dates = new Set(rows.map((r) => r.date))
  const categoryTotals: Record<string, number> = {}
  for (const r of rows) {
    categoryTotals[r.category] = (categoryTotals[r.category] ?? 0) + r.amount
  }
  const dateList = [...dates].sort()
  const dateRange = dateList.length > 0 ? `${dateList[0]} ~ ${dateList[dateList.length - 1]}` : '-'

  const CATEGORY_LABEL: Record<string, string> = {
    coffee: '커피&슈페너',
    drip_coffee: '드립커피',
    dutch_coffee: '더치커피',
    matcha: '말차',
    ade: '에이드',
    tea: '티',
    beverage: '음료',
    dessert: '디저트',
    season: '시즌',
    etc: '기타',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">파싱 결과</p>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="기간" value={dateRange} small />
        <SummaryCard label="영업일수" value={`${dates.size}일`} />
        <SummaryCard label="주문 건수" value={`${orderIds.size.toLocaleString()}건`} />
        <SummaryCard label="총 매출" value={`${totalAmount.toLocaleString()}원`} />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">카테고리별 합계</p>
        <div className="flex flex-col gap-1.5">
          {Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{CATEGORY_LABEL[cat] ?? cat}</span>
                <span className="text-gray-700 font-medium tabular-nums">
                  {amount.toLocaleString()}원
                </span>
              </div>
            ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-5">
        총 {rows.length.toLocaleString()}개의 상품 라인이 저장됩니다.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-gray-800 font-semibold ${small ? 'text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
