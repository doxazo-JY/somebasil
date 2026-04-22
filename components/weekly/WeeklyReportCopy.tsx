'use client'

import { useState } from 'react'
import type { WeekDetail } from '@/lib/supabase/queries/weekly'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const CATEGORY_LABEL: Record<string, string> = {
  coffee: '커피&슈페너',
  drip_coffee: '드립커피',
  dutch_coffee: '더치커피',
  matcha: '말차',
  ade: '에이드',
  tea: '티',
  beverage: '음료',
  dessert: '디저트',
  season: '시즌',
  etc: '기타',
}

function fmt(v: number) {
  const abs = Math.round(Math.abs(v) / 10000)
  return `${v < 0 ? '-' : ''}${abs}만`
}

function pctChange(cur: number, prev: number): string {
  if (!prev) return ''
  const p = ((cur - prev) / Math.abs(prev)) * 100
  return `${p >= 0 ? '▲' : '▼'}${Math.abs(p).toFixed(0)}%`
}

interface Props {
  detail: WeekDetail
  prev?: WeekDetail
}

export default function WeeklyReportCopy({ detail, prev }: Props) {
  const [copied, setCopied] = useState(false)

  // 복붙용 텍스트 생성
  function buildText() {
    const lines: string[] = []
    lines.push(`[썸바실 주간보고] ${detail.weekStart.slice(5)} ~ ${detail.weekEnd.slice(5)}`)
    lines.push('')
    lines.push(
      `• 매출 ${fmt(detail.income)}${prev ? ` (전주 ${fmt(prev.income)} · ${pctChange(detail.income, prev.income)})` : ''}`,
    )
    if (detail.hasExpenseData) {
      lines.push(
        `• 지출 ${fmt(detail.expense)}${prev?.hasExpenseData ? ` (전주 ${fmt(prev.expense)} · ${pctChange(detail.expense, prev.expense)})` : ''}`,
      )
      lines.push(`• 손익 ${fmt(detail.profit)}`)
    }
    lines.push(
      `• 객단가 ${detail.aov.toLocaleString()}원 · 주문 ${detail.orderCount.toLocaleString()}건${
        prev ? ` (전주 ${prev.aov.toLocaleString()}원 · ${pctChange(detail.aov, prev.aov)})` : ''
      }`,
    )

    // 요일별 top
    const topDay = [...detail.daily].sort((a, b) => b.income - a.income)[0]
    if (topDay && topDay.income > 0) {
      lines.push(
        `• 피크일: ${WEEKDAY_LABELS[topDay.weekday]}요일 (${topDay.date.slice(5).replace('-', '/')}) ${fmt(topDay.income)}`,
      )
    }

    lines.push('')
    lines.push('[BEST 5 메뉴]')
    for (const p of detail.topProducts.slice(0, 5)) {
      lines.push(
        `• ${p.product_name} ${p.quantity}잔 · ${p.amount.toLocaleString()}원`,
      )
    }

    lines.push('')
    lines.push('[카테고리 비중]')
    for (const c of detail.categoryMix.slice(0, 5)) {
      const label = CATEGORY_LABEL[c.category] ?? c.category
      lines.push(`• ${label} ${c.pct.toFixed(1)}% (${fmt(c.amount)})`)
    }

    return lines.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const text = buildText()

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">📋 주간보고 요약 (복붙용)</p>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1 rounded-md transition-colors ${
            copied
              ? 'bg-[#1a5c3a] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
        {text}
      </pre>
      <p className="text-[11px] text-gray-400 mt-2">
        카톡/슬랙에 그대로 붙여넣기 가능
      </p>
    </div>
  )
}
