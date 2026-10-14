// 손익분기 기준 한 줄 — 몇 월~몇 월 평균인지 + 달별 인건비가 어디서 왔는지
//   다른 곳에서 계산한 손익분기와 다를 때 대부분 인건비 차이라서, 그 근거를 바로 보이게
//   work = 직원 화면 계산 (그 달에 일한 만큼: 근무 기록 + 고정급·주휴) / bank = 통장에서 나간 급여 (근무 기록이 없는 달)

export type LaborSource = { year: number; month: number; amount: number; source: 'work' | 'bank'; bank: number }

const man = (v: number) => `${Math.round(v / 10000).toLocaleString()}만`

export default function LaborBasisNote({ sources, breakEven, bankBreakEven }: { sources: LaborSource[]; breakEven: number | null; bankBreakEven: number | null }) {
  if (sources.length === 0) return null
  const first = sources[0]
  const last = sources[sources.length - 1]
  const range = first.year === last.year ? `${first.month}~${last.month}월` : `${String(first.year).slice(2)}.${first.month}~${String(last.year).slice(2)}.${last.month}`
  const avg = sources.reduce((s, x) => s + x.amount, 0) / sources.length
  const bankAvg = sources.reduce((s, x) => s + x.bank, 0) / sources.length
  const hasBank = sources.some((x) => x.source === 'bank')
  const differs = bankBreakEven != null && breakEven != null && Math.abs(bankBreakEven - breakEven) >= 50000

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 mb-4 text-xs text-gray-600 space-y-1.5 [word-break:keep-all]">
      <p>
        <span className="font-semibold text-gray-900">{range} 평균 기준</span>
        <span className="text-gray-400"> · 재료비·고정비·영업일은 거의 비슷하고, 손익분기를 가장 크게 바꾸는 건 인건비예요</span>
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <span className="text-gray-500">인건비</span>
        {sources.map((s) => (
          <span key={`${s.year}-${s.month}`} className="tabular-nums">
            {s.month}월 <span className="font-semibold text-gray-900">{man(s.amount)}</span>
            <span className={s.source === 'work' ? 'text-[#1a5c3a]' : 'text-amber-700'}> ({s.source === 'work' ? '근무 기록' : '통장 급여'})</span>
          </span>
        ))}
        <span className="tabular-nums text-gray-500">→ 평균 {man(avg)}</span>
      </p>
      {hasBank && (
        <p className="text-amber-700">
          통장 급여로 잡힌 달은 근무일지가 아직 없어서예요. 통장 급여는 보통 다음 달 10일쯤 나가서 전달 근무분이에요 — 그 달 근무일지를 올리면 정확해져요.
        </p>
      )}
      {differs && (
        <p className="text-gray-400">
          참고: 인건비를 통장 급여로만 보면 (평균 {man(bankAvg)}) 손익분기는 {man(bankBreakEven!)}이에요.
        </p>
      )}
    </div>
  )
}
