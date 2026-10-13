import PageTabs from '@/components/ui/PageTabs'
import OfficeView from '@/components/office/OfficeView'
import { getInbox, getRecentRuns } from '@/lib/supabase/queries/ai'
import { aiConfigProblem } from '@/lib/ai/client'
import { kstDate } from '@/lib/attendance/tokens'

export const dynamic = 'force-dynamic'

// AI 사무실 (= 업무함) — AI 업무팀 책상, 누르면 그 AI가 올린 챙길 일만 (점장용, 폰에서도 봄)
// 주소는 /inbox 유지 (업무함 항목·알림 링크 호환)
export default async function OfficePage() {
  const [{ open, closed }, runs] = await Promise.all([getInbox(), getRecentRuns(40)])

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full max-w-3xl">
      <PageTabs group="operations" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">AI 사무실</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          {open.length > 0 ? `챙길 일 ${open.length}건 · 책상을 누르면 그 AI가 올린 것만 보여요` : '매일 아침 8시에 AI 업무팀이 점검해요'}
        </p>
      </div>
      <OfficeView open={open} closed={closed} runs={runs} today={kstDate(new Date())} configProblem={aiConfigProblem()} />
    </div>
  )
}
