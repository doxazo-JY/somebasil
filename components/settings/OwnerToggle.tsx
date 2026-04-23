'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface OwnerToggleProps {
  initialValue: boolean
  ownerExpenseCount: number
  ownerExpenseTotal: number
}

// 대표 개인 거래 on/off — 집계 포함 여부
export default function OwnerToggle({
  initialValue,
  ownerExpenseCount,
  ownerExpenseTotal,
}: OwnerToggleProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function toggle() {
    const next = !value
    setValue(next)
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'include_owner_personal', value: next }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">대표 개인 거래 포함</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            통장에서 대표 본인 계좌로 인출된 거래를 지출에 포함할지 여부.
            <br />
            대표 개인 소비로 확실할 때만 제외하세요. 기본: <span className="font-medium">제외</span>
          </p>
          <p className="text-xs text-gray-500 mt-3">
            현재 대상 거래: <span className="font-semibold">{ownerExpenseCount}건</span> / {Math.round(ownerExpenseTotal / 10000)}만원
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
            value ? 'bg-[#1a5c3a]' : 'bg-gray-200'
          } disabled:opacity-50`}
          aria-pressed={value}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              value ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400">
        {value
          ? '지금 대표 거래가 지출 집계에 포함되고 있습니다.'
          : '지금 대표 거래는 지출 집계에서 제외되고 있습니다.'}
      </div>
    </div>
  )
}
