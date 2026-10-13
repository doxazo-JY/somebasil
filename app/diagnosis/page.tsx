import { redirect } from 'next/navigation'

// 수익 진단은 손익 > 흑자 조건으로 옮김 (예전 주소 유지)
export default function DiagnosisRedirect() {
  redirect('/profit?view=check')
}
