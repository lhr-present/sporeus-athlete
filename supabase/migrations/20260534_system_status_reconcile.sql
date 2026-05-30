-- 20260534_system_status_reconcile.sql — H3 (HIGH)
--
-- system_status was defined twice with divergent schemas. Because both use
-- CREATE TABLE IF NOT EXISTS and 20260424_ops_tables runs BEFORE
-- 20260449_system_status, the LIVE table is the ops_tables version:
--   • NO latency_ms column
--   • status CHECK = (up, down, degraded, unknown)   ← excludes 'ok'
--
-- But check-dependencies/index.ts upserts status:'ok' + latency_ms, and the
-- get_system_status() RPC (20260449) SELECTs latency_ms. So on the live schema:
--   • the missing column makes the upsert AND the RPC fail, and
--   • the CHECK rejects 'ok'.
-- → monitoring is silently dead.
--
-- Fix: add latency_ms; widen the status CHECK to accept BOTH the ops_tables
-- vocabulary ('up') and the check-dependencies vocabulary ('ok','degraded',
-- 'down','unknown'). Idempotent + tolerant of whichever schema is live.

DO $$
DECLARE
  v_conname text;
BEGIN
  IF to_regclass('public.system_status') IS NULL THEN
    RAISE NOTICE 'system_status absent — skipping';
    RETURN;
  END IF;

  -- 1. Add latency_ms if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_status'
      AND column_name = 'latency_ms'
  ) THEN
    ALTER TABLE public.system_status ADD COLUMN latency_ms int;
  END IF;

  -- 2. Drop any existing CHECK constraint on `status` (name differs per env)
  FOR v_conname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'system_status'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.system_status DROP CONSTRAINT %I', v_conname);
  END LOOP;

  -- 3. Re-add a single CHECK covering both vocabularies
  ALTER TABLE public.system_status
    ADD CONSTRAINT system_status_status_check
    CHECK (status IN ('ok', 'up', 'degraded', 'down', 'unknown'));
END $$;
