import { NextRequest, NextResponse } from 'next/server'
import { askAssistant } from '@/lib/ai/agents/assistant'

// 비서 AI 질문 — 관리 화면 로그인 대상
// body: { question, history?: [{ q, a }] }  (history = 이어서 묻기용 최근 대화, 최대 3개 사용)
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { question, history } = await req.json().catch(() => ({}))
  const q = typeof question === 'string' ? question.trim().slice(0, 500) : ''
  if (!q) return NextResponse.json({ error: 'empty_question' }, { status: 400 })
  const h = Array.isArray(history)
    ? history
        .filter((x): x is { q: string; a: string } => typeof x?.q === 'string' && typeof x?.a === 'string')
        .map((x) => ({ q: x.q.slice(0, 500), a: x.a.slice(0, 2000) }))
    : []
  try {
    const result = await askAssistant(q, h)
    return NextResponse.json({ answer: result.output.answer, toolsUsed: result.output.toolsUsed })
  } catch (error) {
    console.error('[POST /api/ai/ask]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
