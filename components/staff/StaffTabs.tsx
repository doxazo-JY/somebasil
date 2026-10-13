'use client'

import { useState } from 'react'

// /staff 페이지 내부 탭 — 한 화면에 한 가지씩
// 요약 = 근무일지 업로드 기준, 나머지 = QR 출퇴근
const TABS = [
  { key: 'summary', label: '요약' },
  { key: 'logs', label: '출퇴근 기록' },
  { key: 'timesheet', label: '근무일지·인건비' },
  { key: 'staff', label: '직원·폰' },
  { key: 'settings', label: 'QR·시급' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function StaffTabs({ sections }: { sections: Record<TabKey, React.ReactNode> }) {
  const [tab, setTab] = useState<TabKey>('summary')
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
