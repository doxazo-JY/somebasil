'use client'

import { useState } from 'react'
import AddStaffModal from './AddStaffModal'

export default function AddStaffButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-[#1a5c3a] text-white text-sm rounded-xl hover:bg-[#154d30] transition-colors"
      >
        + 직원 추가
      </button>
      {open && <AddStaffModal onClose={() => setOpen(false)} />}
    </>
  )
}
