-- ─── Migration 065 — Add sleep quality column to recovery table ─────────────
-- Root cause: recovery form has 5 wellness sliders: sleep (quality 1–5),
-- soreness, energy, mood, stress. Only soreness/mood/stress were in the DB
-- schema. After migration 064 added energy, sleep quality was the last missing
-- field.
--
-- WITHOUT this column:
--   pdfReport.js accumulates e.sleep = undefined → weekly wellness table shows
--   "—" for every sleep quality cell even when data was entered.
--   Calendar.jsx shows "Sleep undefined/5" on all recovery-logged days.
--   WellnessSparkline plots null for every sleep data point.
--   dataMigration.js (guest→auth migration) drops the sleep quality slider.
--
-- Note: sleep_hrs (actual hours of sleep) already exists and is separate.
-- This column stores the perceived quality rating, not the duration.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recovery
  ADD COLUMN IF NOT EXISTS sleep SMALLINT CHECK (sleep BETWEEN 1 AND 5);

COMMENT ON COLUMN recovery.sleep IS
  'Perceived sleep quality 1–5 (1=very poor, 5=excellent). '
  'Distinct from sleep_hrs (actual duration). One of 5 wellness sliders. '
  'Added migration 065.';
