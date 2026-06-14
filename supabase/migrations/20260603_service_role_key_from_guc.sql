-- 20260603_service_role_key_from_guc.sql — service_role key rotation step
--
-- Part of the CRITICAL service_role-leak remediation
-- (docs/ops/h1_security_deploy_runbook.md → Step A).
--
-- Background: four 2026-04-24 migrations hardcoded a valid service_role JWT into
-- pg_cron commands and two embed helper functions. The *source* has been scrubbed
-- to the `app.service_role_key` GUC pattern (the same pattern 20260427_pgmq_queues
-- already uses for ai-batch-worker / enqueue-ai-batch / strava-backfill-worker),
-- but the LIVE database still carries the hardcoded bearer in those jobs/functions
-- until this migration runs.
--
-- APPLY in the rotation window, AFTER rolling the key in the Supabase dashboard and:
--     ALTER DATABASE postgres SET app.service_role_key = '<NEW service_role key>';
-- The GUC is read at session start, so open a FRESH connection before applying
-- (the supabase CLI does this per migration).
--
-- Idempotent: only rewrites callers that still carry a literal `Bearer eyJ...`.
--   GUC-based callers (which contain `|| current_setting(...) ||`, not `Bearer eyJ`)
--   are skipped by the filter. Re-running after success is a no-op.
-- Safe-by-guard: refuses to run if the GUC is empty, which would otherwise brick
--   every rewritten caller with an empty bearer token.

DO $$
DECLARE
  guc      text := current_setting('app.service_role_key', true);
  -- Matches a `headers := '<json literal>'::jsonb` assignment (non-greedy: the
  -- char class stops at the closing quote, so `body := '{}'::jsonb` is untouched).
  hdr_rx   constant text := 'headers\s*:=\s*''[^'']*''::jsonb';
  hdr_new  constant text :=
    'headers := jsonb_build_object(''Authorization'', ''Bearer '' || current_setting(''app.service_role_key'', true), ''Content-Type'', ''application/json'')';
  j        record;
  p        record;
  new_cmd  text;
  fn_def   text;
  new_def  text;
BEGIN
  IF guc IS NULL OR length(trim(guc)) = 0 THEN
    RAISE EXCEPTION
      'app.service_role_key GUC is empty — run `ALTER DATABASE postgres SET app.service_role_key = ''<NEW key>''` and reconnect BEFORE applying this migration';
  END IF;

  -- ── pg_cron jobs still carrying a hardcoded bearer ──────────────────────────
  FOR j IN
    SELECT jobid, jobname, schedule, command
    FROM   cron.job
    WHERE  command ILIKE '%Bearer eyJ%'
  LOOP
    new_cmd := regexp_replace(j.command, hdr_rx, hdr_new, 'gi');
    IF new_cmd = j.command THEN
      RAISE WARNING 'service_role-guc: could not rewrite cron % (headers literal not matched) — patch manually', j.jobname;
      CONTINUE;
    END IF;
    PERFORM cron.unschedule(j.jobid);
    PERFORM cron.schedule(j.jobname, j.schedule, new_cmd);
    RAISE NOTICE 'service_role-guc: rewrote cron %', j.jobname;
  END LOOP;

  -- ── functions still carrying a hardcoded bearer (on_training_log_embed,
  --    embed_backfill_batch, and any future SECURITY DEFINER caller) ───────────
  FOR p IN
    SELECT p.oid, (n.nspname || '.' || p.proname) AS fqn
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  pg_get_functiondef(p.oid) ILIKE '%Bearer eyJ%'
  LOOP
    fn_def  := pg_get_functiondef(p.oid);
    new_def := regexp_replace(fn_def, hdr_rx, hdr_new, 'gi');
    IF new_def = fn_def THEN
      RAISE WARNING 'service_role-guc: could not rewrite fn % (headers literal not matched) — patch manually', p.fqn;
      CONTINUE;
    END IF;
    EXECUTE new_def;
    RAISE NOTICE 'service_role-guc: rewrote fn %', p.fqn;
  END LOOP;
END $$;
