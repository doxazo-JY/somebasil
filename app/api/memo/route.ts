import { NextRequest, NextResponse } from 'next/server'
import { upsertMemo } from '@/lib/supabase/queries/dashboard'

export async function POST(req: NextRequest) {
  const { year, month, content } = await req.json()

  if (!year || !month || content === undefined) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  await upsertMemo(year, month, content)
  return NextResponse.json({ ok: true })
}
