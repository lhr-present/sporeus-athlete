-- 20260635_webhook_secret_headers_round2.sql — close the cron-secret repo-drift
--
-- v9.407 (PR #7) hardened five more edge functions with isVerifiedServiceCall
-- (nightly-batch, purge-deleted-accounts, operator-digest, alert-monitor,
-- check-dependencies) and patched their pg_cron jobs LIVE via cron.alter_job to
-- send `x-sporeus-webhook-secret` — but no migration recorded it. A branch
-- provisioned from the repo would create those crons WITHOUT the header and
-- every call would 401 against the hardened functions.
--
-- This migration replays that live patch with the same idempotent method as
-- 20260601_webhook_secret_headers.sql (which covered the original 7 jobs):
-- wrap the existing `headers := <expr>` and merge the secret header from the
-- `app.webhook_secret` GUC. On prod it is a NO-OP (all five jobs already carry
-- the header → skipped); on a fresh branch it patches whatever subset of the
-- jobs earlier migrations created (missing jobs are simply not matched —
-- e.g. `nightly-batch` exists only in prod, replaced by `enqueue-ai-batch`
-- in 20260427). An unset GUC yields a null header value, same as 20260601.

DO $$
DECLARE
  j         record;
  new_cmd   text;
  rx        constant text := '(headers\s*:=\s*)(.+?)(,\s*body\s*:=)';
  repl      constant text :=
    '\1(\2) || jsonb_build_object(''x-sporeus-webhook-secret'', current_setting(''app.webhook_secret'', true))\3';
BEGIN
  FOR j IN
    SELECT jobid, jobname, schedule, command
    FROM cron.job
    WHERE jobname IN (
      'nightly-batch','purge-deleted-accounts','operator-digest-weekly',
      'alert-monitor','check-dependencies'
    )
  LOOP
    IF j.command ILIKE '%x-sporeus-webhook-secret%' THEN
      CONTINUE;  -- already patched (prod path)
    END IF;
    new_cmd := regexp_replace(j.command, rx, repl, 'is');
    IF new_cmd = j.command THEN
      RAISE WARNING 'webhook-secret r2: could not patch cron % (headers/body pattern not matched) — patch manually', j.jobname;
      CONTINUE;
    END IF;
    PERFORM cron.unschedule(j.jobid);
    PERFORM cron.schedule(j.jobname, j.schedule, new_cmd);
    RAISE NOTICE 'webhook-secret r2: patched cron %', j.jobname;
  END LOOP;
END $$;
