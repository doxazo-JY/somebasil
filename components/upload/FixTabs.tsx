'use client'

import { useState } from 'react'

// 데이터 고치기 — 이미 들어간 데이터를 고치는 도구 (PC 전용)
//   통장 거래 분류 / 메뉴 목록(죽은 메뉴·이름 매칭) / 수동 조정 / 계산 기준 (예전 설정 페이지)
// 첫 탭은 주소 ?fix= 로 정할 수 있음 (예전 /settings → ?fix=adjust)
type Fix = 'bank' | 'menu' | 'adjust' | 'basis'

const TABS: { key: Fix; label: string }[] = [
  { key: 'bank', label: '통장 거래 분류' },
  { key: 'menu', label: '메뉴 목록' },
  { key: 'adjust', label: '수동 조정' },
  { key: 'basis', label: '계산 기준' },
]

export default function FixTabs({ initial, views }: { initial?: string; views: Record<Fix, React.ReactNode> }) {
  const [tab, setTab] = useState<Fix>(TABS.some((t) => t.key === initial) ? (initial as Fix) : 'bank')
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg ${tab === t.key ? 'bg-[#1a5c3a] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {views[tab]}
    </div>
  )
}
