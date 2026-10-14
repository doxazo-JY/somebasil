import Link from 'next/link'
import { GUIDE } from '@/lib/guide'

// 가이드 — 화면별 "언제 보나 / 뭐가 있나 / 자주 하는 일" (내용은 lib/guide.ts, 비서 AI도 같은 내용을 씀)
// 각 화면 제목 옆 ? → /guide#화면id
export default function GuidePage() {
  const groups = ['공통', '운영', '분석', '데이터'] as const
  return (
    <div className="px-4 pt-16 pb-10 md:px-16 md:pt-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">가이드</h1>
        <p className="text-sm text-gray-400 mt-0.5 [word-break:keep-all]">
          화면마다 언제 보는지, 뭐가 있는지, 자주 하는 일을 모았어요. 찾기 어려우면 오른쪽 아래 로고 버튼으로 비서 AI에게 물어보세요.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        {/* 목차 */}
        <nav className="mb-6 lg:mb-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5 text-sm">
            {groups.map((g) => (
              <li key={g} className="contents lg:block">
                <p className="hidden lg:block text-[11px] text-gray-400 mt-3 mb-1 first:mt-0">{g}</p>
                <ul className="contents lg:block">
                  {GUIDE.filter((s) => s.group === g).map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="block px-2.5 py-1 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 lg:border-0">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-5 max-w-4xl">
          {GUIDE.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 bg-white rounded-xl border border-gray-100 px-5 py-5 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[11px] text-gray-400">{s.group}</p>
                  <h2 className="text-lg font-bold text-gray-900">{s.title}</h2>
                </div>
                {s.id !== 'basics' && (
                  <Link href={s.path} className="text-xs text-[#1a5c3a] hover:underline">
                    이 화면 열기 →
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed [word-break:keep-all]">{s.summary}</p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">언제 보나</span> · {s.when}
              </p>

              <dl className="space-y-2">
                {s.parts.map((p) => (
                  <div key={p.name} className="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-sm">
                    <dt className="font-medium text-gray-800 [word-break:keep-all]">{p.name}</dt>
                    <dd className="text-gray-600 leading-relaxed [word-break:keep-all]">{p.desc}</dd>
                  </div>
                ))}
              </dl>

              {s.tasks.length > 0 && (
                <div className="rounded-lg bg-[#f4f9f6] border border-[#1a5c3a]/15 px-4 py-3 space-y-2">
                  <p className="text-[11px] font-semibold text-[#1a5c3a]">자주 하는 일</p>
                  {s.tasks.map((t) => (
                    <div key={t.q} className="text-sm [word-break:keep-all]">
                      <p className="font-medium text-gray-900">{t.q}</p>
                      <p className="text-gray-600 leading-relaxed">{t.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
