-- 20260640_backend_sweep_fixes.sql — backend sweep 2026-07-06 (F1, F2, F10, F13)
-- All idempotent; applied to prod via Management API the day it was written.

-- ── F2 (HIGH, active): cron maybe-refresh-squad-mv failed EVERY MINUTE for 7+
-- days (10,080/10,080) — public.maybe_refresh_squad_mv() filters
-- training_log.updated_at, which never existed. Standard fix: add the column
-- with a touch trigger so edits AND enrichment updates bump it; the fn then
-- works as written and the squad MV refreshes on real changes.
ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_training_log_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_log_touch ON public.training_log;
CREATE TRIGGER trg_training_log_touch
  BEFORE UPDATE ON public.training_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_training_log_updated_at();

-- ── F1 (HIGH, latent): parse-activity writes parsed_session_id/error/parsed_at
-- and statuses parsing/done/error; prod activity_upload_jobs predates repo
-- migration 2026042101 (has error_msg/log_entry_id and a 3-value status CHECK)
-- → every done/error update would PGRST204 or violate the CHECK, wedging jobs
-- at 'parsing' on the FIRST real upload. Align prod with the repo intent.
ALTER TABLE public.activity_upload_jobs
  ADD COLUMN IF NOT EXISTS parsed_session_id uuid REFERENCES public.training_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error             text,
  ADD COLUMN IF NOT EXISTS parsed_at         timestamptz;

ALTER TABLE public.activity_upload_jobs
  DROP CONSTRAINT IF EXISTS activity_upload_jobs_status_check;
ALTER TABLE public.activity_upload_jobs
  ADD CONSTRAINT activity_upload_jobs_status_check
  CHECK (status IN ('uploaded', 'parsed', 'failed', 'pending', 'parsing', 'done', 'error'));

-- ── F10 (HIGH, latent): the session_comments → comment-notification trigger
-- used supabase_functions.http_request with a STATIC headers literal carrying
-- (a) NO x-sporeus-webhook-secret (the fn hard-401s, fail-closed) and (b) the
-- LEGACY HS256 service_role JWT that was REVOKED in the June key rotation —
-- dead twice over; the first comment ever posted would notify nobody.
-- Rebuild as a plpgsql trigger using net.http_post with DYNAMIC headers:
-- Bearer from Vault (current key), secret from the app.webhook_secret GUC
-- (stays null → fn keeps 401ing until the operator sets the GUC — no worse
-- than today, and correct the moment it's set).
CREATE OR REPLACE FUNCTION public.notify_session_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/comment-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
      'x-sporeus-webhook-secret', current_setting('app.webhook_secret', true)
    ),
    body    := jsonb_build_object('type', 'INSERT', 'table', 'session_comments', 'record', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "comment-notification" ON public.session_comments;
DROP TRIGGER IF EXISTS trg_session_comment_notify ON public.session_comments;
CREATE TRIGGER trg_session_comment_notify
  AFTER INSERT ON public.session_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_session_comment();

-- ── F13 (LOW): cron.job_run_details had 498k rows and no purge job (F2 alone
-- added 1,440 failure rows/day). Standard 7-day retention.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-run-details') THEN
    PERFORM cron.unschedule('purge-cron-run-details');
  END IF;
END $$;
SELECT cron.schedule(
  'purge-cron-run-details',
  '15 2 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
