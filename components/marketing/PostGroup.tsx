'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MarketingPost } from '@/lib/supabase/queries/ai'

const STATUS = {
  draft: { label: '초안', cls: 'border border-dashed border-gray-300 text-gray-500' },
  approved: { label: '승인됨', cls: 'bg-[#e6f0ea] text-[#1a5c3a]' },
  posted: { label: '게시 완료', cls: 'bg-gray-100 text-gray-500' },
} as const

const CHANNEL = { instagram: '인스타그램', blog: '네이버 블로그' } as const

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(iso))
}

// 한 주제의 인스타·블로그 초안 묶음 — 탭으로 전환, 수정 → 승인 → 복사 → 게시 완료
// 2열 카드에서 높이가 맞도록 본문 칸 높이 고정 (긴 글은 칸 안에서 스크롤)
export default function PostGroup({ topic, source, created_at, posts }: { topic: string; source: 'auto' | 'manual'; created_at: string; posts: MarketingPost[] }) {
  const [active, setActive] = useState(posts[0]?.id)
  const post = posts.find((p) => p.id === active) ?? posts[0]
  if (!post) return null

  return (
    <article className="bg-white rounded-xl border border-gray-100 h-full flex flex-col">
      <div className="px-5 pt-4 pb-3 space-y-1">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span>{fmtDate(created_at)}</span>
          <span>·</span>
          <span>{source === 'auto' ? '경영 AI 추천 주제' : '직접 요청'}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 [word-break:keep-all]">{topic}</p>
      </div>
      <div className="px-5 flex gap-4 border-b border-gray-100 text-sm" role="tablist">
        {posts.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === post.id}
            onClick={() => setActive(p.id)}
            className={`pb-2 -mb-px border-b-2 flex items-center gap-1.5 ${p.id === post.id ? 'border-[#1a5c3a] text-gray-900 font-semibold' : 'border-transparent text-gray-400'}`}
          >
            {CHANNEL[p.channel]}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
          </button>
        ))}
      </div>
      <PostEditor key={post.id} post={post} />
    </article>
  )
}

function PostEditor({ post }: { post: MarketingPost }) {
  const router = useRouter()
  const [title, setTitle] = useState(post.title ?? '')
  const [body, setBody] = useState(post.body)
  const [hashtags, setHashtags] = useState(post.hashtags ?? '')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = body !== post.body || title !== (post.title ?? '') || hashtags !== (post.hashtags ?? '')
  const hasBlank = /\[[^\]]+\]/.test(body + title)

  async function patch(updates: object) {
    setBusy(true)
    await fetch('/api/ai/marketing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, ...updates }),
    })
    setBusy(false)
    router.refresh()
  }

  async function copy() {
    const text = [post.channel === 'blog' ? title : null, body, post.channel === 'instagram' ? hashtags : null].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function remove() {
    await fetch('/api/ai/marketing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id }),
    })
    router.refresh()
  }

  const field = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]'
  const locked = post.status === 'posted'

  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      {post.channel === 'blog' && (
        <input id={`post-title-${post.id}`} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} className={`${field} font-semibold`} aria-label="블로그 제목" />
      )}
      <textarea
        id={`post-body-${post.id}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={locked}
        rows={10}
        className={`${field} leading-relaxed resize-none flex-1 min-h-[220px]`}
        aria-label="본문"
      />
      {post.channel === 'instagram' && (
        <input id={`post-tags-${post.id}`} value={hashtags} onChange={(e) => setHashtags(e.target.value)} disabled={locked} className={`${field} text-[#1a5c3a]`} aria-label="해시태그" />
      )}
      {hasBlank && post.status === 'draft' && (
        <p className="text-xs text-amber-700 [word-break:keep-all]">[대괄호] 칸은 AI가 지어내지 않고 비워 둔 곳이에요. 내용을 채운 뒤 승인해 주세요.</p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {post.status === 'draft' &&
          (confirmDelete ? (
            <span className="mr-auto flex items-center gap-1 text-xs text-gray-500">
              삭제할까요?
              <button onClick={remove} disabled={busy} className="px-2 py-1.5 rounded-lg text-red-500 font-semibold hover:bg-red-50">삭제</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100">취소</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 mr-auto">삭제</button>
          ))}
        {dirty && !locked && (
          <button onClick={() => patch({ title, body, hashtags })} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            수정 저장
          </button>
        )}
        {post.status === 'draft' && (
          <button onClick={() => patch({ title, body, hashtags, status: 'approved' })} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">
            승인
          </button>
        )}
        {post.status !== 'draft' && (
          <>
            {post.status === 'approved' && (
              <button onClick={() => patch({ status: 'draft' })} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 mr-auto">초안으로</button>
            )}
            <button onClick={copy} className="text-xs px-3 py-1.5 rounded-lg border border-[#1a5c3a] text-[#1a5c3a] hover:bg-[#e6f0ea]">
              {copied ? '복사됐어요' : '복사하기'}
            </button>
            {post.status === 'approved' && (
              <button onClick={() => patch({ status: 'posted' })} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50">
                올렸어요
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
