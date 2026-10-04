import { NextRequest, NextResponse } from 'next/server'
import { parseWorklog } from '@/lib/worklog-parser'

// 근무일지 엑셀 파싱 (미리보기용 — 저장은 /api/upload/save type='work_logs')
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  try {
    const result = parseWorklog(await file.arrayBuffer())
    if (result.shifts.length === 0) {
      return NextResponse.json(
        { error: '근무 기록을 찾지 못했습니다. 시트 이름이 "26년 8월"처럼 되어 있는지 확인해주세요.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ...result, filename: file.name })
  } catch (err) {
    console.error('[upload/worklog]', err)
    return NextResponse.json({ error: '근무일지 파일을 읽지 못했습니다.' }, { status: 400 })
  }
}
