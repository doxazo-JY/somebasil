import Link from 'next/link'
import PageTabs from '@/components/ui/PageTabs'
import MarketingComposer from '@/components/marketing/MarketingComposer'
import PostGroup from '@/components/marketing/PostGroup'
import { getMarketingPosts } from '@/lib/supabase/queries/ai'
import { aiConfigProblem } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

// 마케팅 — 마케팅 AI 초안 (초안 → 승인 → 복사해서 직접 게시 → 게시 완료). 자동 게시 없음
// 맨 위 새 글 요청 한 줄 → 확인할 초안(초안·승인) 2열 → 올린 글(인스타·블로그 다 올린 것) 접어 둠
export default async function MarketingPage() {
  const groups = await getMarketingPosts()
  const active = groups.filter((g) => g.posts.some((p) => p.status !== 'posted'))
  const done = groups.filter((g) => g.posts.every((p) => p.status === 'posted'))
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

      <div className="space-y-5">
        <MarketingComposer disabledReason={aiConfigProblem()} />

        {active.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">확인할 초안이 없어요</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4 items-stretch">
            {active.map((g) => (
              <PostGroup key={`${g.posts[0].id}`} {...g} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-700 list-none">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span> 올린 글 {done.length}개
            </summary>
            <div className="grid lg:grid-cols-2 gap-4 items-stretch mt-3">
              {done.map((g) => (
                <PostGroup key={`${g.posts[0].id}`} {...g} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
