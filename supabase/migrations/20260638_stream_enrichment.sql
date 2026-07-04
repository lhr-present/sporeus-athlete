-- 20260638_stream_enrichment.sql — P1 streams enrichment (v9.466)
--
-- The strava-backfill-worker now processes 'enrich' queue messages: one
-- streams fetch + one DetailedActivity fetch per qualifying activity
-- (has_heartrate || device_watts, non-manual), computing FIT-parity scalars
-- (real NP/power-TSS, Friel decoupling_pct, true 5-zone distribution, Skiba W′
-- exhaustion) and taking Strava's athlete-entered perceived_exertion as the
-- authoritative rpe (rpe_method='athlete').
--
-- stream_enriched_at = idempotence marker: set once an enrich pass ran (even
-- when the activity had no usable streams), so webhook re-imports don't
-- re-enqueue the same activity forever.

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS stream_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS w_prime_exhausted  boolean,
  ADD COLUMN IF NOT EXISTS w_prime_method     text,
  ADD COLUMN IF NOT EXISTS calories           integer;

COMMENT ON COLUMN public.training_log.w_prime_method IS
  'How CP/W'' for the exhaustion check were obtained: measured (CP test) | estimated (0.95×FTP + 15 kJ). Mirrors formulas.js resolveCPWPrime.';
COMMENT ON COLUMN public.training_log.stream_enriched_at IS
  'When the streams-enrichment pass ran for this Strava activity (idempotence marker; set even if no usable streams).';
