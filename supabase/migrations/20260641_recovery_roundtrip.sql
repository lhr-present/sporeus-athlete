-- 20260641_recovery_roundtrip.sql — recovery fields lost on hydration (v9.484)
--
-- Contract sweep A7: Recovery.jsx + HRVDashboard write restingHR / bedtime /
-- rmssd onto recovery entries and five cards read them (restingHrDrift,
-- restingHrFitnessTrend, postHardSessionResponse, recoveryQualityStreak,
-- bedtimeConsistency) — but recEntryToRow had no columns for them and login
-- hydration REPLACES the local array, so signed-in users lost the fields on
-- every reload (guests unaffected, which is why it survived testing).

ALTER TABLE public.recovery
  ADD COLUMN IF NOT EXISTS resting_hr numeric(5,1),
  ADD COLUMN IF NOT EXISTS bedtime    text,
  ADD COLUMN IF NOT EXISTS rmssd      numeric(6,2);
