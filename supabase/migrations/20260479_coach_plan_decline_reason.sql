-- 20260479_coach_plan_decline_reason.sql
-- v9.112.0 (Prompt CCC) — Capture *why* an athlete declined a coach plan.
--
-- Pre-v9.112 a declined plan set rejected_at to a timestamp and that was
-- it. The coach saw "✕ DECLINED" on SbAthletePanel with zero signal
-- about what to change for the next iteration. Common decline reasons —
-- "too hard for me right now", "I'm injured", "doesn't fit my schedule"
-- — each imply very different coach actions. Without that signal, the
-- coach either guesses or asks out-of-band, which defeats the point of
-- in-app coach<->athlete communication.
--
-- Two nullable columns:
--   decline_reason TEXT — one of: too_hard, schedule_conflict, injury, other
--   decline_note   TEXT — free-form optional athlete note
--
-- Reason set is small + closed (CHECK constraint) so coach-side
-- aggregates ("4 athletes declined for injury") are tractable. Free-form
-- note is optional and intentionally lightweight — the bar to decline
-- shouldn't include "write a paragraph."
--
-- RLS already restricts UPDATE to the athlete (from 20260478). No
-- additional policy needed.

ALTER TABLE coach_plans
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS decline_note   TEXT;

-- Constrain decline_reason to known values. Future expansion: ALTER the
-- constraint to add reasons; never silently widen the set client-side
-- without a migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'coach_plans_decline_reason_chk'
  ) THEN
    ALTER TABLE coach_plans
      ADD CONSTRAINT coach_plans_decline_reason_chk
      CHECK (
        decline_reason IS NULL
        OR decline_reason IN ('too_hard', 'schedule_conflict', 'injury', 'other')
      );
  END IF;
END $$;
