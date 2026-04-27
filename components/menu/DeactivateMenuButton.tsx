'use client'

// 마스터 비활성화 버튼 — 죽은 메뉴 행에서 직접 비활성화
// 자주 쓰는 워크플로 (단종/중복 마스터 청소)를 죽은 메뉴 흐름에 직접 박음

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  productId: string
  productName: string
}

export default function DeactivateMenuButton({ productId, productName }: Props) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function deactivate() {
    if (!confirm(`"${productName}"을(를) 비활성화하시겠어요?\n죽은 메뉴 리스트에서 빠지고, 다시 활성화는 메뉴 마스터 관리에서 가능합니다.`)) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, is_active: false }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('비활성화 실패')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={deactivate}
      disabled={busy}
      className="text-[11px] text-gray-300 hover:text-red-500 shrink-0 px-1 disabled:opacity-50"
      title="이 마스터 비활성화 (죽은 메뉴 청소)"
    >
      🗑
    </button>
  )
}
