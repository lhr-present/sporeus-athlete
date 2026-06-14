-- 20260616_training_log_metric_columns.sql — persist activity metrics on training_log
--
-- training_log previously had only duration_min/tss/rpe/zones/notes, so distance,
-- average HR and average cadence were DROPPED on the Supabase round-trip: they
-- survived only in the originating device's localStorage, and the Strava sync put
-- distance+HR into the notes TEXT only. Result: VO2max/EF/runningCV/cadence
-- analytics that read e.distanceM / e.avgHR / e.avgCadence silently got nothing on
-- any second device. These columns close that cross-device data-loss gap.
--
-- Idempotent. Nullable — existing rows stay NULL; analytics already guard for absence.

ALTER TABLE public.training_log ADD COLUMN IF NOT EXISTS distance_m  numeric(10,2);
ALTER TABLE public.training_log ADD COLUMN IF NOT EXISTS avg_hr      integer;
ALTER TABLE public.training_log ADD COLUMN IF NOT EXISTS avg_cadence integer;

COMMENT ON COLUMN public.training_log.distance_m  IS 'Activity distance in meters (manual entry or Strava a.distance).';
COMMENT ON COLUMN public.training_log.avg_hr      IS 'Average heart rate (bpm).';
COMMENT ON COLUMN public.training_log.avg_cadence IS 'Average cadence; running stored as full steps/min (Strava per-leg value doubled).';
