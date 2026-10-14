import Link from 'next/link'
import PageTabs from '@/components/ui/PageTabs'
import MarketingComposer from '@/components/marketing/MarketingComposer'
import PostGroup from '@/components/marketing/PostGroup'
import { getMarketingPosts } from '@/lib/supabase/queries/ai'
import { aiConfigProblem } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

// 마케팅 — 마케팅 AI 초안 (초안 → 승인 → 복사해서 직접 게시 → 게시 완료). 자동 게시 없음
// 넓은 화면: 왼쪽 글 요청(스크롤해도 고정) + 오른쪽 초안 목록 / 폰: 위아래
export default async function MarketingPage() {
  const groups = await getMarketingPosts()
  const drafts = groups.filter((g) => g.posts.some((p) => p.status === 'draft')).length

  return (
    <div className="px-4 pt-16 pb-6 md:px-16 md:pt-8 w-full">
      <PageTabs group="operations" />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          마케팅 <Link href="/inbox" className="ml-1 text-xs font-normal text-gray-400 hover:text-[#1a5c3a]">← 사무실</Link>
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          {drafts > 0 ? `확인할 초안 ${drafts}건` : 'AI가 쓴 초안을 읽고 고쳐서 승인한 뒤 직접 올려요'}
        </p>
      </div>
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6 lg:items-start">
        <div className="lg:sticky lg:top-6">
          <MarketingComposer disabledReason={aiConfigProblem()} />
        </div>
        <div className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">아직 초안이 없어요</p>
          ) : (
            groups.map((g) => <PostGroup key={`${g.posts[0].id}`} {...g} />)
          )}
        </div>
      </div>
    </div>
  )
}
