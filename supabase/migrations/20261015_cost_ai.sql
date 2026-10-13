-- 원가 AI — 2026-10-15 (20261014_ai_team_v2.sql 다음)
-- Supabase SQL Editor에서 실행
--
-- 원가 AI가 점장에게 빈 원가 정보(단가·수제 재료 배합·메뉴 레시피)를 질문으로 올리고,
-- 점장이 답을 적으면 AI가 저장안으로 정리 → 점장이 확인해야 DB에 저장
--
-- ai_inbox.kind     : 'question' 추가 (점장 답을 받는 항목)
-- ai_inbox.meta     : 질문 대상 (빈 곳 종류 · 재료/메뉴 이름 · 단위 · 풀리는 메뉴)
-- ai_inbox.answer   : 점장이 적은 답
-- ai_inbox.proposal : AI가 답을 정리한 저장안 + 미리보기 (확인 전)

alter table public.ai_inbox drop constraint if exists ai_inbox_kind_check;
alter table public.ai_inbox add constraint ai_inbox_kind_check check (kind in ('insight', 'alert', 'draft', 'question'));

alter table public.ai_inbox add column if not exists meta jsonb;
alter table public.ai_inbox add column if not exists answer text;
alter table public.ai_inbox add column if not exists proposal jsonb;
