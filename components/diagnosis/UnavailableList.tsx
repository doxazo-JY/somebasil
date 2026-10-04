// 진단표 요청 항목 중 아직 못 만드는 것 + 이유
// 데이터가 들어오면 풀리는 것 / 시스템 밖의 것을 구분

interface Item {
  title: string
  reason: string
  unlock?: string
}

const WAITING: Item[] = [
  {
    title: '메뉴별 수익 매트릭스 (A·B·C·D 분류)',
    reason: '판매량은 있지만 메뉴별 원가가 대부분 비어 있어 "이익이 좋은 메뉴"를 판단할 수 없음',
    unlock: '점장 레시피·원가 엑셀 업로드 → 등록 메뉴 매출 비중 80% 이상이면 표시',
  },
  {
    title: '시간대별 인건비 효율 (시간대 매출 ÷ 인건비)',
    reason: '시간대별 매출은 있지만 누가 몇 시에 일했는지 근무 기록이 쌓여 있지 않음',
    unlock: '직원 메뉴에서 근무 기록 입력 (회계사 데이터 대기 중)',
  },
  {
    title: '임대료 · 카드수수료 · 광고비 따로 보기',
    reason:
      '통장 분류가 "고정비" 하나로 묶여 있음. 카드수수료는 카드사가 떼고 입금해서 통장에 지출로 찍히지 않음',
    unlock: '지출 카테고리를 세분화하고 파싱 규칙 추가',
  },
  {
    title: '사장님 인건비 차감 후 실질 이익',
    reason: '사장님 개인 이체는 "제외"로 빠지고, 사장님 몫 인건비는 어디에도 따로 잡혀 있지 않음',
    unlock: '설정에서 사장님 월 인건비(가정값)를 입력받도록 추가',
  },
  {
    title: '폐기율',
    reason: '버린 재료·디저트 기록이 어디에도 없음',
    unlock: '폐기 기록 입력 화면 추가 (매장에서 매일 기록해야 함)',
  },
]

const OUT_OF_SCOPE: Item[] = [
  {
    title: '신규 / 재방문 / 단골 고객',
    reason: 'POS 데이터에 고객 식별 정보(회원·전화번호)가 없어 같은 사람이 다시 왔는지 알 수 없음',
  },
  {
    title: '상권 · 유동인구 · 경쟁 카페',
    reason: '매장 밖 데이터라 이 시스템에 들어오지 않음. 직접 조사하거나 외부 상권분석 서비스 활용',
  },
  {
    title: '리뷰 · SNS 반응',
    reason: '네이버 지도·인스타그램 데이터는 수집하지 않음',
  },
  {
    title: '차별화 전략 · 3개월 실행계획',
    reason: '숫자로 계산하는 영역이 아니라 사장님·점장이 정할 내용. 이 페이지 숫자를 근거로 활용',
  },
]

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.title} className="text-sm [word-break:keep-all]">
          <p className="font-medium text-gray-700">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
          {item.unlock && <p className="text-xs text-[#1a5c3a] mt-0.5">→ {item.unlock}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function UnavailableList() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
      <p className="text-sm font-semibold text-gray-700">아직 못 보는 것과 이유</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-5">수익 개선 진단표 항목 중 지금 데이터로 계산할 수 없는 것</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-3">데이터가 들어오면 가능</p>
          <ItemList items={WAITING} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-3">이 시스템 밖의 영역</p>
          <ItemList items={OUT_OF_SCOPE} />
        </div>
      </div>
    </div>
  )
}
