-- ─── supabase/tests/contracts/mv_squad_readiness_triggers.sql ───────────────
-- Contract C7 — mv_squad_readiness refresh trigger chain validation
-- Verifies:
--   1. fn_request_squad_refresh() exists
--   2. Trigger on recovery fires fn_request_squad_refresh
--   3. Trigger on injuries fires fn_request_squad_refresh
--   4. mv_refresh_pending table exists with correct schema
--   5. Recovery INSERT → mv_refresh_pending has 'mv_squad_readiness' row
--   6. maybe_refresh_squad_mv() function exists
--   7. mv_squad_readiness MV exists with required columns
--   8. get_squad_overview() function exists
--
-- Run: npx supabase db query --linked < supabase/tests/contracts/mv_squad_readiness_triggers.sql

DO $$
DECLARE
  v_func_count   INT;
  v_trig_count   INT;
  v_col_count    INT;
  v_pending_row  RECORD;
  v_uid          uuid := '00000000-0000-0000-0000-cccccccccc01';
  v_has_row      BOOLEAN;
BEGIN

  -- ── TEST 1: fn_request_squad_refresh() exists ──────────────────────────────
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_request_squad_refresh';

  ASSERT v_func_count >= 1,
    'FAIL TEST 1: fn_request_squad_refresh() not found in public schema';

  RAISE NOTICE 'PASS TEST 1: fn_request_squad_refresh() function exists';

  -- ── TEST 2: trigger on recovery table exists ─────────────────────────────
  SELECT COUNT(*) INTO v_trig_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table  = 'recovery'
    AND trigger_name        = 'on_recovery_request_squad_refresh';

  ASSERT v_trig_count >= 1,
    'FAIL TEST 2: on_recovery_request_squad_refresh trigger not found on recovery table';

  RAISE NOTICE 'PASS TEST 2: on_recovery_request_squad_refresh trigger exists on recovery';

  -- ── TEST 3: trigger on injuries table exists ─────────────────────────────
  SELECT COUNT(*) INTO v_trig_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table  = 'injuries'
    AND trigger_name        = 'on_injuries_request_squad_refresh';

  ASSERT v_trig_count >= 1,
    'FAIL TEST 3: on_injuries_request_squad_refresh trigger not found on injuries table';

  RAISE NOTICE 'PASS TEST 3: on_injuries_request_squad_refresh trigger exists on injuries';

  -- ── TEST 4: mv_refresh_pending table has correct schema ──────────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'mv_refresh_pending'
    AND column_name IN ('view_name', 'requested_at');

  ASSERT v_col_count = 2,
    format('FAIL TEST 4: mv_refresh_pending missing columns (found %s of 2: view_name, requested_at)', v_col_count);

  RAISE NOTICE 'PASS TEST 4: mv_refresh_pending has view_name + requested_at columns';

  -- ── TEST 5: recovery INSERT triggers mv_refresh_pending upsert ──────────
  -- Setup: ensure test profile exists
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (v_uid, 'mv_trigger_test@sporeus.test', 'Trigger Test Athlete', 'athlete')
  ON CONFLICT (id) DO NOTHING;

  -- Clear any existing pending row
  DELETE FROM public.mv_refresh_pending WHERE view_name = 'mv_squad_readiness';

  -- Verify no pending row exists
  SELECT COUNT(*) > 0 INTO v_has_row
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT NOT v_has_row,
    'FAIL TEST 5 SETUP: mv_refresh_pending already has mv_squad_readiness row before INSERT';

  -- Fire the trigger by inserting a recovery row
  INSERT INTO public.recovery (user_id, date, hrv, resting_hr, sleep_hours, sleep_quality, mood_score)
  VALUES (v_uid, CURRENT_DATE, 55.0, 52, 7.5, 3, 3)
  ON CONFLICT DO NOTHING;

  -- Verify trigger fired and upserted mv_refresh_pending
  SELECT COUNT(*) > 0 INTO v_has_row
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT v_has_row,
    'FAIL TEST 5: recovery INSERT did not upsert mv_refresh_pending(mv_squad_readiness) — trigger chain broken';

  RAISE NOTICE 'PASS TEST 5: recovery INSERT → mv_refresh_pending upsert confirmed';

  -- Cleanup test data
  DELETE FROM public.recovery WHERE user_id = v_uid AND date = CURRENT_DATE;
  DELETE FROM public.mv_refresh_pending WHERE view_name = 'mv_squad_readiness';

  -- ── TEST 6: maybe_refresh_squad_mv() exists ──────────────────────────────
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'maybe_refresh_squad_mv';

  ASSERT v_func_count >= 1,
    'FAIL TEST 6: maybe_refresh_squad_mv() not found — cron drain function missing';

  RAISE NOTICE 'PASS TEST 6: maybe_refresh_squad_mv() function exists';

  -- ── TEST 7: mv_squad_readiness MV has required columns ──────────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'mv_squad_readiness'
    AND column_name IN ('athlete_id', 'coach_id', 'athlete_name', 'ctl_42d', 'atl_7d', 'acwr', 'last_date');

  ASSERT v_col_count = 7,
    format('FAIL TEST 7: mv_squad_readiness missing columns (found %s of 7)', v_col_count);

  RAISE NOTICE 'PASS TEST 7: mv_squad_readiness has all 7 required columns';

  -- ── TEST 8: get_squad_overview() function exists ─────────────────────────
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_squad_overview';

  ASSERT v_func_count >= 1,
    'FAIL TEST 8: get_squad_overview() not found — squad overview query function missing';

  RAISE NOTICE 'PASS TEST 8: get_squad_overview() function exists';

  -- ── TEST 9: pg_cron job for maybe_refresh_squad_mv is scheduled ─────────
  SELECT COUNT(*) INTO v_func_count
  FROM cron.job
  WHERE jobname = 'maybe-refresh-squad-mv';

  ASSERT v_func_count >= 1,
    'FAIL TEST 9: pg_cron job maybe-refresh-squad-mv not scheduled — MV will never refresh';

  RAISE NOTICE 'PASS TEST 9: pg_cron job maybe-refresh-squad-mv is scheduled';

  RAISE NOTICE '── All mv_squad_readiness_triggers contract tests passed ──';

EXCEPTION WHEN OTHERS THEN
  -- Cleanup on failure
  DELETE FROM public.recovery WHERE user_id = v_uid AND date = CURRENT_DATE;
  DELETE FROM public.mv_refresh_pending WHERE view_name = 'mv_squad_readiness';
  RAISE EXCEPTION 'mv_squad_readiness_triggers contract test FAILED: %', SQLERRM;
END $$;
