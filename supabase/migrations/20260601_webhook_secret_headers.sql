-- 20260601_webhook_secret_headers.sql — H1 deploy step (DO NOT apply standalone)
--
-- ⚠️ Part of the coordinated H1 security rollout (v9.354 hardened the edge
-- functions to require a shared secret instead of a forgeable JWT-role claim).
-- This migration adds the `x-sporeus-webhook-secret` header to every SQL-driven
-- invocation of a hardened function, sourcing the value at run time from the
-- `app.webhook_secret` database GUC.
--
-- APPLY ONLY as part of the runbook (docs/ops/h1_security_deploy_runbook.md),
-- after `ALTER DATABASE ... SET app.webhook_secret = '<secret>'`. Applying it
-- early is harmless (the not-yet-deployed/old functions ignore the extra
-- header; an unset GUC yields a null header value), but it should be applied
-- and verified inside the deploy window.
--
-- Scope (hardened functions invoked from SQL):
--   • 7 pg_cron jobs: ai-batch-worker, enqueue-ai-batch, generate-report-weekly,
--     generate-report-monthly-squad, push-worker, strava-backfill-worker,
--     trigger-checkin-reminders
--   • 1 trigger fn: on_training_log_embed() → embed-session
-- NOT touched (deliberate): adjust-coach-plan / analyse-session are client-
--   invoked on their user-JWT path (not the secret-gated service path);
--   send-push is reached edge-to-edge and the caller already forwards the
--   secret in code (v9.354). Non-hardened crons (alert-monitor,
--   check-dependencies, nightly-batch, operator-digest, purge-deleted-accounts)
--   are left alone.
--
-- Method: wrap each existing `headers := <expr>` in parens and merge the secret
-- header via `|| jsonb_build_object(...)`. Because <expr> is the expression that
-- already runs in prod, the wrap cannot introduce a NEW failure. Idempotent:
-- skips anything already carrying the secret header.

DO $$
DECLARE
  j         record;
  new_cmd   text;
  fn_def    text;
  new_def   text;
  rx        constant text := '(headers\s*:=\s*)(.+?)(,\s*body\s*:=)';
  repl      constant text :=
    '\1(\2) || jsonb_build_object(''x-sporeus-webhook-secret'', current_setting(''app.webhook_secret'', true))\3';
BEGIN
  -- ── 7 cron jobs ────────────────────────────────────────────────────────────
  FOR j IN
    SELECT jobid, jobname, schedule, command
    FROM cron.job
    WHERE jobname IN (
      'ai-batch-worker','enqueue-ai-batch','generate-report-weekly',
      'generate-report-monthly-squad','push-worker','strava-backfill-worker',
      'trigger-checkin-reminders'
    )
  LOOP
    IF j.command ILIKE '%x-sporeus-webhook-secret%' THEN
      CONTINUE;  -- already patched
    END IF;
    new_cmd := regexp_replace(j.command, rx, repl, 'is');
    IF new_cmd = j.command THEN
      RAISE WARNING 'webhook-secret: could not patch cron % (headers/body pattern not matched) — patch manually', j.jobname;
      CONTINUE;
    END IF;
    PERFORM cron.unschedule(j.jobid);
    PERFORM cron.schedule(j.jobname, j.schedule, new_cmd);
    RAISE NOTICE 'webhook-secret: patched cron %', j.jobname;
  END LOOP;

  -- ── on_training_log_embed() trigger fn → embed-session ──────────────────────
  IF to_regclass('public.training_log') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='on_training_log_embed') THEN
    fn_def := pg_get_functiondef('public.on_training_log_embed()'::regprocedure);
    IF fn_def ILIKE '%x-sporeus-webhook-secret%' THEN
      RAISE NOTICE 'webhook-secret: on_training_log_embed already patched';
    ELSE
      new_def := regexp_replace(fn_def, rx, repl, 'is');
      IF new_def = fn_def THEN
        RAISE WARNING 'webhook-secret: could not patch on_training_log_embed — patch manually';
      ELSE
        EXECUTE new_def;
        RAISE NOTICE 'webhook-secret: patched on_training_log_embed';
      END IF;
    END IF;
  END IF;
END $$;
