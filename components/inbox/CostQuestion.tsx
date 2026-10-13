'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxItem } from '@/lib/supabase/queries/ai'
import type { CostProposal } from '@/lib/ai/cost/answer'

// 원가 AI 질문 — 답 적기 → [정리하기] AI가 저장안 미리보기 → [이대로 저장] 점장 확인 후 DB 저장
export default function CostQuestion({ item }: { item: InboxItem }) {
  const router = useRouter()
  const [answer, setAnswer] = useState(item.answer ?? '')
  const [proposal, setProposal] = useState<CostProposal | null>((item.proposal as CostProposal | null) ?? null)
  const [busy, setBusy] = useState<'propose' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)
  const example = (item.meta as { example?: string } | null)?.example

  async function call(step: 'propose' | 'apply') {
    setBusy(step)
    setError(null)
    const res = await fetch('/api/ai/cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, step, answer }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setBusy(null)
    if (!res?.ok) return setError(data.error ?? '처리하지 못했어요. 다시 해 주세요.')
    if (step === 'propose') setProposal(data.proposal)
    else {
      setSaved(data.result ?? [])
      setTimeout(() => router.refresh(), 2500)
    }
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-[#1a5c3a]/20 bg-[#f4f9f6] px-3 py-2 space-y-1">
        <p className="text-[11px] font-semibold text-[#1a5c3a]">저장했어요</p>
        {saved.map((s, i) => (
          <p key={i} className="text-sm text-gray-800 [word-break:keep-all]">{s}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-[#1a5c3a]/20 bg-[#f4f9f6] px-3 py-2">
        <p className="text-[11px] font-semibold text-[#1a5c3a]">질문</p>
        <p className="text-sm text-gray-800 [word-break:keep-all]">{item.action}</p>
      </div>
      <textarea
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value)
          if (proposal) setProposal(null) // 답을 고치면 다시 정리
        }}
        rows={2}
        maxLength={1000}
        placeholder={example ? `예: ${example.replace(/^예:\s*/, '')}` : '편하게 적어 주세요'}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a] [word-break:keep-all]"
      />

      {proposal && (
        <div className={`rounded-lg border px-3 py-2 space-y-1 ${proposal.ok ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`text-[11px] font-semibold ${proposal.ok ? 'text-gray-500' : 'text-amber-700'}`}>{proposal.ok ? '이렇게 저장할게요' : '조금 더 알려 주세요'}</p>
          {proposal.ok && proposal.preview.map((line, i) => (
            <p key={i} className="text-sm text-gray-800 tabular-nums [word-break:keep-all]">{line}</p>
          ))}
          {proposal.follow_up && <p className="text-sm text-amber-800 [word-break:keep-all]">{proposal.follow_up}</p>}
          {proposal.note && <p className="text-xs text-gray-500 [word-break:keep-all]">{proposal.note}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-500 [word-break:keep-all]">{error}</p>}

      <div className="flex justify-end gap-2">
        {proposal?.ok ? (
          <>
            <button onClick={() => setProposal(null)} disabled={!!busy} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
              다시 적기
            </button>
            <button onClick={() => call('apply')} disabled={!!busy} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">
              {busy === 'apply' ? '저장하는 중…' : '이대로 저장'}
            </button>
          </>
        ) : (
          <button
            onClick={() => call('propose')}
            disabled={!!busy || !answer.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-40"
          >
            {busy === 'propose' ? '정리하는 중… (10초 정도)' : '정리하기'}
          </button>
        )}
      </div>
    </div>
  )
}
