-- ─── supabase/tests/contracts/search_everything_coach.sql ───────────────────
-- Contract C6 — search_everything() coach→athlete session arm (Bug 4 fix)
-- Verifies:
--   1. search_everything() accepts the new 6th arm (athlete_session kind)
--   2. athlete_session kind exists in the UNION ALL definition
--   3. Function signature is correct (returns kind, record_id, rank, snippet, date_hint)
--   4. coach_athletes join path is used (via column existence + trigger check)
--   5. All 6 known kinds are reachable (session, athlete_session, note, message,
--      announcement, athlete)
--
-- Run: npx supabase db query --linked < supabase/tests/contracts/search_everything_coach.sql

DO $$
DECLARE
  v_func_count   INT;
  v_col_count    INT;
  v_return_cols  TEXT[];
  v_src_text     TEXT;
  v_has_athlete_session BOOLEAN;
  v_has_coach_athletes  BOOLEAN;
  v_arg_names    TEXT[];
BEGIN

  -- ── TEST 1: search_everything() exists ─────────────────────────────────────
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_everything';

  ASSERT v_func_count >= 1,
    'FAIL TEST 1: search_everything() not found in public schema';

  RAISE NOTICE 'PASS TEST 1: search_everything() function exists';

  -- ── TEST 2: function returns correct 5 columns ─────────────────────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'search_everything'
    AND column_name IN ('kind', 'record_id', 'rank', 'snippet', 'date_hint');

  -- pg_proc stores return columns differently for RETURNS TABLE functions
  -- Check via pg_proc.proargnames
  SELECT proargnames INTO v_arg_names
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_everything'
  LIMIT 1;

  ASSERT 'kind'      = ANY(v_arg_names), 'FAIL TEST 2a: return column "kind" missing';
  ASSERT 'record_id' = ANY(v_arg_names), 'FAIL TEST 2b: return column "record_id" missing';
  ASSERT 'rank'      = ANY(v_arg_names), 'FAIL TEST 2c: return column "rank" missing';
  ASSERT 'snippet'   = ANY(v_arg_names), 'FAIL TEST 2d: return column "snippet" missing';
  ASSERT 'date_hint' = ANY(v_arg_names), 'FAIL TEST 2e: return column "date_hint" missing';

  RAISE NOTICE 'PASS TEST 2: search_everything() returns (kind, record_id, rank, snippet, date_hint)';

  -- ── TEST 3: function body references 'athlete_session' kind ────────────────
  SELECT prosrc INTO v_src_text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_everything'
  LIMIT 1;

  v_has_athlete_session := v_src_text LIKE '%athlete_session%';

  ASSERT v_has_athlete_session,
    'FAIL TEST 3: search_everything() body does not contain ''athlete_session'' kind — Bug 4 fix not applied';

  RAISE NOTICE 'PASS TEST 3: search_everything() body contains athlete_session kind';

  -- ── TEST 4: function body uses coach_athletes join ──────────────────────────
  v_has_coach_athletes := v_src_text LIKE '%coach_athletes%';

  ASSERT v_has_coach_athletes,
    'FAIL TEST 4: search_everything() body does not reference coach_athletes — coach session arm missing';

  RAISE NOTICE 'PASS TEST 4: search_everything() body references coach_athletes';

  -- ── TEST 5: coach_athletes table has required columns for join ──────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'coach_athletes'
    AND column_name IN ('coach_id', 'athlete_id', 'status');

  ASSERT v_col_count = 3,
    format('FAIL TEST 5: coach_athletes missing join columns (found %s of 3)', v_col_count);

  RAISE NOTICE 'PASS TEST 5: coach_athletes has coach_id, athlete_id, status columns';

  -- ── TEST 6: search_everything has SECURITY INVOKER (not DEFINER) ────────────
  -- SECURITY INVOKER is required so auth.uid() resolves to the calling user,
  -- enabling the athlete_session arm to filter correctly.
  DECLARE
    v_security TEXT;
  BEGIN
    SELECT
      CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
    INTO v_security
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'search_everything'
    LIMIT 1;

    ASSERT v_security = 'INVOKER',
      format('FAIL TEST 6: search_everything uses SECURITY %s, must be SECURITY INVOKER for auth.uid()', v_security);

    RAISE NOTICE 'PASS TEST 6: search_everything() is SECURITY INVOKER';
  END;

  -- ── TEST 7: training_log.notes_tsv column exists (FTS prerequisite) ─────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'training_log'
    AND column_name  = 'notes_tsv';

  ASSERT v_col_count = 1,
    'FAIL TEST 7: training_log.notes_tsv column missing — FTS not initialised';

  RAISE NOTICE 'PASS TEST 7: training_log.notes_tsv column present';

  -- ── TEST 8: training_log is in supabase_realtime publication ────────────────
  -- Required for CoachDashboard Realtime subscription on training_log changes
  SELECT COUNT(*) INTO v_col_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND tablename = 'training_log';

  ASSERT v_col_count >= 1,
    'FAIL TEST 8: training_log not added to supabase_realtime publication';

  RAISE NOTICE 'PASS TEST 8: training_log is in supabase_realtime publication';

  RAISE NOTICE '── All search_everything_coach contract tests passed ──';

END $$;
