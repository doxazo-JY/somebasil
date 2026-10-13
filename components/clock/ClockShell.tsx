// 직원용 출퇴근 화면 공통 틀 — 폰 전체 화면, 가운데 카드

export default function ClockShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-start justify-center px-4 py-8 bg-gray-50">
      <div className="w-full max-w-sm min-h-[440px] bg-white rounded-2xl border border-gray-100 px-6 py-7 flex flex-col gap-4">
        <span className="text-xs font-semibold tracking-wider text-[#1a5c3a]">SOMEBASIL</span>
        {children}
      </div>
    </div>
  )
}

export function CheckMark() {
  return (
    <div className="mx-auto mt-4 w-14 h-14 rounded-full bg-[#e6f0ea] text-[#1a5c3a] grid place-items-center text-2xl font-bold" aria-hidden>
      ✓
    </div>
  )
}
