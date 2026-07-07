-- 20260644_rowing_c2_fields.sql — Concept2 rowing fields survive sync (v9.487)
--
-- Rowing deep-dive F3: v9.474 whitelisted avg_spm/drag_factor/strokes/
-- durationSec client-side, but logEntryToRow had no columns → signed-in users
-- lost stroke-rate/drag/DPS analysis after hydration (guests kept it — the
-- recovery-fields pattern again). duration_sec preserves the C2-exact seconds
-- (duration_min is rounded) for split math.

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS duration_sec integer,
  ADD COLUMN IF NOT EXISTS avg_spm      integer,
  ADD COLUMN IF NOT EXISTS drag_factor  integer,
  ADD COLUMN IF NOT EXISTS strokes      integer;
