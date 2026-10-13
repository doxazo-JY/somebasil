-- 업로드 하나로 합치기 — 2026-10-16
-- Supabase SQL Editor에서 실행
--
-- upload_history에 파일이 담고 있는 기간을 기록
--   통장 = 파일의 "조회기간", POS 매출 = 파일명 기간(없으면 들어 있는 날짜 범위)
-- "지난주 매출·통장이 다 들어왔나"를 마지막 거래일이 아니라 파일 기간으로 판단하려고
--   (일요일에 통장 거래가 없어도 조회기간이 일요일까지면 다 들어온 것)
-- 기존 화면은 이 칸을 쓰지 않으므로 먼저 실행해도 안전

alter table public.upload_history add column if not exists period_start date;
alter table public.upload_history add column if not exists period_end date;
