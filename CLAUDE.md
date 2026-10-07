@AGENTS.md


# 카페 썸바실 관리 플랫폼

## 프로젝트 개요
카페 재무 데이터를 한눈에 파악하고, 적자 원인을 데이터로 찾을 수 있는 웹 플랫폼.
복잡하지 않게. 대시보드 열면 지금 상황이 바로 보여야 한다.

## 기술 스택
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL)
- 배포: Vercel
- 차트: Recharts

## 디자인 원칙
- 전체 화이트 / 라이트 그레이 베이스
- 사이드바도 화이트 계열, 선택된 메뉴만 다크 그린 포인트 컬러로 강조
- 포인트 컬러: 다크 그린 계열 (#1a5c3a 또는 유사한 톤)
- 카드 기반 레이아웃, 얇은 테두리나 배경색 차이로 구분
- 숫자 카드가 먼저 눈에 들어오는 구조
- 차트는 라인차트 / 도넛차트 중심
- 한 화면에 너무 많은 정보 넣지 않기

## 절대 하지 말 것
- 막대그래프(Bar Chart) 메인으로 사용 금지 — 라인/도넛 차트 우선
- 다크 사이드바 금지
- 페이지마다 같은 차트 구조 반복 금지
- 불필요한 애니메이션 금지

## 페이지 구성 (3개 그룹 IA — 4/25, 4/27 정착)

**운영** (매일/매주):
- `/` — 대시보드 (월간 콕핏)
- `/weekly` — 주간 (목요일 보고용)

**결산** (월말/분기):
- `/profit` — 손익 (YTD)
- `/expenses` — 지출
- `/menu` — 메뉴 분석 (히트맵 / 죽은 메뉴)
- `/recipes` — 메뉴 원가
- `/diagnosis` — 수익 진단 (고정비/변동비 손익분기 · 하루 필요 고객 · 목표 이익 · 고객수×객단가 · 시간대별 매출 vs 알바 인원 · 못 보는 항목과 이유)

**관리**:
- `/upload` — 업로드 + 거래 재분류(통장 탭) + 마스터 관리(메뉴 탭) + 근무일지 탭
- `/staff` — 직원 (조회 전용: KPI · 직원×월 근무시간/지급액 · 목록). 데이터는 근무일지 업로드로만 들어옴. `/staff/[id]` 상세는 링크 숨김 (수동 출퇴근 입력 미정비)
- `/settings` — 설정 (대표 토글, 수동 조정)

## 사이드바 (3개 그룹) + PageTabs (그룹 내)
- 사이드바: 운영 / 결산 / 관리
- 페이지 상단 PageTabs로 그룹 내 이동
- 사이드바·PageTabs 모두 `?year=&month=` 쿼리 유지 (기간 컨텍스트 이어감)

## 컴포넌트 구조 원칙
- 페이지당 컴포넌트 분리 철저히
- 공통 컴포넌트는 /components/ui에
- 페이지별 컴포넌트는 /components/[페이지명]에
- Supabase 쿼리는 /lib/supabase에 모아서 관리

## 코드 컨벤션
- 주석은 한국어로
- 컴포넌트명은 PascalCase 영어
- 파일명은 kebab-case 영어

## 데이터베이스 스키마 (Supabase)

### monthly_summary — 월별 요약
- id, year, month, income, total_expense, profit(자동계산), created_at
- UNIQUE (year, month)

### monthly_expenses — 월별 지출 항목 명세
- id, year, month, category, item, amount, created_at
- category: 'ingredients_cash'(재료비-현금) | 'ingredients_card'(재료비-카드) | 'labor'(인건비) | 'fixed'(고정비) | 'equipment'(설비투자) | 'excluded'(제외)
- ※ 4/30 'card'(카드대금) 폐기 — catch-all = 사실상 재료비(카드). 기존 데이터는 `recalcAllMonths()`에서 ingredients_card로 1회 마이그레이션 (idempotent)

### staff — 직원 정보
- id, name, role, hire_date, leave_date, hourly_pay, sunday_hourly_pay, tax_rate, is_active, created_at
- role: 'manager'(점장) | 'assistant'(매니저) | 'part_time'(알바생)
- 근무일지 업로드가 이름으로 매칭/자동 등록 (part_time). is_active = 파일 마지막 달에 근무 있음

### work_logs — 출퇴근 기록 (근무일지 업로드)
- id, staff_id(→staff), date, start_time, end_time, hours_worked, hourly_rate, created_at
- ⚠️ hours_worked = DB generated column → insert 시 넣으면 에러. `/api/work-logs` POST(구 수동 입력)가 아직 넣고 있어서 깨져 있음 (staff 상세 페이지 재사용 시 수정 필요)
- hourly_rate = 근무 당시 시급 (평일/주일 블록·연도별로 다름, 10/4 컬럼 추가). 시간대별 인건비 계산은 이 값 우선, 없으면 staff 시급
- 업로드 = 파일에 포함된 월 × 파일 속 직원 기록을 delete 후 insert (재업로드 idempotent, 트랜잭션 아님)

### staff_salary — 직원별 월별 인건비 (계산 전용)
- id, staff_id(→staff), year, month, amount, created_at
- UNIQUE (staff_id, year, month)
- ⚠️ 지출 집계에 사용하지 않음 — "이번 달 이 직원한테 얼마 줘야 하나" 계산 전용
- ⚠️ 정의 2개 공존: 근무일지 업로드 = Σ(시간×블록 시급), 주휴 제외 (엑셀 "총 지급액" 기준) / 구 `/api/work-logs` 재계산 = 주휴수당 포함. 현재는 업로드만 사용
- 실제 인건비 지출은 통장 거래내역 업로드 시 monthly_expenses.labor로 기록됨

### daily_sales — POS 상품 라인 단위 매출
- id, date, order_id, line_no, product_name, category, quantity, amount, order_time, source, created_at
- category: 'coffee' | 'drip_coffee' | 'dutch_coffee' | 'matcha' | 'beverage' | 'ade' | 'tea' | 'dessert' | 'season' | 'etc'
- source: 'pos' (POS 업로드) | 'bank' (레거시, 4/22 이후 미사용)
- UNIQUE (date, order_id, line_no, source)

### products — 메뉴 마스터 (POS export)
- id (text PK = POS ID), name, price, is_active, updated_at
- 죽은 메뉴 분석 / 메뉴 카탈로그 정의

### product_aliases — POS 이름 ↔ 마스터 수동 매핑
- id, product_id (→products), pos_name (UNIQUE), created_at
- 자동 정규화로 매칭 안 되는 케이스용
- 매칭 시 alias가 자동 정규화보다 우선

### memos — 월별 메모
- id, year, month, content, created_at, updated_at
- UNIQUE (year, month)

### upload_history — 업로드 히스토리
- id, file_name, file_type, status, uploaded_at
- file_type: 'daily_sales' | 'bank_transaction' | 'menu' | 'recipe' | 'work_logs'

### system_settings — 범용 키/값 설정
- key (text PK), value (jsonb), updated_at
- (현재 활성 키 없음. `include_owner_personal`은 4/29 제거 — 'excluded' 카테고리는 항상 제외로 통일)

### manual_adjustments — 수동 수입/지출 조정
- id, date, type ('income' | 'expense'), direction ('add' | 'subtract'), amount, memo
- 자동 분류 불가능한 거래를 월별 집계에 가감

### parsing_rules — 통장 거래내역 파싱 규칙
- id, keyword, category, created_at
- 파싱 우선순위:
  - 카드사 입금 패턴 → 수입 (income)
  - 급여 패턴 → 인건비 (labor)
  - 전기세/지방세/세금 키워드 → 고정비 (fixed)
  - 박기선 등 제외 수취인 → 제외 (excluded)
  - 설비 키워드 → 설비투자 (equipment)
  - 정기 공급처(홍인호/한성욱/김인성/소금집) → 재료비-현금 (ingredients_cash)
  - 비정기 재료 키워드 → 재료비-카드 (ingredients_card)
  - 나머지 출금 → 재료비-카드 (ingredients_card, 기본값) ← 4/30 변경. outlier는 ReclassifyTable에서 수동 조정

## 직원 직책
점장 / 매니저 / 알바생 — 현재 DB에는 알바생만 (근무일지가 P.T. 전용).
점장 급여는 통장 '점장급여' 메모로만 확인됨 (월 약 77~97만, 8월은 대표차입금과 섞임). 월급제 여부·고정 근무시간 확인 후 추가 예정

## 근무일지 엑셀 구조 (`lib/worklog-parser.ts`)
- 시트 = 한 달, 시트명 "26년 8월" 패턴
- 블록 2개: 평일 / "주일 근무"(1.5배). 블록 시작 = A열 "이름" 행, 직원 열 = 다음 행 헤더 "시간" 위치, 직원당 4칸(출근·퇴근·실근무시간·휴게)
- 시급 = "최저시급" 셀 바로 아래. 날짜 행 = A열 "M/D"
- 블록 끝 "총 지급액" 행과 계산값 대조 → 1,000원/1% 넘게 다르면 warnings

## 데이터 업로드 방식
- 일별 매출: POS 엑셀 파일 (YYYYMMDD.xlsx)
- 통장 거래내역: 하나은행 엑셀 파일 → 파싱 규칙으로 자동 분류
- 업로드 후 미리보기에서 카테고리 수동 변경 가능

## 하나은행 엑셀 파일 구조
- 컬럼(9개): 거래일시 | 적요 | 의뢰인/수취인 | 입금액 | 출금액 | 거래후잔액 | 구분 | 거래점 | 거래특이사항
- 상위 5행은 헤더 메타데이터 (거래내역 / 예금주명 / 계좌번호 / 조회기간 / 빈행) → 스킵
- 6번째 행이 실제 컬럼 헤더, 7번째 행부터 데이터
- 입금액/출금액 중 하나만 값 있고 나머지는 None
- 파싱 기준: 적요 컬럼 텍스트 매칭
  - 카드사명 포함 + 입금 → 수입
  - "급여" 포함 출금 → 인건비
  - "원두", "말차", "우유", "햄" 등 재료 키워드 → 재료비
  - "전기세", "세금", "지방세" 등 → 고정비
  - 나머지 출금 → 카드대금 (기본값)

## 점장용 가이드 파일
점장에게 안내할 때 또는 점장 PC의 Claude Code가 점장 질문에 답할 때 참고:
- `docs/점장-가이드.md` — 시스템 일반 사용 가이드
- `docs/레시피-입력-가이드.md` — 레시피·원가 엑셀 입력 가이드 (시트별 채우는 법, 메시지별 해결 방법, Claude Code 프롬프트 예시)

## 메뉴 원가 데이터 모델 (4/29 도입)

### ingredients — 재료 마스터
- id, name (UNIQUE), unit, kind ('purchased' | 'made'), payment_method ('cash' | 'card'), is_active

### ingredient_prices — 단가 이력
- ingredient_id, unit_price, effective_date
- UNIQUE (ingredient_id, effective_date)
- 조회: `effective_date <= asOfDate, 최신`

### recipes — 메뉴 레시피
- product_name_normalized (= `stripVariantSuffix(name)` — HOT/ICE 통합 키)
- ingredient_id, quantity
- UNIQUE (product_name_normalized, ingredient_id)

### sub_recipes / sub_recipe_items — 수제재료 배합
- output_ingredient_id (UNIQUE — 한 수제재료당 1배합), output_quantity
- 수제 안에 수제 허용 (10/7~, 재귀 계산 + 순환 방지). 예: 흑임자크림 ← 제조크림
- output 단위는 자유 — 아이스티 원액은 unit '잔' (output_quantity = 잔 수, 메뉴 레시피 quantity 1)

### packaging_sets / packaging_set_items — 포장세트
- (product_category, serve_temp) UNIQUE — 카테고리×온도 매핑
- serve_temp NULL = 디저트류

### 입력 양식
- `notes/레시피_템플릿_v5.xlsx` — 점장 입력용 (4시트: 재료/서브레시피/레시피/포장세트)
- 생성 스크립트: `notes/_make_recipe_template_v5.py`
- 부분 입력 OK — 누락은 `missing_price` / `no_recipe` 상태로 표시
- 엑셀 재업로드는 파일에 있는 재료/서브레시피/메뉴만 교체 → DB 직접 입력분은 유지
- 카톡 등으로 받은 레시피를 DB에 직접 넣은 기록 + 점장 확인 대기 질문: `docs/원가-입력-현황.md`
- 알려진 구멍: 포장세트는 `extractTemp(name)`으로 HOT/ICE 판별 → "복숭아아이스티"처럼 이름에 ICE가 없으면 tea/null 세트를 찾다가 포장비 0. 콜드컵 뚜껑 단가도 미등록

## 현재 작업 단계 (10/7 기준)

완성된 영역:
- [x] 대시보드 콕핏 (InsightBanner / KPI 클릭 / DeficitSignals / 매출 달력 / 메모 / 트렌드)
- [x] 주간 보고 (`/weekly`)
- [x] 결산 (`/profit`, `/expenses`, `/menu`, `/recipes`)
- [x] 메뉴 마스터 매칭/청소 시스템 (alias + MasterManager)
- [x] 업로드 + 재분류 (탭별 분리, 레시피 탭 추가)
- [x] 모바일 대응 (콕핏 = 폰 OK, 관리 = PC 전용)
- [x] 메뉴 원가 파이프라인 (DB 5테이블 + 업로드 파서 + 원가 계산 함수 + `/recipes` 페이지)
- [x] 수익 진단 `/diagnosis` (10/4)
- [x] 근무일지 업로드 + 시간대별 알바 효율 + `/staff` 조회 화면 (10/4~10/7)

외부 데이터 대기:
- [ ] 메뉴 원가 입력 (점장 엑셀 + 카톡분. 대기 질문은 `docs/원가-입력-현황.md`)
- [ ] 점장·매니저 근무/급여 구조 (근무일지 밖)

다음 작업 후보:
- [ ] 아이스티 등 이름에 ICE 없는 아이스 메뉴 포장세트 매칭
- [ ] 지출 카테고리 세분화 (임대료/공과금/카드수수료) + 사장 인건비 가정값 → 진단 페이지
- [ ] 재료 1세트 회수율 화면 (현금 4종 — 봉지 단위, 카드 — 월 단위)
- [ ] `CostRatioCards` / `DeficitSignals` 원가율 pending 해제 (대부분 메뉴 원가 등록 후)
- [ ] 신호등 절대 임계값 (운영 6개월)
- [ ] InsightBanner 임계값 적정성 점검