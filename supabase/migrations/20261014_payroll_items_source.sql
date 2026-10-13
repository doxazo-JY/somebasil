-- 인건비 수기 항목 출처 구분 — 2026-10-14
-- Supabase SQL Editor에서 실행
--
-- 근무일지 업로드 시 "○월분 총 인건비(세전)" 칸의 고정급·주휴수당 줄을 payroll_items로 가져옴
-- 같은 파일을 다시 올리면 source='worklog' 행만 지우고 다시 넣음 (점장이 직접 넣은 'manual'은 그대로)

alter table public.payroll_items
  add column if not exists source text not null default 'manual';

alter table public.payroll_items
  drop constraint if exists payroll_items_source_check;
alter table public.payroll_items
  add constraint payroll_items_source_check check (source in ('manual', 'worklog'));
