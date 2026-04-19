import Link from 'next/link'

const ROLE_LABEL: Record<string, string> = {
  manager: '점장',
  assistant: '매니저',
  part_time: '알바생',
}

interface Staff {
  id: number
  name: string
  role: string
  hire_date: string
  hourly_pay: number
  is_active: boolean
}

interface StaffTableProps {
  data: Staff[]
}

export default function StaffTable({ data }: StaffTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-400 font-medium">
            <th className="text-left px-6 py-3">이름</th>
            <th className="text-left px-4 py-3">직책</th>
            <th className="text-left px-4 py-3">입사일</th>
            <th className="text-right px-4 py-3">시급</th>
            <th className="text-center px-4 py-3">상태</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((staff) => (
            <tr key={staff.id} className="hover:bg-gray-50/50">
              <td className="px-6 py-3.5 font-medium text-gray-800">{staff.name}</td>
              <td className="px-4 py-3.5 text-gray-500">{ROLE_LABEL[staff.role] ?? staff.role}</td>
              <td className="px-4 py-3.5 text-gray-500">{staff.hire_date}</td>
              <td className="px-4 py-3.5 text-right text-gray-700">
                {staff.hourly_pay.toLocaleString()}원
              </td>
              <td className="px-4 py-3.5 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  staff.is_active
                    ? 'bg-green-50 text-[#1a5c3a]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {staff.is_active ? '재직중' : '퇴직'}
                </span>
              </td>
              <td className="px-4 py-3.5 text-right">
                <Link
                  href={`/staff/${staff.id}`}
                  className="text-xs text-gray-400 hover:text-[#1a5c3a]"
                >
                  →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
