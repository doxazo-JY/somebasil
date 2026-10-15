// docs/점장-가이드.md 생성 — 내용은 lib/guide.ts 한 곳 (가이드 화면·비서 AI와 같은 내용)
// 실행: npx tsx notes/_make_manager_guide.ts
import { writeFileSync } from 'node:fs'
import { GUIDE } from '../lib/guide'

const lines: string[] = [
  '# 카페 썸바실 관리 시스템 — 사용 가이드',
  '',
  '> 이 파일은 `lib/guide.ts`에서 만들어요 (사이트 /guide 화면, 비서 AI와 같은 내용). 직접 고치지 말고 guide.ts를 고친 뒤 `npx tsx notes/_make_manager_guide.ts`.',
  '',
]
for (const group of ['공통', '운영', '분석', '데이터'] as const) {
  const sections = GUIDE.filter((s) => s.group === group)
  if (sections.length === 0) continue
  lines.push(`## ${group}`, '')
  for (const s of sections) {
    lines.push(`### ${s.title} (\`${s.path}\`)`, '', s.summary, '', `**언제:** ${s.when}`, '')
    for (const p of s.parts) lines.push(`- **${p.name}** — ${p.desc}`)
    if (s.tasks.length) {
      lines.push('', '**자주 하는 일**', '')
      for (const t of s.tasks) lines.push(`- **${t.q}** → ${t.a}`)
    }
    lines.push('')
  }
}
writeFileSync('docs/점장-가이드.md', lines.join('\n'))
console.log('docs/점장-가이드.md', lines.length, '줄')
