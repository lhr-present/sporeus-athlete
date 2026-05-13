-- 20260478_coach_plan_acceptance.sql
-- v9.105.0 (Prompt BB) — Athlete reaction loop on coach-pushed plans.
--
-- Pre-v9.105 coach_plans had no acceptance signal. Coach pushed a plan
-- via SbAthletePanel.handleSendPlan, athlete loaded it via the
-- CoachPlansCard in Periodization, and neither side knew whether it
-- had been seen, accepted, or rejected. Coaches kept asking athletes
-- out-of-band ("did you get the plan?").
--
-- This migration adds two nullable timestamp columns. Exactly one of
-- (accepted_at, rejected_at) is set per plan after the athlete
-- responds. Both null = pending. RLS already enforces that only the
-- targeted athlete can update their own row.

ALTER TABLE coach_plans
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Acceptance counter index for coach dashboards that want to
-- list "n plans pending" efficiently. Partial index keeps it small —
-- the vast majority of rows transition to a non-null state quickly.
CREATE INDEX IF NOT EXISTS idx_coach_plans_pending
  ON coach_plans (coach_id, athlete_id)
  WHERE accepted_at IS NULL AND rejected_at IS NULL;
