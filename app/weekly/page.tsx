import WeeklySection from '@/components/dashboard/WeeklySection'
import { getWeeklySummary } from '@/lib/supabase/queries/weekly'

export default async function WeeklyPage() {
  const weeklyData = await getWeeklySummary(8)

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">주간 현황</h1>
        <p className="text-sm text-gray-400 mt-0.5">주별 매출 · 지출 · 손익 추이</p>
      </div>

      <WeeklySection data={weeklyData} />
    </div>
  )
}
