'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FileDropZone from './FileDropZone'
import type { UploadResult } from '@/app/api/upload/route'
import type { WeekCoverage } from '@/lib/upload/coverage'
import type { UncertainTx } from '@/lib/upload/save'

// 데이터 넣기 — 파일을 끌어다 놓으면 종류를 알아보고 바로 저장 (저장 버튼 없음)
//   맨 위 체크리스트: 지난주 매출·통장이 어디까지 들어왔나 (다 들어오면 AI 분석 시작)
//   아래: 파일별 결과 + 확인할 것(분류가 애매한 통장 출금 · 근무일지 경고)만

type Item = { name: string; status: 'reading' | 'done' | 'error'; result?: UploadResult; error?: string }

const CATEGORY_OPTIONS = [
  { value: 'ingredients_cash', label: '재료비(현금)' },
  { value: 'ingredients_card', label: '재료비(카드)' },
  { value: 'labor', label: '인건비' },
  { value: 'fixed', label: '고정비' },
  { value: 'equipment', label: '설비투자' },
  { value: 'excluded', label: '제외' },
]

const md = (d: string | null) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')

export default function UploadSection({ coverage: initialCoverage, weeklyDone: initialDone }: { coverage: WeekCoverage; weeklyDone: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [coverage, setCoverage] = useState(initialCoverage)
  const [weeklyDone, setWeeklyDone] = useState(initialDone)
  const [aiStarted, setAiStarted] = useState<string[]>([])

  async function handleFiles(files: File[]) {
    if (busy || files.length === 0) return
    setBusy(true)
    setAiStarted([])
    const start = items.length
    setItems((prev) => [...prev, ...files.map((f) => ({ name: f.name, status: 'reading' as const }))])

    // 하나씩 순서대로 (같은 달 재계산이 겹치지 않게)
    let bank = false
    for (let i = 0; i < files.length; i++) {
      const form = new FormData()
      form.append('file', files[i])
      const res = await fetch('/api/upload', { method: 'POST', body: form }).catch(() => null)
      const data = res ? await res.json().catch(() => null) : null
      const next: Item = res?.ok && data ? { name: files[i].name, status: 'done', result: data } : { name: files[i].name, status: 'error', error: data?.error ?? '올리지 못했어요. 다시 넣어 주세요.' }
      if (next.result?.kind === 'bank_transaction') bank = true
      setItems((prev) => prev.map((it, idx) => (idx === start + i ? next : it)))
    }

    // 다 넣은 뒤 한 번 — 체크리스트 갱신 + AI 분석 판단
    const fin = await fetch('/api/upload/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank }),
    }).catch(() => null)
    const f = fin ? await fin.json().catch(() => null) : null
    if (f?.coverage) setCoverage(f.coverage)
    if (f) {
      setAiStarted(f.aiStarted ?? [])
      setWeeklyDone(!!f.weeklyDone || (f.aiStarted ?? []).includes('경영 AI'))
    }
    setBusy(false)
    router.refresh()
  }

  const uncertain = items.flatMap((it) => it.result?.uncertain ?? [])
  const warnings = items.flatMap((it) => (it.result?.warnings ?? []).map((w) => `${it.name}: ${w}`))
  const ready = coverage.salesReady && coverage.bankReady

  return (
    <div className="space-y-4">
      {/* 지난주 체크리스트 */}
      <div className={`rounded-xl border px-5 py-4 ${ready ? 'border-[#1a5c3a]/20 bg-[#f4f9f6]' : 'border-gray-100 bg-white'}`}>
        <p className="text-xs text-gray-500">
          지난주 <span className="text-gray-400">({coverage.week.label} · {md(coverage.week.start)}~{md(coverage.week.end)})</span>
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <CheckLine label="매출" through={coverage.sales} ok={coverage.salesReady} />
          <CheckLine label="통장" through={coverage.bank} ok={coverage.bankReady} />
        </div>
        <p className="mt-1.5 text-xs text-gray-500 [word-break:keep-all]">
          {aiStarted.length > 0
            ? `${aiStarted.join('·')}가 분석을 시작했어요. 1~2분 뒤 사무실에서 확인하세요.`
            : ready
              ? weeklyDone
                ? '이번 주 분석은 했어요. 고친 데이터로 다시 보려면 사무실 경영 AI의 [지난주 다시 분석]을 눌러 주세요.'
                : '다 들어왔어요.'
              : `${md(coverage.week.end)}(일)까지 들어오면 경영 AI가 지난주를 분석해요.`}
        </p>
      </div>

      <FileDropZone
        accept=".xls,.xlsx"
        hint="POS 매출 · 통장 · 메뉴 · 근무일지 · 레시피 양식 — 여러 개 한꺼번에 넣어도 돼요"
        onFile={(f) => handleFiles([f])}
        onFiles={handleFiles}
        loading={busy}
      />

      {/* 파일별 결과 */}
      {items.length > 0 && (
        <ul className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {items.map((it, i) => (
            <li key={i} className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className={`w-4 shrink-0 ${it.status === 'error' ? 'text-red-500' : it.status === 'done' ? 'text-[#1a5c3a]' : 'text-gray-300'}`}>
                {it.status === 'error' ? '✕' : it.status === 'done' ? '✓' : '…'}
              </span>
              <span className="text-gray-800 min-w-0 truncate max-w-[50%]">{it.name}</span>
              <span className={`text-xs [word-break:keep-all] ${it.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                {it.status === 'reading' ? '읽는 중…' : it.status === 'error' ? it.error : `${it.result!.label} · ${it.result!.summary}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 확인할 것 */}
      {uncertain.length > 0 && <UncertainList rows={uncertain} />}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800">근무일지에서 확인할 것</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-900 [word-break:keep-all]">{w}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckLine({ label, through, ok }: { label: string; through: string | null; ok: boolean }) {
  return (
    <span className={ok ? 'text-[#1a5c3a]' : 'text-gray-500'}>
      {ok ? '✓' : '○'} {label} <span className="tabular-nums">{through ? `${md(through)}까지` : '없음'}</span>
    </span>
  )
}

// 자동 분류가 기본값(재료비-카드)으로 떨어진 새 출금 — 맞으면 그대로 두고, 아니면 바꾸기
function UncertainList({ rows }: { rows: UncertainTx[] }) {
  const router = useRouter()
  const [cats, setCats] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.category])))
  const [saving, setSaving] = useState<number | null>(null)

  async function change(r: UncertainTx, category: string) {
    setSaving(r.id)
    const res = await fetch('/api/upload/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, item: r.memo, category, amount: r.amount }),
    }).catch(() => null)
    setSaving(null)
    if (res?.ok) {
      setCats((prev) => ({ ...prev, [r.id]: category }))
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">분류가 애매한 통장 출금 {rows.length}건</p>
        <p className="text-xs text-gray-400 [word-break:keep-all]">규칙에 안 걸려서 재료비(카드)로 넣었어요. 맞으면 그대로 두고, 아니면 바꿔 주세요.</p>
      </div>
      <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-2 flex items-center gap-3 text-sm">
            <span className="text-xs text-gray-400 tabular-nums w-10 shrink-0">{md(r.date)}</span>
            <span className="flex-1 min-w-0 truncate text-gray-800">{r.counterpart || r.memo}</span>
            <span className="tabular-nums text-gray-700 shrink-0">{r.amount.toLocaleString()}원</span>
            <select
              value={cats[r.id]}
              disabled={saving === r.id}
              onChange={(e) => change(r, e.target.value)}
              aria-label="분류"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 shrink-0"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
