'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IncomeBasis } from '@/lib/supabase/queries/settings'

interface Props {
  initialValue: IncomeBasis
}

// 순이익 계산 기준 토글 — POS 매출 vs 통장 입금
export default function IncomeBasisToggle({ initialValue }: Props) {
  const [value, setValue] = useState<IncomeBasis>(initialValue)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function set(next: IncomeBasis) {
    if (next === value) return
    setValue(next)
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'income_basis', value: next }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const btnBase =
    'flex-1 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50'
  const btnOn = 'bg-[#1a5c3a] text-white font-medium'
  const btnOff = 'bg-gray-50 text-gray-500 hover:bg-gray-100'

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-5">
      <p className="text-sm font-semibold text-gray-800">순이익 계산 기준</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
        순이익·이익률·손익분기 계산을 어느 수입 숫자로 할지 선택합니다.
        <br />
        매출(POS)·통장 입금 카드는 항상 그대로 표시되고, 이 토글은 "이익" 계산에만 영향을 줍니다.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => set('pos')}
          disabled={saving}
          className={`${btnBase} ${value === 'pos' ? btnOn : btnOff}`}
        >
          POS 매출 기준
        </button>
        <button
          type="button"
          onClick={() => set('bank')}
          disabled={saving}
          className={`${btnBase} ${value === 'bank' ? btnOn : btnOff}`}
        >
          통장 입금 기준
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400 leading-relaxed">
        {value === 'pos'
          ? 'POS 매출 - 지출 = 순이익. 회계상 손익 (선불카드 사용분 매출 인식 포함).'
          : '통장 입금 - 지출 = 순이익. 현금흐름 관점 (실제 통장에 남는 돈).'}
      </div>
    </div>
  )
}
