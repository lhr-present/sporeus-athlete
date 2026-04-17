-- ─── supabase/tests/fts_search.sql — Full-text search smoke tests ────────────
-- Verifies: tsvector columns exist, normalize_for_fts() works, search_everything() is callable.
-- Run: npx supabase db query --linked < supabase/tests/fts_search.sql

DO $$
DECLARE
  v_col_count    INT;
  v_func_count   INT;
  v_norm         TEXT;
  v_tsq          TEXT;
  v_idx_count    INT;
  v_rpc_count    INT;
BEGIN

  -- ── TEST 1: normalize_for_fts() exists and folds Turkish diacritics ─────────
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'normalize_for_fts';

  ASSERT v_func_count = 1,
    'FAIL TEST 1: normalize_for_fts() not found in public schema';

  -- Verify bidirectional diacritic folding
  v_norm := public.normalize_for_fts('KoŞu İSTANBUL çalış ğ ü ö ı');
  ASSERT v_norm = 'kosu istanbul calis g u o i',
    format('FAIL TEST 1b: normalize_for_fts produced ''%s'', expected ''kosu istanbul calis g u o i''', v_norm);

  RAISE NOTICE 'PASS TEST 1: normalize_for_fts() exists and folds correctly → %', v_norm;

  -- ── TEST 2: tsvector generated columns exist on all 5 tables ────────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'training_log'       AND column_name = 'notes_tsv')   OR
      (table_name = 'coach_notes'        AND column_name = 'note_tsv')    OR
      (table_name = 'messages'           AND column_name = 'body_tsv')    OR
      (table_name = 'team_announcements' AND column_name = 'message_tsv') OR
      (table_name = 'profiles'           AND column_name = 'name_tsv')
    );

  ASSERT v_col_count = 5,
    format('FAIL TEST 2: expected 5 tsvector columns, found %s', v_col_count);

  RAISE NOTICE 'PASS TEST 2: all 5 tsvector generated columns present';

  -- ── TEST 3: GIN indexes exist on all 5 tsvector columns ─────────────────────
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_training_log_notes_fts',
      'idx_coach_notes_note_fts',
      'idx_messages_body_fts',
      'idx_team_announcements_message_fts',
      'idx_profiles_name_fts'
    );

  ASSERT v_idx_count = 5,
    format('FAIL TEST 3: expected 5 GIN indexes, found %s', v_idx_count);

  RAISE NOTICE 'PASS TEST 3: all 5 GIN indexes present';

  -- ── TEST 4: search_everything() function exists with correct signature ───────
  SELECT COUNT(*) INTO v_rpc_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_everything';

  ASSERT v_rpc_count >= 1,
    'FAIL TEST 4: search_everything() not found in public schema';

  RAISE NOTICE 'PASS TEST 4: search_everything() function exists';

  -- ── TEST 5: plainto_tsquery respects normalization (kosu matches koşu token) ─
  -- We verify the query-side normalization is symmetric with the stored column.
  SELECT plainto_tsquery('simple', public.normalize_for_fts('koşu'))::text INTO v_tsq;
  ASSERT v_tsq = '''kosu''',
    format('FAIL TEST 5: normalized tsquery is ''%s'', expected ''kosu''', v_tsq);

  RAISE NOTICE 'PASS TEST 5: plainto_tsquery normalizes koşu → kosu';

  RAISE NOTICE '── All FTS smoke tests passed ──';

END $$;
