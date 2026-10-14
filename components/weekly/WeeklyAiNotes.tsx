import Link from 'next/link'
import type { WeeklyAiNote } from '@/lib/supabase/queries/ai'

// 주간 탭 — 경영 AI가 본 이 주 (꼭 볼 것 3가지) + 다음 주 회의 때 받은 이번 주 추천
// 읽기 전용. 처리(확인 완료·숨기기)는 사무실에서
export default function WeeklyAiNotes({ analysis, tips }: { analysis: WeeklyAiNote[]; tips: WeeklyAiNote[] }) {
  if (analysis.length === 0 && tips.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 space-y-4">
      {analysis.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-gray-800">경영 AI가 본 이 주</p>
            <Link href="/inbox" className="text-xs text-[#1a5c3a] hover:underline shrink-0">처리는 사무실에서 →</Link>
          </div>
          <ol className="space-y-3">
            {analysis.map((n, i) => (
              <li key={n.id} className="flex gap-3">
                <span className={`shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold grid place-items-center ${n.severity === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-[#e6f0ea] text-[#1a5c3a]'}`}>{i + 1}</span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-gray-900 [word-break:keep-all]">
                    {n.title}
                    {n.status !== 'new' && <span className="ml-1.5 text-[10px] font-normal text-gray-400">{n.status === 'done' ? '확인함' : '숨김'}</span>}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed [word-break:keep-all]">{n.body}</p>
                  {n.action && <p className="text-xs text-[#1a5c3a] [word-break:keep-all]">할 일 · {n.action}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {tips.length > 0 && (
        <section className={`space-y-2 ${analysis.length > 0 ? 'pt-3 border-t border-gray-50' : ''}`}>
          <p className="text-sm font-semibold text-gray-800">
            이번 주 추천 <span className="ml-1 text-xs font-normal text-gray-400">경영 AI · 다가오는 계절·기념일과 우리 카페 흐름</span>
          </p>
          {tips.map((t) => (
            <div key={t.id} className="rounded-lg bg-sky-50/60 px-3 py-2 space-y-0.5">
              <p className="text-sm font-semibold text-gray-900 [word-break:keep-all]">{t.title}</p>
              <p className="text-xs text-gray-600 [word-break:keep-all]">{t.body}</p>
              {t.action && <p className="text-xs text-gray-700 whitespace-pre-line [word-break:keep-all]">{t.action}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
