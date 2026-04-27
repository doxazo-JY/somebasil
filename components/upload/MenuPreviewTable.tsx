'use client'

import type { MenuRow } from '@/app/api/upload/menu/route'

interface Props {
  rows: MenuRow[]
  saving: boolean
  onSave: () => void
}

export default function MenuPreviewTable({ rows, saving, onSave }: Props) {
  const activeCount = rows.filter((r) => r.is_active).length
  const inactiveCount = rows.length - activeCount
  const total = rows.length

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">메뉴 마스터 미리보기</p>
        <button
          onClick={onSave}
          disabled={saving || rows.length === 0}
          className="text-xs px-4 py-1.5 rounded-lg bg-[#1a5c3a] text-white hover:bg-[#154d30] disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400">전체</p>
          <p className="text-sm text-gray-800 font-semibold">{total.toLocaleString()}개</p>
        </div>
        <div className="bg-green-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400">사용 (Y)</p>
          <p className="text-sm text-[#1a5c3a] font-semibold">{activeCount.toLocaleString()}개</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400">단종 (N)</p>
          <p className="text-sm text-gray-500 font-semibold">{inactiveCount.toLocaleString()}개</p>
        </div>
      </div>

      {/* 라인 (스크롤) */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[80px_60px_1fr_80px] text-[10px] text-gray-400 uppercase tracking-wider px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span>ID</span>
          <span>상태</span>
          <span>명칭</span>
          <span className="text-right">단가</span>
        </div>
        <ul className="max-h-[420px] overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-[80px_60px_1fr_80px] items-center gap-2 px-3 py-1.5 text-sm border-b border-gray-50 last:border-b-0"
            >
              <span className="text-gray-400 tabular-nums text-xs">{r.id}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded w-fit ${
                  r.is_active
                    ? 'bg-[#1a5c3a]/10 text-[#1a5c3a]'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {r.is_active ? '사용' : '단종'}
              </span>
              <span className={r.is_active ? 'text-gray-800' : 'text-gray-400'}>
                {r.name}
              </span>
              <span className="text-gray-700 tabular-nums text-right text-xs">
                {r.price > 0 ? `${r.price.toLocaleString()}원` : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-gray-400 mt-3 [word-break:keep-all]">
        ※ ID 기준 upsert. 기존 메뉴는 명칭/단가/상태가 덮어쓰기됩니다. 죽은 메뉴 분석 유니버스는 <strong>사용(Y)</strong>인 메뉴만 사용.
      </p>
    </div>
  )
}
