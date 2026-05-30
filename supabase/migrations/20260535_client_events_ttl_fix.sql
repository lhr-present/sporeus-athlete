-- 20260535_client_events_ttl_fix.sql — H4 (HIGH)
--
-- client_events was defined twice. 20260424_ops_tables (runs first, CREATE
-- TABLE IF NOT EXISTS wins) created the LIVE table with a `created_at` column.
-- 20260450_client_events then created:
--   • a cron job `client-events-ttl`: DELETE ... WHERE ts < now()-30d
--   • indexes on `ts`
-- but the live table has NO `ts` column → the TTL cron errors every run and the
-- `ts` indexes never built. The 30-day TTL never runs → unbounded growth.
--
-- (20260424 also created a separate, correct cron `purge-client-events` on
-- created_at. We leave that intact and repair the broken one so neither
-- silently fails; both deleting the same rows is harmless/idempotent.)
--
-- Fix: repoint cron `client-events-ttl` + create the missing analytics indexes
-- at `created_at`. Guarded so it no-ops if the column/extension is absent.

DO $$
DECLARE
  v_col text;
BEGIN
  IF to_regclass('public.client_events') IS NULL THEN
    RAISE NOTICE 'client_events absent — skipping';
    RETURN;
  END IF;

  -- Determine the real timestamp column (created_at on the live schema; ts on
  -- the alternate). Prefer created_at.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='client_events' AND column_name='created_at') THEN
    v_col := 'created_at';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='client_events' AND column_name='ts') THEN
    v_col := 'ts';
  ELSE
    RAISE NOTICE 'client_events has neither created_at nor ts — skipping';
    RETURN;
  END IF;

  -- Indexes targeting the real column (originals on `ts` may not exist)
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_client_events_ttl_col ON public.client_events (%I DESC)', v_col);
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_client_events_type_tcol ON public.client_events (event_type, %I DESC)', v_col);

  -- Repoint the broken TTL cron, if pg_cron is installed
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'client-events-ttl';
    PERFORM cron.schedule(
      'client-events-ttl',
      '0 4 * * *',
      format('DELETE FROM public.client_events WHERE %I < now() - interval ''30 days''', v_col)
    );
  END IF;
END $$;
