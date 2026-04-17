-- ─── supabase/tests/mv_trigger_debounce.sql — debounce upsert smoke tests ─────
-- Run against a linked instance:
--   npx supabase db query --linked < supabase/tests/mv_trigger_debounce.sql
--
-- Tests:
--   1. Ensures mv_refresh_pending is empty for 'mv_squad_readiness'
--   2. Performs 20 upserts into mv_refresh_pending — simulates 20 trigger fires
--   3. Asserts exactly 1 row exists (debounce / upsert idempotence)
--   4. Calls maybe_refresh_squad_mv() — clears pending row + refreshes MV
--   5. Asserts 0 rows pending after call
--   6. Calls maybe_refresh_squad_mv() again with no pending row (no-op)
--   7. Asserts still 0 rows pending (idempotent no-op)
--   8. Cleanup

DO $$
DECLARE
  v_pending_cnt bigint;
  i             int;
BEGIN
  -- ── TEST 1: Start with clean slate ────────────────────────────────────────
  DELETE FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  SELECT COUNT(*) INTO v_pending_cnt
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT v_pending_cnt = 0,
    format('TEST 1 FAILED: expected 0 pending rows, got %s', v_pending_cnt);

  RAISE NOTICE 'TEST 1 PASSED: mv_refresh_pending is clean for mv_squad_readiness';

  -- ── TEST 2: 20 upserts into mv_refresh_pending (debounce simulation) ──────
  -- Each trigger call does:
  --   INSERT INTO mv_refresh_pending (view_name, requested_at)
  --   VALUES ('mv_squad_readiness', now())
  --   ON CONFLICT (view_name) DO UPDATE SET requested_at = EXCLUDED.requested_at;
  -- So 20 fires must still produce exactly 1 row.

  FOR i IN 1..20 LOOP
    INSERT INTO public.mv_refresh_pending (view_name, requested_at)
    VALUES ('mv_squad_readiness', now())
    ON CONFLICT (view_name) DO UPDATE
      SET requested_at = EXCLUDED.requested_at;
  END LOOP;

  RAISE NOTICE 'TEST 2: 20 upserts performed for mv_squad_readiness';

  -- ── TEST 3: Exactly 1 row should exist (not 20) ───────────────────────────
  SELECT COUNT(*) INTO v_pending_cnt
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT v_pending_cnt = 1,
    format('TEST 3 FAILED: expected 1 pending row after 20 upserts, got %s', v_pending_cnt);

  RAISE NOTICE 'TEST 3 PASSED: exactly 1 pending row after 20 upserts (debounce correct)';

  -- ── TEST 4: Call maybe_refresh_squad_mv() — drains pending + refreshes MV ─
  PERFORM public.maybe_refresh_squad_mv();

  RAISE NOTICE 'TEST 4: maybe_refresh_squad_mv() called';

  -- ── TEST 5: 0 rows pending after the drain ────────────────────────────────
  SELECT COUNT(*) INTO v_pending_cnt
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT v_pending_cnt = 0,
    format('TEST 5 FAILED: expected 0 pending rows after maybe_refresh_squad_mv(), got %s', v_pending_cnt);

  RAISE NOTICE 'TEST 5 PASSED: 0 pending rows after drain';

  -- ── TEST 6: Second call with no pending row — should be a no-op ───────────
  PERFORM public.maybe_refresh_squad_mv();

  RAISE NOTICE 'TEST 6: maybe_refresh_squad_mv() called again (no-op expected)';

  -- ── TEST 7: Still 0 pending rows (idempotent) ─────────────────────────────
  SELECT COUNT(*) INTO v_pending_cnt
  FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  ASSERT v_pending_cnt = 0,
    format('TEST 7 FAILED: expected 0 pending rows after no-op call, got %s', v_pending_cnt);

  RAISE NOTICE 'TEST 7 PASSED: still 0 pending rows after no-op call (idempotent)';

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  DELETE FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';

  RAISE NOTICE '──────────────────────────────────────────────────';
  RAISE NOTICE 'PASS: Debounce tests passed';
  RAISE NOTICE '──────────────────────────────────────────────────';

EXCEPTION WHEN OTHERS THEN
  DELETE FROM public.mv_refresh_pending
  WHERE view_name = 'mv_squad_readiness';
  RAISE EXCEPTION 'mv_trigger_debounce test FAILED: %', SQLERRM;
END;
$$;
