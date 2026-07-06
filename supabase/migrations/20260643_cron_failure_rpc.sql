-- 20260643_cron_failure_rpc.sql — cron-failure visibility for alert-monitor (v9.486)
--
-- Backend sweep F14: the F2 cron failed 10,080 times in 7 days and fired ZERO
-- operator alerts — alert-monitor checked queues/DLQ/staleness but had no way
-- to see cron.job_run_details (not exposed via PostgREST). This DEFINER RPC
-- exposes an aggregate, service-role-only view of recent failures.
-- NOTE: service_role does NOT bypass EXECUTE grants — the explicit GRANT below
-- is load-bearing (learned the hard way, 2026-06).

CREATE OR REPLACE FUNCTION public.get_failing_crons(
  p_window_minutes int DEFAULT 30,
  p_min_failures   int DEFAULT 5
)
RETURNS TABLE(jobname text, failures bigint, last_message text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT j.jobname,
         count(*)::bigint AS failures,
         max(d.return_message) AS last_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.status = 'failed'
    AND d.start_time > now() - make_interval(mins => p_window_minutes)
  GROUP BY j.jobname
  HAVING count(*) >= p_min_failures
$$;

REVOKE ALL ON FUNCTION public.get_failing_crons(int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_failing_crons(int, int) TO service_role;
