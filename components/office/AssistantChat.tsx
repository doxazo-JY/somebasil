'use client'

import { useEffect, useRef, useState } from 'react'

type Turn = { q: string; a: string | null; error?: string }

const EXAMPLES = [
  '이번 달 매출 지난달이랑 비교해 줘',
  '지난달 요일별 하루 평균 매출은?',
  '이번 달 레몬 마들렌 몇 개 팔렸어?',
  '9월 재료비 얼마 나갔어?',
  '이번 달 알바생별 근무시간 알려 줘',
]

// 비서 AI 대화창 — 질문 → 데이터 조회 → 답 (최근 대화 이어서 묻기 가능)
export default function AssistantChat({ initial, disabledReason }: { initial: { q: string; a: string }[]; disabledReason: string | null }) {
  const [turns, setTurns] = useState<Turn[]>(initial)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [turns])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const history = turns.filter((t): t is { q: string; a: string } => !!t.a).slice(-3)
    setTurns((prev) => [...prev, { q, a: null }])
    setQuestion('')
    setBusy(true)
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    setTurns((prev) => {
      const next = [...prev]
      next[next.length - 1] = res?.ok ? { q, a: data.answer } : { q, a: null, error: data.error ?? '답을 받지 못했어요. 다시 물어봐 주세요.' }
      return next
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col">
      <div className="px-5 py-4 space-y-4 max-h-[560px] overflow-y-auto">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 [word-break:keep-all]">매출·메뉴·지출·근무시간 기록을 직접 찾아보고 답해요. 이렇게 물어보세요.</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => ask(e)}
                  disabled={!!disabledReason}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-[#1a5c3a] hover:text-[#1a5c3a] disabled:opacity-40"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#1a5c3a] text-white text-sm px-3.5 py-2 [word-break:keep-all]">{t.q}</p>
            </div>
            <div className="flex">
              {t.a ? (
                <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-gray-50 text-gray-800 text-sm px-3.5 py-2.5 whitespace-pre-line leading-relaxed [word-break:keep-all]">{t.a}</p>
              ) : t.error ? (
                <p className="text-xs text-red-500 [word-break:keep-all]">{t.error}</p>
              ) : (
                <p className="text-xs text-gray-400">기록을 찾아보는 중… (보통 10~30초)</p>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
        className="border-t border-gray-100 px-4 py-3 flex gap-2"
      >
        <input
          id="assistant-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={disabledReason ?? '궁금한 걸 물어보세요'}
          disabled={!!disabledReason}
          className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
        />
        <button
          type="submit"
          disabled={busy || !question.trim() || !!disabledReason}
          className="text-xs px-4 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-40 whitespace-nowrap"
        >
          {busy ? '찾는 중' : '물어보기'}
        </button>
      </form>
    </div>
  )
}
