-- ── Enhancement 1: Revoke MV access from anon / authenticated ────────────────
-- MVs don't support RLS; all rows would leak to any authenticated user.
-- Only generate-report (service_role) queries these — revoke REST API access.

REVOKE SELECT ON public.mv_ctl_atl_daily       FROM anon, authenticated;
REVOKE SELECT ON public.mv_weekly_load_summary  FROM anon, authenticated;
REVOKE SELECT ON public.mv_squad_readiness      FROM anon, authenticated;

-- ── Enhancement 2: Auto-embed trigger on training_log ─────────────────────────
-- Fires on INSERT and on UPDATE when semantic fields change.
-- embed-session handles content_hash dedup — safe to call multiple times.

CREATE OR REPLACE FUNCTION public.on_training_log_embed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/embed-session',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'session_id', NEW.id::text,
                 'user_id',    NEW.user_id::text,
                 'source',     'db_webhook'
               )
  );
  RETURN NEW;
END;
$$;

-- INSERT: always embed new sessions
CREATE OR REPLACE TRIGGER trg_training_log_embed_insert
  AFTER INSERT ON public.training_log
  FOR EACH ROW
  EXECUTE FUNCTION public.on_training_log_embed();

-- UPDATE: only re-embed when semantic content changes
CREATE OR REPLACE TRIGGER trg_training_log_embed_update
  AFTER UPDATE ON public.training_log
  FOR EACH ROW
  WHEN (
    NEW.notes        IS DISTINCT FROM OLD.notes        OR
    NEW.type         IS DISTINCT FROM OLD.type         OR
    NEW.tss          IS DISTINCT FROM OLD.tss          OR
    NEW.rpe          IS DISTINCT FROM OLD.rpe          OR
    NEW.duration_min IS DISTINCT FROM OLD.duration_min
  )
  EXECUTE FUNCTION public.on_training_log_embed();

-- ── Enhancement 3: Backfill function + cron ───────────────────────────────────
-- Processes up to 50 sessions per run that have no embedding yet.
-- Runs every 10 minutes; becomes a no-op once all sessions are embedded.

CREATE OR REPLACE FUNCTION public.embed_backfill_batch(batch_size int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rec RECORD;
  cnt int := 0;
BEGIN
  FOR rec IN
    SELECT tl.id, tl.user_id
    FROM   public.training_log tl
    LEFT JOIN public.session_embeddings se ON se.session_id = tl.id
    WHERE  se.session_id IS NULL
    ORDER  BY tl.date DESC
    LIMIT  batch_size
  LOOP
    PERFORM net.http_post(
      url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/embed-session',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWNxd2FwdnZmZW1wamRnd2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0Njk5NywiZXhwIjoyMDkxNDIyOTk3fQ.SSHPDRLiu0VUXlG8CIXrzPOqXPRFspxMgQOHDflX4n0", "Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object(
                   'session_id', rec.id::text,
                   'user_id',    rec.user_id::text,
                   'source',     'db_webhook'
                 )
    );
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

SELECT cron.schedule(
  'embed-backfill',
  '*/10 * * * *',
  'SELECT public.embed_backfill_batch(50)'
);
