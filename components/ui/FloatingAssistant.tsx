'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import AssistantChat from '@/components/office/AssistantChat'

// 오른쪽 아래 비서 AI 버튼 (썸바실 로고) — 어느 관리 화면에서나 바로 질문
//   열 때 최근 대화를 불러와 사무실 비서 자리와 같은 대화를 이어 감
//   지금 보는 화면 주소를 같이 보내서 "이 화면", "이 숫자"를 알아들음
//   직원용 출퇴근 화면(/clock)에는 없음
export default function FloatingAssistant() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<{ history: { q: string; a: string }[]; configProblem: string | null } | null>(null)

  useEffect(() => {
    if (!open || state) return
    fetch('/api/ai/ask')
      .then((r) => r.json())
      .then((d) => setState({ history: d.history ?? [], configProblem: d.configProblem ?? null }))
      .catch(() => setState({ history: [], configProblem: null }))
  }, [open, state])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (pathname.startsWith('/clock')) return null
  const qs = searchParams.toString()
  const page = qs ? `${pathname}?${qs}` : pathname

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="비서 AI"
          className="fixed z-50 inset-x-2 top-14 bottom-20 md:inset-auto md:right-6 md:bottom-24 md:w-[400px] md:h-[min(620px,calc(100vh-8rem))] bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5 shrink-0">
            <Image src="/somebasil_logo.png" alt="" width={28} height={28} className="rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">비서 AI</p>
              <p className="text-[11px] text-gray-400 truncate">매출·메뉴·지출·근무시간, 그리고 사이트 사용법을 물어보세요</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100" aria-label="닫기">
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {state ? (
              <AssistantChat initial={state.history} disabledReason={state.configProblem} page={page} compact />
            ) : (
              <p className="text-xs text-gray-400 text-center py-16">불러오는 중…</p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? '비서 AI 닫기' : '비서 AI에게 물어보기'}
        title="비서 AI에게 물어보기"
        className="fixed z-50 right-4 bottom-20 md:right-6 md:bottom-6 w-14 h-14 rounded-full shadow-lg ring-2 ring-white overflow-hidden hover:scale-105 transition-transform"
      >
        <Image src="/somebasil_logo.png" alt="썸바실 비서" width={56} height={56} className="w-full h-full object-cover" />
      </button>
    </>
  )
}
