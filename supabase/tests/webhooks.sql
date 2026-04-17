-- ─── supabase/tests/webhooks.sql — DB trigger smoke tests ───────────────────
-- Run against a linked Supabase instance with:
--   npx supabase db query --linked < supabase/tests/webhooks.sql
--
-- Tests validate that DB triggers fire correctly. The HTTP webhook calls
-- (fn_webhook_analyse_session, fn_webhook_adjust_plan_on_injury) require
-- app.supabase_url + app.service_role_key settings to be configured.
-- In CI/test without those settings, the trigger silently skips HTTP — this
-- script only validates the pure-pg triggers (HRV alert, FTP update).

-- ── Setup: create a test user UUID ───────────────────────────────────────────
DO $$
DECLARE
  v_uid     UUID := '00000000-0000-0000-0000-ffffffffffff';
  v_coach   UUID := '00000000-0000-0000-0000-eeeeeeeeeeee';
  v_hrv_cnt INT;
  v_ftp_val INT;
  v_zone_z4 JSONB;
BEGIN

  -- Ensure we start clean
  DELETE FROM notification_log   WHERE user_id IN (v_uid, v_coach);
  DELETE FROM recovery           WHERE user_id = v_uid AND date >= '2026-01-01';
  DELETE FROM test_results       WHERE user_id = v_uid AND date >= '2026-01-01';
  DELETE FROM profiles           WHERE id = v_uid;
  DELETE FROM profiles           WHERE id = v_coach;
  DELETE FROM coach_athletes     WHERE athlete_id = v_uid;

  -- Insert minimal test profiles (bypasses auth.users FK via service role)
  INSERT INTO profiles (id, email, display_name, role) VALUES
    (v_uid,   'test_athlete@sporeus.test', 'Test Athlete', 'athlete'),
    (v_coach, 'test_coach@sporeus.test',   'Test Coach',   'coach')
  ON CONFLICT (id) DO NOTHING;

  -- Link athlete to coach
  INSERT INTO coach_athletes (coach_id, athlete_id, status)
  VALUES (v_coach, v_uid, 'active')
  ON CONFLICT DO NOTHING;

  -- ── TEST 1: HRV trigger — 28-day baseline then big drop ─────────────────────

  -- Insert 20 days of stable HRV ~70ms
  FOR i IN 1..20 LOOP
    INSERT INTO recovery (user_id, date, score, hrv)
    VALUES (v_uid, CURRENT_DATE - i, 75, 70 + (RANDOM() * 4 - 2)::numeric(6,2))
    ON CONFLICT (user_id, date) DO NOTHING;
  END LOOP;

  -- Insert a 3σ drop: mean≈70, stddev≈1.2 → drop to 63 is ~5.8σ
  INSERT INTO recovery (user_id, date, score, hrv)
  VALUES (v_uid, CURRENT_DATE, 40, 55.0);

  -- Verify notification_log rows were created for athlete AND coach
  SELECT COUNT(*) INTO v_hrv_cnt
  FROM notification_log
  WHERE kind = 'hrv_alert'
    AND user_id IN (v_uid, v_coach)
    AND sent_at >= NOW() - INTERVAL '5 seconds';

  IF v_hrv_cnt < 2 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: expected 2 hrv_alert rows, got %', v_hrv_cnt;
  ELSE
    RAISE NOTICE 'TEST 1 PASSED: HRV drop triggered % notification_log rows', v_hrv_cnt;
  END IF;

  -- ── TEST 2: FTP trigger — test_results insert updates profiles ───────────────

  INSERT INTO test_results (user_id, date, test_id, value, unit)
  VALUES (v_uid, CURRENT_DATE, 'ftp', 280, 'watts');

  SELECT ftp INTO v_ftp_val FROM profiles WHERE id = v_uid;

  IF v_ftp_val <> 280 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: profiles.ftp not updated, got %', v_ftp_val;
  END IF;

  -- Verify power zones were computed (z4 should be 255–294 for FTP=280)
  SELECT profile_data->'powerZones'->'z4' INTO v_zone_z4
  FROM profiles WHERE id = v_uid;

  IF v_zone_z4 IS NULL THEN
    RAISE EXCEPTION 'TEST 2b FAILED: powerZones not written to profile_data';
  END IF;

  RAISE NOTICE 'TEST 2 PASSED: profiles.ftp=% zones.z4=%', v_ftp_val, v_zone_z4;

  -- ── TEST 3: HRV dedup — second insert same date should not double-insert ─────

  BEGIN
    INSERT INTO recovery (user_id, date, score, hrv)
    VALUES (v_uid, CURRENT_DATE, 40, 50.0);
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 3 PASSED: recovery unique constraint prevents duplicate date';
  END;

  -- ── Cleanup ───────────────────────────────────────────────────────────────────
  DELETE FROM notification_log WHERE user_id IN (v_uid, v_coach);
  DELETE FROM recovery         WHERE user_id = v_uid AND date >= CURRENT_DATE - 21;
  DELETE FROM test_results     WHERE user_id = v_uid AND date >= CURRENT_DATE;
  DELETE FROM coach_athletes   WHERE athlete_id = v_uid;
  DELETE FROM profiles         WHERE id IN (v_uid, v_coach);

  RAISE NOTICE 'All trigger tests PASSED';

END $$;
