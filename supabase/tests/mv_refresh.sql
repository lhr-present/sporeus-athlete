-- ─── supabase/tests/mv_refresh.sql — MV refresh smoke tests ──────────────────
-- Run against a linked instance:
--   npx supabase db query --linked < supabase/tests/mv_refresh.sql
--
-- Tests:
--   1. Seeds 100 training_log rows for a test user
--   2. Calls refresh_mv_load() directly
--   3. Asserts mv_ctl_atl_daily has >= 100 rows for test user
--   4. Asserts mv_weekly_load_summary has >= 14 rows for test user
--   5. Asserts last mv_refresh_log entry has duration_ms IS NOT NULL
--   6. Asserts last mv_refresh_log entry view_name = 'mv_ctl_atl_daily'
--   7. Times the refresh and raises NOTICE with duration
--   8. Cleanup test data

DO $$
DECLARE
  v_uid        uuid    := '00000000-0000-0000-0000-bbbbbbbbbb01';
  v_ctlatl_cnt bigint;
  v_weekly_cnt bigint;
  v_log_row    RECORD;
  v_t_start    timestamptz;
  v_t_end      timestamptz;
  v_dur_ms     int;
  i            int;
BEGIN
  -- ── Setup: ensure test user exists in profiles (insert or ignore) ──────────
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (v_uid, 'mv_test@sporeus.test', 'MV Test Athlete', 'athlete')
  ON CONFLICT (id) DO NOTHING;

  -- ── Cleanup any leftover test data from prior runs ────────────────────────
  DELETE FROM public.training_log WHERE user_id = v_uid;
  DELETE FROM public.mv_refresh_log WHERE view_name IN (
    'mv_ctl_atl_daily', 'mv_weekly_load_summary', 'mv_squad_readiness'
  );

  -- ── TEST SETUP: Seed 100 training_log rows (last 100 days) ────────────────
  FOR i IN 0..99 LOOP
    INSERT INTO public.training_log (user_id, date, tss, duration_min, rpe, type)
    VALUES (
      v_uid,
      CURRENT_DATE - i,
      (50 + floor(random() * 50))::numeric,
      (45 + floor(random() * 60))::numeric,
      (5 + floor(random() * 5))::int,
      'run'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'SETUP: Seeded 100 training_log rows for test user %', v_uid;

  -- ── TEST 1: Before refresh, MV may not have rows yet ─────────────────────
  -- (We just assert the table is accessible; rows are stale until refresh)
  SELECT COUNT(*) INTO v_ctlatl_cnt
  FROM public.mv_ctl_atl_daily
  WHERE user_id = v_uid;

  RAISE NOTICE 'TEST 1: mv_ctl_atl_daily rows before refresh = % (stale ok)', v_ctlatl_cnt;

  -- ── TEST 2: Call refresh_mv_load() directly ───────────────────────────────
  v_t_start := clock_timestamp();
  PERFORM public.refresh_mv_load();
  v_t_end   := clock_timestamp();
  v_dur_ms  := EXTRACT(EPOCH FROM (v_t_end - v_t_start)) * 1000;

  RAISE NOTICE 'TEST 2 PASSED: refresh_mv_load() completed in %ms', v_dur_ms;

  -- ── TEST 3: mv_ctl_atl_daily has >= 100 rows for test user ────────────────
  SELECT COUNT(*) INTO v_ctlatl_cnt
  FROM public.mv_ctl_atl_daily
  WHERE user_id = v_uid;

  ASSERT v_ctlatl_cnt >= 100,
    format('TEST 3 FAILED: expected >= 100 rows in mv_ctl_atl_daily, got %s', v_ctlatl_cnt);

  RAISE NOTICE 'TEST 3 PASSED: mv_ctl_atl_daily has % rows for test user', v_ctlatl_cnt;

  -- ── TEST 4: mv_weekly_load_summary has >= 14 rows (100 days ≈ 14+ weeks) ──
  SELECT COUNT(*) INTO v_weekly_cnt
  FROM public.mv_weekly_load_summary
  WHERE user_id = v_uid;

  ASSERT v_weekly_cnt >= 14,
    format('TEST 4 FAILED: expected >= 14 weekly rows, got %s', v_weekly_cnt);

  RAISE NOTICE 'TEST 4 PASSED: mv_weekly_load_summary has % rows for test user', v_weekly_cnt;

  -- ── TEST 5: Last mv_refresh_log entry has duration_ms IS NOT NULL ─────────
  SELECT *
  INTO   v_log_row
  FROM   public.mv_refresh_log
  ORDER  BY id DESC
  LIMIT  1;

  ASSERT v_log_row.duration_ms IS NOT NULL,
    'TEST 5 FAILED: last mv_refresh_log.duration_ms is NULL';

  RAISE NOTICE 'TEST 5 PASSED: last refresh log duration_ms = %ms', v_log_row.duration_ms;

  -- ── TEST 6: Last mv_refresh_log has view_name = mv_squad_readiness ─────────
  -- (mv_squad_readiness is the last view refreshed in refresh_mv_load())
  ASSERT v_log_row.view_name = 'mv_squad_readiness',
    format('TEST 6 FAILED: expected view_name=mv_squad_readiness, got %s', v_log_row.view_name);

  RAISE NOTICE 'TEST 6 PASSED: last refresh log view_name = %', v_log_row.view_name;

  -- Also check that mv_ctl_atl_daily was logged
  SELECT *
  INTO   v_log_row
  FROM   public.mv_refresh_log
  WHERE  view_name = 'mv_ctl_atl_daily'
  ORDER  BY id DESC
  LIMIT  1;

  ASSERT v_log_row.view_name = 'mv_ctl_atl_daily',
    'TEST 6b FAILED: no mv_refresh_log entry for mv_ctl_atl_daily';

  RAISE NOTICE 'TEST 6b PASSED: mv_ctl_atl_daily refresh logged';

  -- ── TEST 7: Timing assertion — refresh ran (dur_ms > 0) ───────────────────
  ASSERT v_dur_ms > 0,
    format('TEST 7 FAILED: duration_ms should be > 0, got %s', v_dur_ms);

  RAISE NOTICE 'TEST 7 PASSED: total refresh_mv_load() wall time = %ms', v_dur_ms;

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  DELETE FROM public.training_log WHERE user_id = v_uid;
  DELETE FROM public.mv_refresh_log WHERE view_name IN (
    'mv_ctl_atl_daily', 'mv_weekly_load_summary', 'mv_squad_readiness'
  );
  -- Leave profile row (other tests may rely on it)

  RAISE NOTICE '──────────────────────────────────────────────────';
  RAISE NOTICE 'PASS: All MV refresh tests passed';
  RAISE NOTICE '──────────────────────────────────────────────────';

EXCEPTION WHEN OTHERS THEN
  -- Cleanup on failure too
  DELETE FROM public.training_log WHERE user_id = v_uid;
  RAISE EXCEPTION 'mv_refresh test FAILED: %', SQLERRM;
END;
$$;
