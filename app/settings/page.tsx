import { redirect } from 'next/navigation'

// 설정(수동 조정·계산 기준)은 데이터 > 데이터 고치기로 옮김 (예전 주소 유지)
export default function SettingsRedirect() {
  redirect('/upload?fix=adjust')
}
