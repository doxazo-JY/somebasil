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

## 페이지 구성 (3개 그룹 · 탭 8개 — 10/16 정리: 진단 → 손익, 원가 → 메뉴, 설정 → 데이터, 마케팅 → 사무실에서 들어감)

**운영** (매장 굴리기 · 매일/수시):
- `/` — 대시보드 (월간 콕핏)
- `/weekly` — 주간 (목요일 보고용). 그 주 경영 AI 분석(꼭 볼 것 3가지, 읽기 전용) + 다음 주 수요일 추천이 있으면 맨 위에 (`getWeeklyAiNotes`), AI 분석이 없는 주에만 규칙 요약 배너
- `/inbox` — AI 사무실 (= 업무함). 픽셀 책상 = AI 업무팀, 책상 누르면 그 AI의 ai_inbox 항목만. 탭 이름 "사무실"
- `/marketing` — 마케팅 AI 초안 (초안 → 승인 → 복사 → 올렸어요). 자동 게시 없음. 탭 없음 — 사무실 마케팅 AI·업무함 링크로 들어감 (탭은 사무실이 켜짐)
- `/staff` — 직원 (10/16 운영으로). 보기 2개(`?view=`): 근무(기준 기록 한 줄 + 이번 달 숫자·근무일지 엑셀 → 직원별 이번 달 표: 한 줄 = 한 사람 합계, 보기 2개: 날짜별(종이 근무일지 모양, 넓은 화면 기본 — 칸 누르면 QR 고치기·직접 입력) / 사람별(폰 기본 — 누르면 날짜별 출퇴근 + 고정급·주휴 넣기) → 전체 근무일지 월별 표[접힘]) / 직원·설정(`settings`: 직원 목록 이름 바꾸기·폰·연결 QR·퇴사·삭제 + 기준 기록 · 카운터 QR · 시급). 이름 바꿀 땐 근무일지 엑셀 이름도 같이 (업로드가 이름으로 매칭)

**AI 업무팀** (`lib/ai/`, 10/14): `generateStructured()`가 AI_PROVIDER(openai | anthropic)로 호출. 일정 = `/api/cron/agents` 매일 08:00 KST — 매일 근태(규칙, AI 없음) / 월 원가 / 수 경영 AI 이번 주 추천(`tips.ts`, 계절·기념일 + 카페 긴 흐름, 그날 밤 주간 보고서 참고용). 데이터 기반 점검은 시간표가 아니라 업로드 직후(`after-upload.ts`, `/api/upload/finish`의 after()): 지난주 매출·통장이 다 들어오면 (`lib/upload/coverage.ts` = 파일 기간·데이터 날짜 중 늦은 쪽) 경영 → 마케팅(marketing_topic 전달) 주 1번, 통장 올리면 자금 관리 주 1번 (점장이 수요일 밤 업로드 → 목요일 주간회의). 비서 AI = 질문할 때 (읽기 전용 도구). 원가 AI(10/15) = 원가 계산이 막힌 곳(단가·수제 배합·레시피)을 규칙으로 찾아 영향 큰 순서로 처리 전 질문 최대 3개(ai_inbox kind=question) → 점장 답 → AI가 저장안 정리(`lib/ai/cost/answer.ts`) → 점장 [이대로 저장]을 눌러야 DB 저장. 마이그레이션 `20261015_cost_ai.sql` 실행마다 ai_runs 기록. AI에 직원 이름 보내지 않음 (현금흐름은 인건비를 "직원 급여"로 묶음). 마케팅 말투 = `marketing.ts`의 실제 게시글 예시 + 승인한 글

**분석** (깊게 보기 · 월말/분기):
- `/profit` — 손익. 보기 2개(`?view=`): 월별 손익(YTD) / 흑자 조건(`check`, `components/diagnosis/DiagnosisView`)
- `/expenses` — 지출
- `/menu` — 메뉴. 보기 2개: 판매 패턴(히트맵 / 죽은 메뉴) / 원가(`?view=cost`, `components/recipes/RecipesView`)
- 흑자 조건(예전 `/diagnosis`) = 고정비/변동비 손익분기 · 하루 필요 고객 · 목표 이익 · 고객수×객단가 · 시간대별 매출 vs 알바 인원 · 못 보는 항목과 이유

