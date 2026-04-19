'use client'

import { useState } from 'react'
import EditStaffModal from './EditStaffModal'

interface Staff {
  id: number
  name: string
  role: string
  hire_date: string
  leave_date?: string | null
  hourly_pay: number
  sunday_hourly_pay?: number | null
  tax_rate: number
  is_active: boolean
}

export default function EditStaffButton({ staff }: { staff: Staff }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
      >
        ✏️ 정보 수정
      </button>
      {open && <EditStaffModal staff={staff} onClose={() => setOpen(false)} />}
    </>
  )
}
