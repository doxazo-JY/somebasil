'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type Tab = 'cost' | 'recovery'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'cost', label: '메뉴별 원가', hint: '각 메뉴 원가/마진/원가율' },
  { key: 'recovery', label: '재료 회수율', hint: '봉지 1개 회수 진행률 (현금 4종)' },
]

export default function RecipesTabs({
  costView,
  recoveryView,
}: {
  costView: ReactNode
  recoveryView: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('cost')

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3 mb-4 border-b border-gray-100">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'text-[#1a5c3a]' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#1a5c3a] rounded-t" />
              )}
            </button>
          )
        })}
        <span className="text-[11px] text-gray-400 ml-auto [word-break:keep-all]">
          {TABS.find((t) => t.key === tab)?.hint}
        </span>
      </div>

      <div className={tab === 'cost' ? '' : 'hidden'}>{costView}</div>
      <div className={tab === 'recovery' ? '' : 'hidden'}>{recoveryView}</div>
    </div>
  )
}