**데이터** (탭 1개라 탭 줄 숨김):
- `/upload` — 데이터 넣기 (파일 하나로 받기: 끌어다 놓으면 내용으로 종류 판별 → 바로 저장, 지난주 체크리스트, 애매한 통장 출금·근무일지 경고만 표시) + 데이터 고치기 (통장 거래 분류 · 메뉴 목록 · 수동 조정 · 계산 기준, 첫 탭 `?fix=`). 탭 이름 "데이터"
- `/clock` — 직원용 QR 출퇴근 (로그인 없음, 사이드바 없음)
- 예전 주소 `/diagnosis` `/recipes` `/settings`는 새 위치로 redirect (업무함 옛 링크 유지)

## 가이드 · 비서 채팅 (10/16)
- **가이드 내용은 `lib/guide.ts` 한 곳** — `/guide` 화면(사이드바 아래 "가이드", 폰은 상단 오른쪽)과 비서 AI `site_guide` 도구가 같이 씀
- ⚠️ **화면·탭·버튼 이름이나 위치를 바꾸면 `lib/guide.ts`도 같이 고칠 것** (안 고치면 비서가 옛 위치를 안내함)
- 각 화면 제목 옆 `?` = `components/ui/GuideLink` → `/guide#id`
- 오른쪽 아래 썸바실 로고 버튼 = `components/ui/FloatingAssistant` (루트 layout, /clock 제외). 열 때 `GET /api/ai/ask`로 최근 대화, 질문에 지금 화면 주소(page) 같이 보냄 → "이 화면" 이해. 답 속 화면 주소는 링크로

## 사이드바 (3개 그룹) + PageTabs (그룹 내)
- 사이드바: 운영 / 분석 / 데이터 (PageTabs 그룹 키 operations / analysis / data)
- 페이지 상단 PageTabs로 그룹 내 이동
- 사이드바·PageTabs 모두 `?year=&month=` 쿼리 유지 (기간 컨텍스트 이어감). 보기 전환 `?view=` `?fix=`는 넘기지 않음
- 페이지 안 보기 전환 = `components/ui/SubTabs` (주소 `?view=`)

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
- ⚠️ hours_worked = DB generated column → insert 시 넣으면 에러
- hourly_rate = 근무 당시 시급 (평일/주일 블록·연도별로 다름, 10/4 컬럼 추가). 시간대별 인건비 계산은 이 값 우선, 없으면 staff 시급
- 업로드 = 파일에 포함된 월 × 파일 속 직원 기록을 delete 후 insert (재업로드 idempotent, 트랜잭션 아님)

### staff_salary — 직원별 월별 인건비 (계산 전용)
- id, staff_id(→staff), year, month, amount, created_at
- UNIQUE (staff_id, year, month)
- ⚠️ 지출 집계에 사용하지 않음 — "이번 달 이 직원한테 얼마 줘야 하나" 계산 전용
- 근무일지 업로드 = Σ(시간×블록 시급), 주휴 제외 (엑셀 "총 지급액" 기준)
- 실제 인건비 지출은 통장 거래내역 업로드 시 monthly_expenses.labor로 기록됨

