'use client'

import { useState } from 'react'

// 데이터 고치기 — 이미 들어간 데이터를 고치는 도구 (PC 전용)
//   통장 거래 분류 / 메뉴 목록(죽은 메뉴·이름 매칭)
export default function FixTabs({ bank, menu }: { bank: React.ReactNode; menu: React.ReactNode }) {
  const [tab, setTab] = useState<'bank' | 'menu'>('bank')
  const tabs = [
    { key: 'bank' as const, label: '통장 거래 분류' },
    { key: 'menu' as const, label: '메뉴 목록' },
  ]
  return (
    <div>
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg ${tab === t.key ? 'bg-[#1a5c3a] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'bank' ? bank : menu}
    </div>
  )
}
