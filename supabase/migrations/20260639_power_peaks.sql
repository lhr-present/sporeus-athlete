-- 20260639_power_peaks.sql — compact per-session power peaks (v9.480)
--
-- The founder-approved "raw-series storage" feature, delivered as scalars:
-- instead of persisting 10,800-sample watt blobs, each powered session stores
-- a small MMP vector { p5, p60, p300, p1200, p3600, lh300 } (integer watts).
-- Written by the streams-enrichment pass (watts stream, device_watts-gated
-- upstream) and by client FIT imports; read by DurabilityCard
-- (lh300 / max p300 across sessions — Maunder 2021) and future power-curve/CP
-- history. Zero blob storage, no per-session fetch weight.

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS power_peaks jsonb;

COMMENT ON COLUMN public.training_log.power_peaks IS
  'Per-session MMP vector {p5,p60,p300,p1200,p3600,lh300} in integer watts. lh300 = best 5-min power in the final hour (durability numerator). Source of truth: src/lib/athlete/powerPeaks.js.';
