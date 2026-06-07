-- ── 20260416_decoupling.sql ──────────────────────────────────────────────────
-- Add aerobic decoupling (Pw:Hr) metric to training_log entries.
-- Computed at FIT import time; null for manually-entered sessions without streams.
-- Friel / TrainingPeaks standard: <5% coupled, 5-10% mild, >10% significant.

ALTER TABLE training_log
  ADD COLUMN IF NOT EXISTS decoupling_pct NUMERIC(5,2) DEFAULT NULL;

COMMENT ON COLUMN training_log.decoupling_pct IS
  'Aerobic decoupling percentage (Pw:Hr ratio drift, first vs second half). '
  'NULL when streams unavailable. Friel method: <5%=coupled, 5-10%=mild, >10%=significant.';
