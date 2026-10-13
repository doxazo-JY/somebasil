-- 출퇴근 QR 체크 (1단계) — 2026-10-13
-- Supabase SQL Editor에서 실행
--
-- 흐름
--   - 카운터 QR(고정) 첫 스캔 → 새 직원 등록(이름만 입력) → 폰에 기기 토큰 쿠키 저장
--   - 이후 스캔 → 쿠키로 직원 자동 인식 → 출근/퇴근 토글
--   - 폰 교체 시 → 점장이 관리 화면에서 직원별 연결 QR 생성(10분, 1회용) → 새 폰으로 스캔
--
-- 기존 work_logs 테이블은 건드리지 않음 (퇴근 전 상태 저장 불가 + 자정 넘김 계산 오류로 신규 테이블 사용)

-- ─────────────────────────────────────────────
-- 1) staff: 폰 교체용 연결 QR 토큰
-- ─────────────────────────────────────────────
alter table public.staff
  add column if not exists link_token_hash text,          -- 연결 QR 토큰의 SHA-256 해시 (원문은 저장 안 함)
  add column if not exists link_token_expires_at timestamptz;

-- ─────────────────────────────────────────────
-- 2) staff_devices: 직원별 등록된 폰
-- ─────────────────────────────────────────────
create table if not exists public.staff_devices (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff(id),
  token_hash text not null unique,                        -- 쿠키에 저장된 기기 토큰의 SHA-256 해시
  label text,                                             -- 예: "iPhone Safari"
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz                                  -- 점장이 등록 해제한 시각
);
create index if not exists staff_devices_staff_id_idx on public.staff_devices (staff_id);

-- ─────────────────────────────────────────────
-- 3) attendance_logs: 출퇴근 기록
-- ─────────────────────────────────────────────
create table if not exists public.attendance_logs (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff(id),
  work_date date not null,                                -- 출근 시각 기준 한국 날짜 → 평일/주일 시급 구분
  clock_in timestamptz not null,                          -- 적용 시각 (점장 수정 가능)
  clock_out timestamptz,                                  -- null = 근무 중
  qr_clock_in timestamptz,                                -- QR로 찍힌 원래 시각 (수정해도 보존, 수기 입력이면 null)
  qr_clock_out timestamptz,
  minutes_worked integer generated always as
    ((extract(epoch from (clock_out - clock_in)) / 60)::integer) stored,
  device_id bigint references public.staff_devices(id),
  edited_at timestamptz,                                  -- 값 있으면 "점장 수정됨"
  edit_memo text,
  created_at timestamptz not null default now(),
  constraint attendance_logs_clock_order check (clock_out is null or clock_out > clock_in)
);
-- 직원당 "근무 중" 기록은 하나만
create unique index if not exists attendance_logs_one_open_shift
  on public.attendance_logs (staff_id) where clock_out is null;
create index if not exists attendance_logs_work_date_idx on public.attendance_logs (work_date);
create index if not exists attendance_logs_staff_date_idx on public.attendance_logs (staff_id, work_date);

-- ─────────────────────────────────────────────
-- 4) pay_rates: 매장 공통 시급 이력 (평일 / 주일)
-- ─────────────────────────────────────────────
-- 조회: effective_from <= 해당 날짜 중 최신
create table if not exists public.pay_rates (
  effective_from date primary key,
  weekday_hourly integer not null,
  sunday_hourly integer not null
);
-- 근무일지 엑셀 기준 (26년 1월~ 평일 10,320 / 주일 15,480)
insert into public.pay_rates (effective_from, weekday_hourly, sunday_hourly)
values ('2026-01-01', 10320, 15480)
on conflict (effective_from) do nothing;

-- ─────────────────────────────────────────────
-- 5) payroll_items: 월 인건비 요약의 수기 항목 (고정급, 주휴수당 등)
-- ─────────────────────────────────────────────
create table if not exists public.payroll_items (
  id bigint generated always as identity primary key,
  year integer not null,
  month integer not null check (month between 1 and 12),
  staff_id bigint references public.staff(id),            -- 특정 직원 항목이 아니면 null
  kind text not null check (kind in ('fixed_salary', 'weekly_holiday_pay', 'other')),
  label text not null,                                    -- 예: "점장", "○○ 주휴"
  amount integer not null,
  created_at timestamptz not null default now()
);
create index if not exists payroll_items_year_month_idx on public.payroll_items (year, month);

-- ─────────────────────────────────────────────
-- 6) 카운터 QR 비밀값 (유출 시 값 교체 후 QR 재출력)
-- ─────────────────────────────────────────────
insert into public.system_settings (key, value)
values ('attendance_qr_secret', to_jsonb(replace(gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- RLS: 다른 테이블과 동일하게 켜고 정책 없음 → 서버(service_role)만 접근
-- ─────────────────────────────────────────────
alter table public.staff_devices enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.pay_rates enable row level security;
alter table public.payroll_items enable row level security;
