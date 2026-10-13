import PageTabs from '@/components/ui/PageTabs'
import AgentPanel from '@/components/inbox/AgentPanel'
import InboxList from '@/components/inbox/InboxList'
import { getInbox, getRecentRuns } from '@/lib/supabase/queries/ai'

export const dynamic = 'force-dynamic'

// AI 업무함 — AI 업무팀이 점검해서 챙길 일만 올리는 곳 (점장용, 폰에서도 봄)
export default async function InboxPage() {
  const [{ open, closed }, runs] = await Promise.all([getInbox(), getRecentRuns(10)])
  const hasKey = !!process.env.ANTHROPIC_API_KEY

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full max-w-3xl">
      <PageTabs group="operations" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">업무함</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          {open.length > 0 ? `챙길 일 ${open.length}건` : 'AI가 점검해서 챙길 일만 올려요'}
        </p>
      </div>
      <div className="space-y-4">
        <AgentPanel runs={runs} hasKey={hasKey} />
        <InboxList open={open} closed={closed} />
      </div>
    </div>
  )
}
