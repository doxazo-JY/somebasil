-- AI 업무팀 (2단계) — 2026-10-14
-- Supabase SQL Editor에서 실행
--
-- ai_runs  : AI가 한 번 일할 때마다 1행 (언제·성공 여부·토큰·한 줄 요약) — 비용 추적, 나중에 AI 사무실 화면 재료
-- ai_inbox : 점장에게 올리는 업무함 항목 (무엇을 발견했는지 · 근거 숫자 · 할 일)

create table if not exists public.ai_runs (
  id bigint generated always as identity primary key,
  agent text not null,                                   -- 'business'(경영) | 'marketing' | ...
  trigger text not null check (trigger in ('schedule', 'manual')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  period text,                                           -- 분석 대상 (경영 AI = 주 시작일 'YYYY-MM-DD')
  model text,
  input_tokens integer,
  output_tokens integer,
  summary text,                                          -- 한 줄 요약
  output jsonb,                                          -- AI 원본 결과 (다른 AI에게 넘길 때 사용)
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_runs_agent_started_idx on public.ai_runs (agent, started_at desc);

create table if not exists public.ai_inbox (
  id bigint generated always as identity primary key,
  run_id bigint references public.ai_runs(id) on delete set null,
  agent text not null,
  kind text not null default 'insight' check (kind in ('insight', 'alert', 'draft')),
  severity text not null default 'info' check (severity in ('info', 'warn')),
  title text not null,
  body text not null,                                    -- 왜 중요한지 (근거)
  evidence jsonb,                                        -- [{label, value}] 근거 숫자
  action text,                                           -- 할 일
  period text,
  status text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists ai_inbox_status_created_idx on public.ai_inbox (status, created_at desc);

alter table public.ai_runs enable row level security;
alter table public.ai_inbox enable row level security;
