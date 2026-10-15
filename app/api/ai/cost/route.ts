import { NextRequest, NextResponse } from 'next/server'
import { applyProposal, proposeFromAnswer } from '@/lib/ai/cost/answer'
import { startFromNote } from '@/lib/ai/cost/note'

// 원가 AI 질문 답하기 — 관리 화면 로그인 대상
// body: { id, step: 'propose', answer }  → AI가 답을 저장안으로 정리 (DB는 그대로)
//       { id, step: 'apply' }            → 점장이 확인한 저장안을 DB에 저장
//       { step: 'note', answer }         → 질문 없이 점장이 먼저 적은 내용 → 질문 항목을 만들고 바로 정리 (lib/ai/cost/note.ts)
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { id, step, answer } = await req.json().catch(() => ({}))
  if (step === 'note') {
    const text = typeof answer === 'string' ? answer.trim().slice(0, 1000) : ''
    if (!text) return NextResponse.json({ error: '내용을 적어 주세요' }, { status: 400 })
    try {
      const r = await startFromNote(text)
      return r.ok ? NextResponse.json({ proposal: r.proposal }) : NextResponse.json({ error: r.error }, { status: 422 })
    } catch (error) {
      console.error('[POST /api/ai/cost] note', error)
      return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
    }
  }
  const itemId = Number(id)
  if (!Number.isInteger(itemId)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  try {
    if (step === 'propose') {
      const text = typeof answer === 'string' ? answer.trim().slice(0, 1000) : ''
      if (!text) return NextResponse.json({ error: '답을 적어 주세요' }, { status: 400 })
      return NextResponse.json({ proposal: await proposeFromAnswer(itemId, text) })
    }
    if (step === 'apply') return NextResponse.json({ result: await applyProposal(itemId) })
    return NextResponse.json({ error: 'invalid_step' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/ai/cost]', step, error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 500 })
  }
}
