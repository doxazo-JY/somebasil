// 출퇴근 표시용 포맷 — 클라이언트/서버 공용 (한국 시간 기준)

const TZ = 'Asia/Seoul'

// '08:52'
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

// '10월 14일 수요일'
export function fmtDateLong(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(iso))
}

// work_date('2026-10-14') → '10/14 (수)'
export function fmtWorkDate(workDate: string): string {
  const [y, m, d] = workDate.split('-').map(Number)
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d} (${day})`
}

// 254 → '4시간 14분'
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

// 254 → '4:14'
export function fmtHm(minutes: number | null | undefined): string {
  if (minutes == null) return '—'
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

// work_date가 일요일인지 (주일 시급)
export function isSunday(workDate: string): boolean {
  const [y, m, d] = workDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0
}

// 한국 날짜 + 'HH:MM' → ISO (자정 넘김은 호출 측에서 처리)
export function kstIso(workDate: string, hhmm: string): string {
  return new Date(`${workDate}T${hhmm}:00+09:00`).toISOString()
}

// ISO → 한국 시간 'HH:MM' (input[type=time] 값)
export function toHhmm(iso: string | null | undefined): string {
  return iso ? fmtTime(iso) : ''
}
