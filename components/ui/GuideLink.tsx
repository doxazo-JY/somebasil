import Link from 'next/link'

// 화면 제목 옆 ? — 그 화면 가이드로 (/guide#id, 내용은 lib/guide.ts)
export default function GuideLink({ id }: { id: string }) {
  return (
    <Link
      href={`/guide#${id}`}
      title="이 화면 가이드"
      aria-label="이 화면 가이드"
      className="inline-grid place-items-center w-5 h-5 ml-1.5 align-middle rounded-full border border-gray-300 text-[11px] font-semibold text-gray-400 hover:border-[#1a5c3a] hover:text-[#1a5c3a]"
    >
      ?
    </Link>
  )
}
