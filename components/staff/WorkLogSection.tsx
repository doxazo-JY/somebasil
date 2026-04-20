'use client'

interface WorkLog {
  id: number
  date: string
  hours_worked: number
}

interface WorkLogSectionProps {
  hourlyPay: number
  sundayHourlyPay: number | null
  taxRate: number
  logs: WorkLog[]
}

export default function WorkLogSection({
  hourlyPay, sundayHourlyPay, taxRate, logs,
}: WorkLogSectionProps) {
  function calcPay() {
    let base = 0
    for (const log of logs) {
      const dow = new Date(log.date).getDay()
      const rate = dow === 0 && sundayHourlyPay ? sundayHourlyPay : hourlyPay
      base += log.hours_worked * rate
    }

    // 주휴수당 (주 15시간 이상인 주)
    const weekMap: Record<number, number> = {}
    for (const log of logs) {
      const d = new Date(log.date)
      const start = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(
        ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7
      )
      weekMap[week] = (weekMap[week] ?? 0) + log.hours_worked
    }

    let allowance = 0
    for (const hrs of Object.values(weekMap)) {
      if (hrs >= 15) allowance += (hrs / 40) * 8 * hourlyPay
    }

    const gross = Math.round(base + allowance)
    const tax = Math.round(gross * (taxRate / 100))
    return { gross, tax, net: gross - tax, allowance: Math.round(allowance) }
  }

  const pay = calcPay()
  const totalHours = logs.reduce((s, l) => s + l.hours_worked, 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '총 근무시간', value: `${totalHours.toFixed(1)}h` },
          { label: '세전 급여', value: `${pay.gross.toLocaleString()}원` },
          { label: `세금 (${taxRate}%)`, value: `${pay.tax.toLocaleString()}원` },
          { label: '실수령액', value: `${pay.net.toLocaleString()}원`, highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${highlight ? 'text-[#1a5c3a]' : 'text-gray-800'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
      {pay.allowance > 0 && (
        <p className="text-xs text-gray-400 pl-1">
          주휴수당 {pay.allowance.toLocaleString()}원 포함
        </p>
      )}
    </div>
  )
}
