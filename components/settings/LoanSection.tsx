'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Loan } from '@/lib/supabase/queries/loans'

interface CounterpartSummary {
  counterpart: string
  balance: number
  borrow: number
  repay: number
}

interface Props {
  loans: Loan[]
  balance: number
  byCounterpart: CounterpartSummary[]
}

function fmt(v: number) {
  return `${v.toLocaleString()}원`
}

function fmtManwon(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

export default function LoanSection({ loans, balance, byCounterpart }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }
  function openEdit(loan: Loan) {
    setEditing(loan)
    setShowForm(true)
  }
  function close() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: number) {
    if (!confirm('이 거래를 삭제할까요?')) return
    const res = await fetch('/api/loans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) router.refresh()
  }

  const totalBorrow = loans.filter((l) => l.direction === 'borrow').reduce((s, l) => s + l.amount, 0)
  const totalRepay = loans.filter((l) => l.direction === 'repay').reduce((s, l) => s + l.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">대여금 관리</h2>
        <button
          onClick={openAdd}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] transition-colors"
        >
          + 거래 추가
        </button>
      </div>

      {/* 잔액 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-400 mb-1">현재 잔액</p>
          <p className={`text-xl font-bold ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-[#1a5c3a]' : 'text-gray-800'}`}>
            {balance === 0 ? '0원' : `${balance > 0 ? '+' : ''}${fmtManwon(balance)}`}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {balance > 0
              ? '외부에 갚아야 할 금액'
              : balance < 0
              ? '외부로부터 받을 금액'
              : '정산 완료'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-400 mb-1">누적 빌림</p>
          <p className="text-xl font-bold text-gray-800">{fmtManwon(totalBorrow)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {loans.filter((l) => l.direction === 'borrow').length}건
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-400 mb-1">누적 상환</p>
          <p className="text-xl font-bold text-gray-800">{fmtManwon(totalRepay)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {loans.filter((l) => l.direction === 'repay').length}건
          </p>
        </div>
      </div>

      {/* 상대방별 잔액 */}
      {byCounterpart.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 mb-4">
          <p className="text-xs text-gray-400 mb-2">상대방별 잔액</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {byCounterpart.map((c) => (
              <li key={c.counterpart} className="flex items-center gap-2">
                <span className="text-gray-600">{c.counterpart}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    c.balance > 0 ? 'text-red-500' : c.balance < 0 ? 'text-[#1a5c3a]' : 'text-gray-400'
                  }`}
                >
                  {c.balance === 0 ? '정산 완료' : `${c.balance > 0 ? '+' : ''}${fmtManwon(c.balance)}`}
                </span>
                <span className="text-gray-400 text-[11px]">
                  (빌림 {fmtManwon(c.borrow)} / 상환 {fmtManwon(c.repay)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 거래 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loans.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            거래 없음 · 상단 "+ 거래 추가" 로 시작
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-400 font-medium">
              <tr>
                <th className="text-left px-4 py-2.5">날짜</th>
                <th className="text-left px-4 py-2.5">구분</th>
                <th className="text-left px-4 py-2.5">상대방</th>
                <th className="text-right px-4 py-2.5">금액</th>
                <th className="text-left px-4 py-2.5">메모</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loans.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-gray-500 tabular-nums">{l.date}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        l.direction === 'borrow'
                          ? 'text-red-600 bg-red-50'
                          : 'text-[#1a5c3a] bg-green-50'
                      }`}
                    >
                      {l.direction === 'borrow' ? '빌림' : '상환'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{l.counterpart ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">
                    {fmt(l.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[240px] truncate">
                    {l.memo ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(l)}
                        className="text-gray-400 hover:text-[#1a5c3a] text-xs px-1"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(l.id)}
                        className="text-gray-300 hover:text-red-400 text-sm px-1"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <LoanFormModal
          initial={editing}
          onClose={close}
          onSaved={() => {
            close()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 대여금 거래 추가/수정 모달
// ─────────────────────────────────────────────
function LoanFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Loan | null
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(initial?.date ?? today)
  const [direction, setDirection] = useState<'borrow' | 'repay'>(initial?.direction ?? 'borrow')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [counterpart, setCounterpart] = useState(initial?.counterpart ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const amtNum = Number(amount.replace(/,/g, ''))
    if (!amtNum || amtNum <= 0) {
      setError('금액을 입력해주세요')
      return
    }
    setSaving(true)

    const payload = { date, direction, amount: amtNum, counterpart, memo }

    const res = await fetch('/api/loans', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initial ? { id: initial.id, ...payload } : payload),
    })

    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? '저장 실패')
      return
    }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl w-full max-w-md shadow-lg"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">
            {initial ? '거래 수정' : '거래 추가'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">구분</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('borrow')}
                className={`flex-1 text-sm py-2 rounded border transition-colors ${
                  direction === 'borrow'
                    ? 'bg-red-50 border-red-200 text-red-600 font-semibold'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                빌림 (카페 → 차입)
              </button>
              <button
                type="button"
                onClick={() => setDirection('repay')}
                className={`flex-1 text-sm py-2 rounded border transition-colors ${
                  direction === 'repay'
                    ? 'bg-green-50 border-[#1a5c3a]/30 text-[#1a5c3a] font-semibold'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                상환 (카페 → 갚음)
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">금액 (원)</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="4000000"
              className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">상대방 (선택)</span>
            <input
              type="text"
              value={counterpart}
              onChange={(e) => setCounterpart(e.target.value)}
              placeholder="장천섭"
              className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">메모 (선택)</span>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="초기 운영자금"
              className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-xs px-4 py-2 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50"
          >
            {saving ? '저장 중...' : initial ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
