'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxItem } from '@/lib/supabase/queries/ai'

const AGENT_LABEL: Record<string, string> = { business: '경영 AI', marketing: '마케팅 AI' }

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(iso))
}

// 업무함 항목 목록 — 처리 전 / 처리한 항목
export default function InboxList({ open, closed }: { open: InboxItem[]; closed: InboxItem[] }) {
  const router = useRouter()
  const [showClosed, setShowClosed] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function setStatus(id: number, status: InboxItem['status']) {
    setBusyId(id)
    await fetch('/api/ai/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {open.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-gray-700">챙길 일이 없어요</p>
          <p className="text-xs text-gray-400 mt-1 [word-break:keep-all]">경영 AI는 매주 수요일 아침에 지난주를 점검해서 꼭 볼 것만 여기에 올려요</p>
        </div>
      ) : (
        open.map((item) => (
          <article
            key={item.id}
            className={`bg-white rounded-xl border px-5 py-4 space-y-3 ${item.severity === 'warn' ? 'border-amber-200' : 'border-gray-100'}`}
          >
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-[#e6f0ea] text-[#1a5c3a] font-semibold">{AGENT_LABEL[item.agent] ?? item.agent}</span>
              {item.severity === 'warn' && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">확인 필요</span>}
              <span className="text-gray-400">{fmtDate(item.created_at)}</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900 [word-break:keep-all]">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed [word-break:keep-all]">{item.body}</p>
            </div>
            {item.evidence && item.evidence.length > 0 && (
              <dl className="flex flex-wrap gap-2">
                {item.evidence.map((e, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                    <dt className="text-gray-400">{e.label}</dt>
                    <dd className="text-gray-900 font-semibold tabular-nums">{e.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.action && (
              <div className="rounded-lg border border-[#1a5c3a]/20 bg-[#f4f9f6] px-3 py-2">
                <p className="text-[11px] font-semibold text-[#1a5c3a]">할 일</p>
                <p className="text-sm text-gray-800 [word-break:keep-all]">{item.action}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatus(item.id, 'dismissed')}
                disabled={busyId === item.id}
                className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                숨기기
              </button>
              <button
                onClick={() => setStatus(item.id, 'done')}
                disabled={busyId === item.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50"
              >
                확인 완료
              </button>
            </div>
          </article>
        ))
      )}

      {closed.length > 0 && (
        <div className="pt-2">
          <button onClick={() => setShowClosed(!showClosed)} className="text-xs text-gray-400 hover:text-gray-600">
            {showClosed ? '처리한 항목 접기' : `처리한 항목 ${closed.length}개 보기`}
          </button>
          {showClosed && (
            <ul className="mt-2 bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {closed.map((item) => (
                <li key={item.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <span className="text-gray-400 w-20 shrink-0">{fmtDate(item.created_at)}</span>
                  <span className="flex-1 text-gray-600 truncate">{item.title}</span>
                  <span className="text-gray-400 shrink-0">{item.status === 'done' ? '완료' : '숨김'}</span>
                  <button onClick={() => setStatus(item.id, 'new')} className="text-[#1a5c3a] hover:underline shrink-0">되돌리기</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
