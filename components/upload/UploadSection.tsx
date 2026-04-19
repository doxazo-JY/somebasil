'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FileDropZone from './FileDropZone'
import PreviewTable, { type PreviewRow } from './PreviewTable'
import type { BankRow } from '@/app/api/upload/bank/route'
import type { DailySalesRow } from '@/app/api/upload/daily-sales/route'

type Tab = 'daily' | 'bank'

function bankRowToPreview(row: BankRow): PreviewRow {
  return {
    date: row.date,
    memo: row.memo,
    amount: row.type === 'income' ? (row.income ?? 0) : (row.expense ?? 0),
    category: row.category,
    type: row.type,
  }
}

function dailyRowToPreview(row: DailySalesRow): PreviewRow {
  return {
    date: row.date,
    memo: row.category,
    amount: row.amount,
    category: row.category,
    type: 'income',
  }
}

export default function UploadSection() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('daily')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [filename, setFilename] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setPreview(null)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    const endpoint = tab === 'daily' ? '/api/upload/daily-sales' : '/api/upload/bank'
    const res = await fetch(endpoint, { method: 'POST', body: formData })
    const json = await res.json()

    setLoading(false)

    if (!res.ok) {
      setMessage({ text: json.error ?? '파싱 실패', ok: false })
      return
    }

    setFilename(json.filename)
    const rows: PreviewRow[] =
      tab === 'daily'
        ? (json.rows as DailySalesRow[]).map(dailyRowToPreview)
        : (json.rows as BankRow[]).map(bankRowToPreview)

    setPreview(rows)
  }

  async function handleSave(rows: PreviewRow[]) {
    setSaving(true)
    setMessage(null)

    // daily_sales 형태로 변환
    const payload =
      tab === 'daily'
        ? rows.map((r) => ({ date: r.date, category: r.category, amount: r.amount }))
        : rows.map((r) => ({
            date: r.date,
            memo: r.memo,
            income: r.type === 'income' ? r.amount : null,
            expense: r.type === 'expense' ? r.amount : null,
            category: r.category,
            type: r.type,
          }))

    const res = await fetch('/api/upload/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: tab === 'daily' ? 'daily_sales' : 'bank_transaction',
        rows: payload,
        filename,
      }),
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
      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['daily', 'bank'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPreview(null); setMessage(null) }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'daily' ? '📋 일별 매출 파일' : '🏦 통장 거래내역'}
          </button>
        ))}
      </div>

      {/* 파일 업로드 */}
      <FileDropZone
        accept=".xlsx,.xls"
        hint={
          tab === 'daily'
            ? 'YYYYMMDD.xlsx 형식 (예: 20260401.xlsx)'
            : '하나은행 거래내역 엑셀 파일'
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
      {preview && (
        <PreviewTable rows={preview} onSave={handleSave} saving={saving} />
      )}
    </div>
  )
}