### 출퇴근 QR (10/13, `supabase/migrations/20261013_attendance*.sql` 적용 완료)
- 종이 근무일지(work_logs 업로드)와 병행 시험 운영 중. 공식 기록은 아직 업로드. 병행 후 attendance_logs → work_logs 연결 예정 (요약·수익 진단이 QR 기준으로 갱신되도록)
- `staff_devices` — 직원별 등록 폰 (token_hash = 쿠키 기기 토큰의 해시, revoked_at)
- `attendance_logs` — 출퇴근 기록. clock_out null = 근무 중. qr_clock_* = QR 원래 시각 보존, edited_at = 점장 수정
- `pay_rates` — 매장 공통 시급 이력 (평일 / 주일). effective_from <= 날짜 중 최신
- `payroll_items` — 월 인건비 요약 수기 항목 (fixed_salary | weekly_holiday_pay | other). source: 'manual'(점장 입력) | 'worklog'(근무일지 업로드 시 각 시트 "○월분 총 인건비" 칸의 고정급·주휴 줄 — 재업로드 시 그 달 worklog 행만 교체)
- **매달 고정급** (`system_settings.monthly_fixed_salary` = [{from: YYYY-MM, label, amount}] 바뀐 기록, 10/16): 점장 고정급 1,050,000원(2026-03부터 — 근무일지 파일 기준). `buildTimesheet()`가 그 달에 손으로 넣은 고정급이 없으면 자동 항목(id -1)으로 더함 → 인건비·근무일지 엑셀 포함. 직원·설정 탭에서 적용 시작 달을 골라 바꿈 (그 전 달 그대로). 예전 "지난달 고정급 가져오기" 버튼·copy API 제거. ※ 10/16 기준 payroll_items 0건 — 근무일지가 고정급·주휴 줄 읽기(10/14) 전에 업로드돼서. 근무일지를 다시 올리면 매니저(3·4월)·주휴도 들어옴
- `staff.link_token_hash / link_token_expires_at` — 기존 직원 첫 연결·폰 교체 때 점장이 만드는 연결 QR (10분, 1회용). 연결하면 3분 입장권도 같이 발급 → 바로 /clock 출근 화면
- `system_settings.attendance_qr_secret` — 카운터 고정 QR 비밀값
- 첫 스캔 = 새 직원 등록만 (이름 입력, 기존 이름이면 차단). 기존 직원 연결은 점장 연결 QR로만. PIN 없음
- 출퇴근은 버튼 방식. 카운터 QR(`/clock?k=`)을 찍으면 3분 입장권 쿠키(`sb_ticket`, HMAC 서명 키 = QR 비밀값) 발급 + 주소에서 k 제거 → 버튼 1회 사용 후 소멸. 링크·열어 둔 탭은 현황만
- 직원용 주소 분리: `NEXT_PUBLIC_CLOCK_ORIGIN`(Vercel 환경변수)으로 들어온 요청은 `proxy.ts`가 `/clock`·`/api/clock/*`만 허용, 나머지 404. 카운터 QR·연결 QR은 이 주소로 생성. 미설정 시 제한 없음
- 근무 중 = 16시간 이내 시작된 퇴근 전 기록. 그보다 오래되면 퇴근 누락 (v2: 근무 중 기록 직원·날짜당 1건)
- QR용으로 work_logs를 쓰지 않은 이유: 퇴근 전 상태 저장 불가, 자정 넘김 계산 오류. 업로드가 월 단위 delete→insert라 QR 기록을 넣으면 지워짐
- **기준 기록** (`system_settings.attendance_source_priority` = paper(기본) | qr, 직원·설정 탭): 직원·날짜별로 기준 기록이 있으면 그것, 없으면 다른 쪽 (`mergeShifts`). 시작일 없이 종이 → QR 자연 전환 (10/16, 예전 QR 기록 시작일 대체). `buildTimesheet()` · 근무 탭 · 근무일지 엑셀 · 전체 근무일지(`getAllMonthlyTotals`) · 비서 AI 모두 이 기준
- 종이 근무일지의 주일 블록(1.5배)은 공휴일 포함 → work_logs는 일요일 또는 그달 최저 시급보다 확실히 높은 시급이면 주일로 분류
- 근무일지 엑셀 = 누적 (기록 있는 첫 달 ~ 선택 달, 월마다 시트). 원본 파일과 12월~8월 주간·주일 금액 일치 확인 (10/14)

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
- 카테고리별 집계(진단·지출·대시보드)에도 반영: `lib/supabase/expense-adjustments.ts`가 같은 날짜·금액의 지출 건을 찾아 그 카테고리에서 가감 (짝 없으면 고정비). 수입 조정은 진단 매출에 반영, 객단가는 POS 그대로

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

## 데이터 업로드 방식 (10/16 통합 — `app/api/upload/route.ts`, `lib/upload/`)
- 파일 하나씩 POST → `readWorkbook`(암호 걸린 하나은행 파일 복호화 포함) → 내용으로 판별 → 파싱 → 바로 저장 → upload_history(+ period_start/end, 마이그레이션 `20261016_upload_period.sql`)
  - 판별: 레시피(시트 재료/서브레시피/레시피) · 통장(거래내역·거래일시·적요) · POS 매출(헤더 판매번호·상품명·주문 시간·판매 금액) · POS 메뉴(상품ID·사용·명칭·단가) · 근무일지(시트 이름 "26년 8월")
  - 기간: 통장 = 파일 "조회기간", POS 매출 = 파일명 "YYYYMMDD - YYYYMMDD" (없으면 데이터 날짜 범위)
- 다시 올려도 중복 없음: 매출·통장 입금은 덮어쓰기, **통장 출금은 이미 있는 거래를 건드리지 않음** (재분류한 카테고리 유지)
- 통장 출금 중 규칙에 안 걸려 기본값(재료비-카드)이 된 것 = uncertain → 업로드 직후 확인 목록 (`/api/upload/edit`로 수정)
- 여러 파일을 다 넣은 뒤 `/api/upload/finish` 한 번 → 지난주 체크리스트 + AI 분석 판단

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