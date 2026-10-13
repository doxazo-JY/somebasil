'use client'

import { useState } from 'react'

// /staff 페이지 내부 탭 — 근무(매일·월말) / 직원·설정(가끔)
const TABS = [
  { key: 'work', label: '근무' },
  { key: 'settings', label: '직원·설정' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function StaffTabs({ sections }: { sections: Record<TabKey, React.ReactNode> }) {
  const [tab, setTab] = useState<TabKey>('work')
  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-gray-100 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap -mb-px border-b-2 transition-colors ${
              tab === t.key ? 'border-[#1a5c3a] text-[#1a5c3a] font-semibold' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div key={t.key} hidden={tab !== t.key} role="tabpanel">
          {sections[t.key]}
        </div>
      ))}
    </div>
  )
}
