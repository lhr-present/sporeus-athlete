-- ── Missing cron jobs + supporting functions ───────────────────────────────────
-- Adds the 5 cron jobs referenced in docs but never scheduled, plus the 2
-- generate-report batch crons and the DB functions they depend on.

-- ── 1. monthly_upload_count on profiles ───────────────────────────────────────
-- Tracked by increment_upload_count (called by parse-activity).
-- Reset on 1st of each month by reset-file-upload-month cron.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_upload_count INTEGER NOT NULL DEFAULT 0;

-- ── 2. increment_upload_count RPC ─────────────────────────────────────────────
-- Called by parse-activity (non-fatal: wrapped in .catch(()=>{})).
CREATE OR REPLACE FUNCTION public.increment_upload_count(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.profiles
  SET monthly_upload_count = monthly_upload_count + 1,
      updated_at = now()
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_upload_count(uuid) TO service_role;

-- ── 3. reset_monthly_upload_count ─────────────────────────────────────────────
-- Runs on the 1st of each month; resets counters only for rows that need it.
CREATE OR REPLACE FUNCTION public.reset_monthly_upload_count()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.profiles
  SET monthly_upload_count = 0
  WHERE monthly_upload_count > 0;
$$;

GRANT EXECUTE ON FUNCTION public.reset_monthly_upload_count() TO service_role;

-- ── 4. maybe_refresh_squad_mv ─────────────────────────────────────────────────
-- Refreshes mv_squad_readiness CONCURRENTLY only if training_log was touched
-- in the last 2 minutes — prevents unnecessary refresh cost when quiet.
CREATE OR REPLACE FUNCTION public.maybe_refresh_squad_mv()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.training_log
    WHERE updated_at >= now() - interval '2 minutes'
    LIMIT 1
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_squad_readiness;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_refresh_squad_mv() TO service_role;

-- ── 5. Cron: check-dependencies ───────────────────────────────────────────────
SELECT cron.schedule(
  'check-dependencies',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/check-dependencies',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;$$
);

-- ── 6. Cron: alert-monitor ────────────────────────────────────────────────────
SELECT cron.schedule(
  'alert-monitor',
  '* * * * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/alert-monitor',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;$$
);

-- ── 7. Cron: operator-digest-weekly ──────────────────────────────────────────
-- Monday 05:00 UTC = 08:00 Istanbul
SELECT cron.schedule(
  'operator-digest-weekly',
  '0 5 * * 1',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/operator-digest',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;$$
);

-- ── 8. Cron: maybe-refresh-squad-mv ──────────────────────────────────────────
SELECT cron.schedule(
  'maybe-refresh-squad-mv',
  '* * * * *',
  'SELECT public.maybe_refresh_squad_mv();'
);

-- ── 9. Cron: reset-file-upload-month ─────────────────────────────────────────
-- 1st of each month at 00:00 UTC
SELECT cron.schedule(
  'reset-file-upload-month',
  '0 0 1 * *',
  'SELECT public.reset_monthly_upload_count();'
);

-- ── 10. Cron: generate-report weekly batch ────────────────────────────────────
-- Monday 03:30 UTC — after nightly-batch (03:00), before purge jobs (03:30/03:45)
SELECT cron.schedule(
  'generate-report-weekly',
  '30 3 * * 1',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/generate-report',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{"source":"pg_cron","batch":"weekly"}'::jsonb
  ) AS request_id;$$
);

-- ── 11. Cron: generate-report monthly squad batch ─────────────────────────────
-- 1st of each month at 04:00 UTC
SELECT cron.schedule(
  'generate-report-monthly-squad',
  '0 4 1 * *',
  $$SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/generate-report',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := '{"source":"pg_cron","batch":"monthly_squad"}'::jsonb
  ) AS request_id;$$
);
