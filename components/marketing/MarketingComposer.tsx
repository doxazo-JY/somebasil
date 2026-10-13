'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const QUICK_TOPICS = ['이번 주 인기 메뉴 소개', '손님 적은 요일 이벤트 [이벤트 내용]', '시즌 신메뉴 소개', '휴무·영업시간 공지']

// 주제 입력 → 인스타·블로그 초안 만들기
export default function MarketingComposer({ disabledReason }: { disabledReason: string | null }) {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/ai/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error ?? '초안을 만들지 못했어요')
    setTopic('')
    router.refresh()
  }

  return (
    <form onSubmit={generate} className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">새 글 초안</p>
        <p className="text-xs text-gray-400 mt-0.5 [word-break:keep-all]">
          무엇에 대한 글인지 적으면 인스타그램·블로그 초안을 함께 써요. 매주 수요일에는 경영 AI가 찾은 주제로 자동으로도 써요.
        </p>
      </div>
      <textarea
        id="marketing-topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="예: 요즘 말차 라떼가 잘 나가니까 소개하는 글. 너무 광고 같지 않게."
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
      />
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-[#1a5c3a] hover:text-[#1a5c3a]"
          >
            {t.replace(' [이벤트 내용]', '')}
          </button>
        ))}
      </div>
      {(error || disabledReason) && <p className="text-xs text-red-500 [word-break:keep-all]">{error ?? disabledReason}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !topic.trim() || !!disabledReason}
          className="text-xs px-4 py-2 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-40"
        >
          {busy ? '쓰는 중… (30초 정도)' : '초안 만들기'}
        </button>
      </div>
    </form>
  )
}
