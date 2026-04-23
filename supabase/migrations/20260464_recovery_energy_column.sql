-- ─── Migration 064 — Add energy column to recovery table ────────────────────
-- Root cause: recovery form has 5 sliders (sleep, soreness, energy, mood,
-- stress) but the DB schema only had 4 — energy was silently dropped on sync.
-- After DB hydration, e.energy = undefined → getFatigueAccumulation fallback
-- defaults to 3 → fatigue alert (V2 in Recovery.jsx) never fires for any user
-- with DB-synced history.
--
-- Fix: add energy column matching the 1-5 CHECK pattern used by soreness/mood.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recovery
  ADD COLUMN IF NOT EXISTS energy SMALLINT CHECK (energy BETWEEN 1 AND 5);

COMMENT ON COLUMN recovery.energy IS
  'Perceived physical energy level 1–5 (1=exhausted, 5=fully energised). '
  'One of 5 wellness sliders in the Recovery check-in form. Added migration 064.';
