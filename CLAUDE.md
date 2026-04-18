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

## 페이지 구성
- / (대시보드)
- /수입
- /지출
- /이익
- /직원
- /직원/[id]
- /업로드
- /설정

## 사이드바 메뉴 (순서 고정)
대시보드 / 수입 / 지출 / 이익 / 직원 / 업로드 / 설정

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

### staff_salary — 직원별 월별 인건비
- id, staff_id(→staff), year, month, amount, created_at
- UNIQUE (staff_id, year, month)

### daily_sales — 일별 카테고리별 매출 (POS)
- id, date, category, amount, created_at
- category: 'coffee' | 'matcha' | 'beverage' | 'dessert' 등
- UNIQUE (date, category)

### memos — 월별 메모
- id, year, month, content, created_at, updated_at
- UNIQUE (year, month)

### upload_history — 업로드 히스토리
- id, file_name, file_type, status, uploaded_at
- file_type: 'daily_sales' | 'monthly' | 'image'

### parsing_rules — 이미지 파싱 규칙
- id, keyword, category, created_at

## 직원 직책
점장 / 매니저 / 알바생 (드롭다운 선택)

## 현재 작업 단계
Phase 1 구현 중
- [ ] Supabase 스키마 생성
- [ ] 대시보드
- [ ] 수입 / 지출 / 이익 상세
- [ ] 직원 관리
- [ ] 데이터 업로드