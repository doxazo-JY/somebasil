'use client'

// 죽은 메뉴 행에서 POS 이름과 수동 매칭하는 모달 트리거
// 클릭 → 모달 열림 → 매칭 안 된 POS 이름 검색/선택 → product_aliases에 저장

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  productId: string
  productName: string
}

interface Candidate {
  pos_name: string
  quantity: number
  lastDate: string
  matchedMasterName: string | null
  matchedVia: 'master' | 'alias' | null
}

export default function MatchMenuButton({ productId, productName }: Props) {
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [didChange, setDidChange] = useState(false)
  const router = useRouter()

  async function openModal() {
    setOpen(true)
    setLoading(true)
    setFilter('')
    setDidChange(false)
    try {
      const res = await fetch('/api/menu-alias', { cache: 'no-store' })
      const json = await res.json()
      setCandidates(json.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setOpen(false)
    if (didChange) router.refresh() // 변경 있을 때만 페이지 새로고침
  }

  async function selectMatch(c: Candidate) {
    // 이미 자기 마스터에 매칭된 거면 해제 (toggle off)
    const isSelfMatched = c.matchedMasterName === productName
    if (isSelfMatched) {
      setSaving(c.pos_name)
      try {
        const res = await fetch(
          `/api/menu-alias?pos_name=${encodeURIComponent(c.pos_name)}`,
          { method: 'DELETE' },
        )
        if (res.ok) {
          setCandidates((prev) =>
            prev.map((x) =>
              x.pos_name === c.pos_name
                ? { ...x, matchedMasterName: null, matchedVia: null }
                : x,
            ),
          )
          setDidChange(true)
        } else {
          alert('해제 실패')
        }
      } finally {
        setSaving(null)
      }
      return
    }

    // 이미 다른 마스터에 매칭된 거면 confirm
    if (
      c.matchedMasterName &&
      c.matchedMasterName !== productName &&
      !confirm(
        `이 POS 이름은 현재 "${c.matchedMasterName}"에 매칭되어 있습니다.\n"${productName}"로 옮기시겠어요?`,
      )
    ) {
      return
    }

    setSaving(c.pos_name)
    try {
      const res = await fetch('/api/menu-alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, pos_name: c.pos_name }),
      })
      if (res.ok) {
        // 모달 안 닫고 즉시 candidates 갱신 — 여러 개 연속 매칭 가능
        setCandidates((prev) =>
          prev.map((x) =>
            x.pos_name === c.pos_name
              ? { ...x, matchedMasterName: productName, matchedVia: 'alias' }
              : x,
          ),
        )
        setDidChange(true)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`저장 실패: ${err.error ?? res.statusText}`)
      }
    } finally {
      setSaving(null)
    }
  }

  const filtered = filter
    ? candidates.filter((c) =>
        c.pos_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : candidates

  return (
    <>
      <button
        onClick={openModal}
        className="text-[11px] text-gray-300 hover:text-[#1a5c3a] shrink-0 px-1"
        title="POS 이름과 수동 매칭"
      >
        ✏️
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 max-w-md w-full p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 mb-1">메뉴 매칭</p>
            <p className="text-xs text-gray-500 mb-3 [word-break:keep-all]">
              <strong className="text-gray-700">{productName}</strong>에 매칭할 POS 이름을 클릭 (여러 개 가능). 체크된 항목 다시 클릭하면 해제.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="POS 이름 검색"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-[#1a5c3a]"
            />
            <div className="max-h-72 overflow-y-auto">
              {loading && (
                <p className="text-sm text-gray-400 text-center py-4">로딩 중...</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {filter ? '검색 결과 없음' : '매칭 안 된 POS 이름 없음'}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {filtered.map((c) => {
                  const isMatched = c.matchedMasterName !== null
                  const isSelfMatched = c.matchedMasterName === productName
                  // 직접 정규화 매칭 (master)은 alias 우선이므로 자기 마스터 아니면 해제 불가
                  const isOtherMasterDirect =
                    c.matchedVia === 'master' && !isSelfMatched
                  return (
                    <li key={c.pos_name}>
                      <button
                        onClick={() => selectMatch(c)}
                        disabled={saving !== null}
                        className={`w-full text-left flex flex-col gap-0.5 px-3 py-2 rounded-lg border disabled:opacity-50 ${
                          isSelfMatched
                            ? 'border-[#1a5c3a]/30 bg-[#1a5c3a]/5 hover:bg-[#1a5c3a]/10'
                            : isMatched
                              ? 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                              : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`flex-1 truncate text-sm ${
                              isSelfMatched
                                ? 'text-[#1a5c3a] font-medium'
                                : isMatched
                                  ? 'text-gray-500'
                                  : 'text-gray-800'
                            }`}
                          >
                            {isSelfMatched && '✓ '}
                            {c.pos_name}
                          </span>
                          <span className="text-[11px] text-gray-400 shrink-0 tabular-nums [word-break:keep-all]">
                            {c.quantity}건 · {c.lastDate.slice(5).replace('-', '/')}
                          </span>
                        </div>
                        {isMatched && !isSelfMatched && (
                          <p className="text-[10px] text-gray-400 [word-break:keep-all]">
                            현재 <strong>{c.matchedMasterName}</strong>에 매칭됨
                            {c.matchedVia === 'alias' && ' (수동)'}
                            {isOtherMasterDirect && ' (자동)'}
                          </p>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={closeModal}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
