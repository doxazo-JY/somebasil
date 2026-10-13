-- AI 업무팀 v2 — 2026-10-14 (20261014_ai_team.sql 다음)
-- Supabase SQL Editor에서 실행
--
-- 1) marketing_posts : 마케팅 AI 게시글 초안 (초안 → 승인 → 게시 완료)
-- 2) ai_inbox.dedupe_key : 매일 도는 AI(근태 등)가 같은 알림을 반복해서 올리지 않도록
--    ai_inbox.link : 항목에서 바로 이동할 화면 (예: /marketing, /staff)

create table if not exists public.marketing_posts (
  id bigint generated always as identity primary key,
  run_id bigint references public.ai_runs(id) on delete set null,
  source text not null check (source in ('auto', 'manual')),  -- auto = 경영 AI 주제를 이어받음
  topic text not null,
  channel text not null check (channel in ('instagram', 'blog')),
  title text,                                                  -- 블로그 제목 (인스타는 null)
  body text not null,
  hashtags text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'posted')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  posted_at timestamptz
);
create index if not exists marketing_posts_status_created_idx on public.marketing_posts (status, created_at desc);

alter table public.ai_inbox add column if not exists dedupe_key text;
alter table public.ai_inbox add column if not exists link text;
create unique index if not exists ai_inbox_dedupe_key_idx on public.ai_inbox (dedupe_key) where dedupe_key is not null;

alter table public.marketing_posts enable row level security;
