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

**관리**:
- `/upload` — 업로드 + 거래 재분류(통장 탭) + 마스터 관리(메뉴 탭)
- `/staff` — 직원 (현재 placeholder, 추후 구현)
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
- category: 'ingredients'(재료비) | 'labor'(인건비) | 'fixed'(고정비) | 'card'(카드대금)

### staff — 직원 정보
- id, name, role, hire_date, leave_date, hourly_pay, is_active, created_at
- role: 'manager'(점장) | 'assistant'(매니저) | 'part_time'(알바생)

### staff_salary — 직원별 월별 인건비 (계산 전용)
- id, staff_id(→staff), year, month, amount, created_at
- UNIQUE (staff_id, year, month)
- ⚠️ 지출 집계에 사용하지 않음 — "이번 달 이 직원한테 얼마 줘야 하나" 계산 전용
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
- file_type: 'daily_sales' | 'bank_transaction' | 'menu'

### system_settings — 범용 키/값 설정
- key (text PK), value (jsonb), updated_at
- 예: `include_owner_personal` (대표 개인 거래 포함 토글)

### manual_adjustments — 수동 수입/지출 조정
- id, date, type ('income' | 'expense'), direction ('add' | 'subtract'), amount, memo
- 자동 분류 불가능한 거래를 월별 집계에 가감

### parsing_rules — 통장 거래내역 파싱 규칙
- id, keyword, category, created_at
- 파싱 우선순위:
  - 카드사 입금 패턴 → 수입 (income)
  - 급여 패턴 → 인건비 (labor)
  - 원두/말차/우유/햄 등 재료 키워드 → 재료비 (ingredients)
  - 전기세/지방세/세금 키워드 → 고정비 (fixed)
  - 나머지 출금 → 카드대금 (card, 기본값)

## 직원 직책 (현재 미구현, 추후 재설계)
점장 / 매니저 / 알바생

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

## 현재 작업 단계 (4/27 기준)

완성된 영역:
- [x] 대시보드 콕핏 (InsightBanner / KPI 클릭 / DeficitSignals / 매출 달력 / 메모 / 트렌드)
- [x] 주간 보고 (`/weekly`)
- [x] 결산 (`/profit`, `/expenses`, `/menu`)
- [x] 메뉴 마스터 매칭/청소 시스템 (alias + MasterManager)
- [x] 업로드 + 재분류 (탭별 분리)
- [x] 모바일 대응 (콕핏 = 폰 OK, 관리 = PC 전용)

외부 데이터 대기:
- [ ] 메뉴 원가 룰 (점장 레시피)
- [ ] 직원/인건비 (회계사 데이터, 현재 placeholder)

축적 후 결정:
- [ ] 신호등 절대 임계값 (운영 6개월)
- [ ] InsightBanner 임계값 적정성 점검