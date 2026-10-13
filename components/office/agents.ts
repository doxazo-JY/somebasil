// AI 사무실 구성원 — 책상 순서대로
// key = ai_runs·ai_inbox의 agent 값 (이름을 바꿔도 key는 유지: cashflow=자금 관리, attendance=직원 관리)
// run: /api/ai/run 실행 단위 (null = 버튼 없음), vacant: 아직 입사 전 (빈 책상), chat: 질문창

export type OfficeAgent = {
  key: string
  name: string
  role: string
  schedule: string
  run: 'weekly' | 'cashflow' | 'attendance' | null
  usesAi: boolean
  link?: { href: string; label: string }
  shirt: string
  hair: string
  vacant?: string // 입사 조건
  chat?: boolean
}

export const OFFICE_AGENTS: OfficeAgent[] = [
  { key: 'business', name: '경영 AI', role: '지난주 매출·지출을 보고 이번 주 꼭 볼 것 3가지를 정리해요. 끝나면 마케팅 AI에게 이번 주 주제를 넘겨요.', schedule: '매주 수요일 오전 8시', run: 'weekly', usesAi: true, shirt: '#2f6fb0', hair: '#3a2a20' },
  { key: 'marketing', name: '마케팅 AI', role: '경영 AI가 넘긴 주제나 직접 요청한 주제로 인스타·블로그 초안을 써요.', schedule: '경영 AI 다음 · 요청할 때', run: null, usesAi: true, link: { href: '/marketing', label: '마케팅 화면에서 글 쓰기' }, shirt: '#d0607a', hair: '#6b3d22' },
  { key: 'assistant', name: '비서 AI', role: '궁금한 걸 물어보면 매출·메뉴·지출·근무시간 기록을 직접 찾아보고 답해요.', schedule: '물어볼 때', run: null, usesAi: true, chat: true, shirt: '#5a6fa8', hair: '#1f1f1f' },
  { key: 'cashflow', name: '자금 관리 AI', role: '통장 거래로 앞으로 30일 동안 잔고가 부족해질 위험을 미리 알려요.', schedule: '매주 월요일 오전 8시', run: 'cashflow', usesAi: true, shirt: '#c98a22', hair: '#4a3426' },
  { key: 'attendance', name: '직원 관리 AI', role: 'QR 출퇴근 기록에서 퇴근 누락과 주휴수당 대상을 찾아요. 보건증·위생교육 만료 알림은 직원별 날짜를 입력하면 추가돼요.', schedule: '매일 오전 8시', run: 'attendance', usesAi: false, link: { href: '/staff', label: '직원 화면 열기' }, shirt: '#1a5c3a', hair: '#222222' },
  { key: 'cost', name: '원가 AI', role: '재료값이 오르면 메뉴별 원가율 변화를 알려 줄 예정이에요.', schedule: '', run: null, usesAi: true, shirt: '#7a6aa8', hair: '#2b2b2b', vacant: '레시피·재료 단가 입력 후 입사' },
]
