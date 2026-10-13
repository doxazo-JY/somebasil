-- 출퇴근 QR v2 — 2026-10-13
-- Supabase SQL Editor에서 실행 (20261013_attendance.sql 다음)
--
-- 변경: "근무 중" 기록을 직원당 1건 → 직원·날짜당 1건으로
--   어제 퇴근을 안 찍었어도(퇴근 누락) 오늘 출근을 새로 찍을 수 있게 함.
--   누락된 어제 기록은 그대로 남아 관리 화면에 "퇴근 누락"으로 표시됨

drop index if exists public.attendance_logs_one_open_shift;

create unique index if not exists attendance_logs_one_open_shift_per_day
  on public.attendance_logs (staff_id, work_date) where clock_out is null;
