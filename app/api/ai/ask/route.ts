import { NextRequest, NextResponse } from 'next/server'
import { askAssistant } from '@/lib/ai/agents/assistant'
import { getAssistantHistory } from '@/lib/supabase/queries/ai'
import { aiConfigProblem } from '@/lib/ai/client'

// 비서 AI 질문 — 관리 화면 로그인 대상
// body: { question, history?: [{ q, a }], page? }  (history = 이어서 묻기용 최근 대화, 최대 3개 · page = 지금 보는 화면 주소)
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { question, history, page } = await req.json().catch(() => ({}))
  const q = typeof question === 'string' ? question.trim().slice(0, 500) : ''
  if (!q) return NextResponse.json({ error: 'empty_question' }, { status: 400 })
  const h = Array.isArray(history)
    ? history
        .filter((x): x is { q: string; a: string } => typeof x?.q === 'string' && typeof x?.a === 'string')
        .map((x) => ({ q: x.q.slice(0, 500), a: x.a.slice(0, 2000) }))
    : []
  try {
    const result = await askAssistant(q, h, typeof page === 'string' && page.startsWith('/') ? page.slice(0, 200) : undefined)
    return NextResponse.json({ answer: result.output.answer, toolsUsed: result.output.toolsUsed })
  } catch (error) {
    console.error('[POST /api/ai/ask]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}

// 오른쪽 아래 비서 채팅창이 열릴 때 — 최근 대화 + AI 설정 문제(키 없음 등)
export async function GET() {
  const history = await getAssistantHistory().catch(() => [])
  return NextResponse.json({ history: history.map(({ q, a }) => ({ q, a })), configProblem: aiConfigProblem() })
}
