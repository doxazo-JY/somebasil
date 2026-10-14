import Link from 'next/link'

// 화면 제목 옆 "? 가이드" — 그 화면 가이드로 (/guide#id, 내용은 lib/guide.ts)
export default function GuideLink({ id }: { id: string }) {
  return (
    <Link
      href={`/guide#${id}`}
      title="이 화면 가이드"
      className="inline-flex items-center gap-1 ml-2 align-middle rounded-full bg-[#e6f0ea] px-2 py-0.5 text-xs font-semibold text-[#1a5c3a] hover:bg-[#d3e6da]"
    >
      <span className="grid place-items-center w-4 h-4 rounded-full bg-[#1a5c3a] text-white text-[10px] leading-none">?</span>
      가이드
    </Link>
  )
}
