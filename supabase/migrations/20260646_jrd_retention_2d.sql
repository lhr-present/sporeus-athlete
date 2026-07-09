-- 20260646_jrd_retention_2d.sql — cron.job_run_details retention 7d → 2d (v9.497)
--
-- Ops incident 2026-07-09: job_run_details found bloated to 494 MB (F2-era
-- failure debris; DELETEs don't reclaim heap). get_failing_crons (v9.486)
-- seq-scans it every minute → alert-monitor timed itself out at load windows
-- (the 22:00 UTC cron_failing_alert-monitor cluster). Mitigations:
--   1. alert-monitor scan throttled to every 5th minute (edge deploy, done);
--   2. retention 7d → 2d (this migration) — the alerting window is 30 min,
--      the digest looks back 24 h; nothing reads beyond 2 days;
--   3. one-time VACUUM FULL with lock_timeout (runbook below — needs a quiet
--      moment; the Mgmt API was degraded when this landed).
--
-- Runbook for (3), retry until it takes (~seconds once the lock is granted):
--   SET lock_timeout = '3s'; VACUUM FULL cron.job_run_details;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-run-details') THEN
    PERFORM cron.unschedule('purge-cron-run-details');
  END IF;
END $$;
SELECT cron.schedule(
  'purge-cron-run-details',
  '15 2 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days'$$
);
