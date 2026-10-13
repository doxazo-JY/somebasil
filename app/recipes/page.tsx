import { redirect } from 'next/navigation'

// 메뉴 원가는 메뉴 > 원가로 옮김 (예전 주소·업무함 링크 유지)
export default function RecipesRedirect() {
  redirect('/menu?view=cost')
}
