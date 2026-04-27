'use client'

// 메뉴 마스터 관리 — /upload 메뉴 마스터 탭에서 노출
// 표 형태: 1열 마스터명 (정렬), 2열 매칭 POS 이름 chips + ✏️, 3열 활성 토글

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import MatchMenuButton from './MatchMenuButton'
import { stripVariantSuffix } from '@/lib/menu-utils'
import type { MasterProduct } from '@/lib/supabase/queries/menu'

interface Props {
  products: MasterProduct[]
}

type SortDir = 'asc' | 'desc'

export default function MasterManager({ products }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [onlyCleanup, setOnlyCleanup] = useState(false)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [toggling, setToggling] = useState<string | null>(null)

  // 활성 마스터끼리 정규화 키 충돌 감지
  const conflictKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      if (!p.is_active) continue
      const key = stripVariantSuffix(p.name)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return new Set(
      [...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k),
    )
  }, [products])

  function isCleanupCandidate(p: MasterProduct): boolean {
    if (!p.is_active) return false
    const key = stripVariantSuffix(p.name)
    if (conflictKeys.has(key)) return true // 키 충돌
    if (p.matches.length === 0) return true // 매칭 0개
    return false
  }

  const visible = useMemo(() => {
    const f = products.filter((p) => {
      if (!showInactive && !p.is_active) return false
      if (onlyCleanup && !isCleanupCandidate(p)) return false
      if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false
      return true
    })
    f.sort((a, b) =>
      sortDir === 'asc'
        ? a.name.localeCompare(b.name, 'ko')
        : b.name.localeCompare(a.name, 'ko'),
    )
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, showInactive, sortDir, onlyCleanup, conflictKeys])

  const cleanupCount = products.filter(isCleanupCandidate).length

  async function toggleActive(p: MasterProduct) {
    setToggling(p.id)
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('저장 실패')
      }
    } finally {
      setToggling(null)
    }
  }

  const activeCount = products.filter((p) => p.is_active).length
  const inactiveCount = products.length - activeCount

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mt-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-gray-700">
          메뉴 마스터 관리{' '}
          <span className="text-xs text-gray-400 font-normal">
            ({activeCount}개 활성{inactiveCount > 0 && ` · ${inactiveCount}개 비활성`})
          </span>
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={onlyCleanup}
              onChange={(e) => setOnlyCleanup(e.target.checked)}
              className="rounded"
            />
            정리 필요만 보기
            {cleanupCount > 0 && (
              <span className="text-amber-600 font-medium">({cleanupCount})</span>
            )}
          </label>
          <label className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            비활성 포함
          </label>
        </div>
      </div>

      <input
        type="text"
        placeholder="메뉴 이름 검색"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
      />

      <div className="max-h-[520px] overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {filter ? '검색 결과 없음' : '메뉴 없음'}
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[11px] text-gray-400 tracking-wider border-b border-gray-100">
                <th className="text-left py-2 pr-2 font-medium w-[35%]">
                  <button
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="hover:text-gray-700 inline-flex items-center gap-1"
                  >
                    메뉴 마스터
                    <span>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  </button>
                </th>
                <th className="text-left py-2 px-2 font-medium">매칭된 POS 이름</th>
                <th className="text-right py-2 pl-2 font-medium w-20">활성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((p) => {
                const stripped = stripVariantSuffix(p.name)
                const hasConflict = p.is_active && conflictKeys.has(stripped)
                const isEmpty = p.is_active && p.matches.length === 0
                return (
                <tr
                  key={p.id}
                  className={!p.is_active ? 'opacity-50' : ''}
                >
                  {/* 1열: 마스터 이름 */}
                  <td className="py-2 pr-2 align-middle text-gray-800">
                    <span className="[word-break:keep-all]">{p.name}</span>
                    {hasConflict && (
                      <span
                        className="ml-1.5 text-[10px] text-amber-600"
                        title="다른 활성 마스터와 정규화 키 충돌 — 한쪽 비활성화 권장"
                      >
                        ⚠ 키 충돌
                      </span>
                    )}
                    {!hasConflict && isEmpty && (
                      <span
                        className="ml-1.5 text-[10px] text-gray-400"
                        title="POS 매출에 매칭되는 거래가 없음 — 단종된 메뉴거나 비활성화 후보"
                      >
                        ◌ 매칭 없음
                      </span>
                    )}
                  </td>

                  {/* 2열: 매칭된 POS 이름 chips + ✏️ */}
                  <td className="py-2 px-2 align-middle">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.matches.length === 0 ? (
                        <span className="text-[11px] text-gray-300">—</span>
                      ) : (
                        p.matches.map((m) => (
                          <span
                            key={m.pos_name}
                            className={`text-[11px] px-1.5 py-0.5 rounded [word-break:keep-all] ${
                              m.via === 'alias'
                                ? 'bg-[#1a5c3a]/10 text-[#1a5c3a]'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title={m.via === 'alias' ? '수동 매칭' : '자동 정규화 매칭'}
                          >
                            {m.pos_name}
                          </span>
                        ))
                      )}
                      <MatchMenuButton productId={p.id} productName={p.name} />
                    </div>
                  </td>

                  {/* 3열: 활성/비활성 토글 */}
                  <td className="py-2 pl-2 align-middle text-right">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={toggling === p.id}
                      className={`text-[10px] px-2 py-1 rounded shrink-0 disabled:opacity-50 ${
                        p.is_active
                          ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          : 'text-[#1a5c3a] hover:bg-[#1a5c3a]/10'
                      }`}
                      title={p.is_active ? '비활성화' : '다시 활성화'}
                    >
                      {p.is_active ? '비활성화' : '재활성'}
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-3 [word-break:keep-all]">
        ※{' '}
        <span className="px-1 rounded bg-[#1a5c3a]/10 text-[#1a5c3a]">초록</span>{' '}
        = 수동 매칭 ·{' '}
        <span className="px-1 rounded bg-gray-100 text-gray-500">회색</span>{' '}
        = 자동 정규화 매칭. 잘못 매칭된 게 보이면 ✏️로 수정 또는 비활성화.
      </p>
    </div>
  )
}
