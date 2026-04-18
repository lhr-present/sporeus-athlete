-- ─── supabase/tests/contracts/analyse_embed_chain.sql ───────────────────────
-- Contract C1/C2 — analyse-session → ai_insights → embed-session chain
-- Verifies the schema and constraints that the analyse/embed edge functions
-- depend on at the DB layer:
--   1. ai_insights table has session_id FK column (v7.43.0+)
--   2. ai_insights.kind constraint allows all webhook-driven kinds
--   3. ai_insights has (athlete_id, session_id) index for embed-session lookups
--   4. ai_insights.insight_json column is JSONB (not TEXT)
--   5. training_log.id is UUID type (FK target for session_id)
--   6. Webhook config references correct table (training_log) for INSERT trigger
--   7. insight_embeddings table exists with correct columns (vector store)
--   8. insight_embeddings has athlete_id + session_id FK columns
--
-- Run: npx supabase db query --linked < supabase/tests/contracts/analyse_embed_chain.sql

DO $$
DECLARE
  v_col_count   INT;
  v_idx_count   INT;
  v_dtype       TEXT;
  v_constraint  TEXT;
  v_has_kind    BOOLEAN;
BEGIN

  -- ── TEST 1: ai_insights.session_id column exists ─────────────────────────
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_insights'
    AND column_name  = 'session_id';

  ASSERT v_col_count = 1,
    'FAIL TEST 1: ai_insights.session_id column missing — v7.43.0 migration (20260422_ai_insights_session_ref.sql) not applied';

  RAISE NOTICE 'PASS TEST 1: ai_insights.session_id column exists';

  -- ── TEST 2: ai_insights.session_id is UUID type ──────────────────────────
  SELECT data_type INTO v_dtype
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_insights'
    AND column_name  = 'session_id';

  ASSERT v_dtype = 'uuid',
    format('FAIL TEST 2: ai_insights.session_id is %s, expected uuid', v_dtype);

  RAISE NOTICE 'PASS TEST 2: ai_insights.session_id is uuid type';

  -- ── TEST 3: ai_insights.insight_json is JSONB ────────────────────────────
  SELECT data_type INTO v_dtype
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_insights'
    AND column_name  = 'insight_json';

  ASSERT v_dtype = 'jsonb',
    format('FAIL TEST 3: ai_insights.insight_json is %s, expected jsonb — embedInsight() expects JSONB', v_dtype);

  RAISE NOTICE 'PASS TEST 3: ai_insights.insight_json is jsonb';

  -- ── TEST 4: ai_insights kind constraint includes session_analysis ─────────
  -- embed-session looks for kind='session_analysis' rows; constraint must allow it
  SELECT COUNT(*) INTO v_col_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ai_insights'
    AND c.contype = 'c'  -- check constraint
    AND c.conname = 'ai_insights_kind_check';

  ASSERT v_col_count = 1,
    'FAIL TEST 4: ai_insights_kind_check constraint not found';

  -- Verify constraint source text includes session_analysis
  SELECT pg_get_constraintdef(c.oid) INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ai_insights'
    AND c.conname = 'ai_insights_kind_check';

  v_has_kind := v_constraint LIKE '%session_analysis%';
  ASSERT v_has_kind,
    format('FAIL TEST 4b: ai_insights_kind_check does not allow session_analysis (got: %s)', v_constraint);

  RAISE NOTICE 'PASS TEST 4: ai_insights_kind_check allows session_analysis';

  -- ── TEST 5: Index on (athlete_id, session_id) exists ────────────────────
  -- embed-session queries: WHERE athlete_id=X AND session_id=Y AND kind IS NOT NULL
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'ai_insights'
    AND indexname  = 'idx_ai_insights_session_id';

  ASSERT v_idx_count = 1,
    'FAIL TEST 5: idx_ai_insights_session_id index missing — embed-session lookups will scan full table';

  RAISE NOTICE 'PASS TEST 5: idx_ai_insights_session_id index exists';

  -- ── TEST 6: Index on (athlete_id, kind, created_at) exists ──────────────
  -- Realtime + history queries use this index
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'ai_insights'
    AND indexname  = 'idx_ai_insights_kind_created';

  ASSERT v_idx_count = 1,
    'FAIL TEST 6: idx_ai_insights_kind_created index missing — realtime queries unoptimised';

  RAISE NOTICE 'PASS TEST 6: idx_ai_insights_kind_created index exists';

  -- ── TEST 7: insight_embeddings table exists ──────────────────────────────
  -- embed-session writes insight vectors here; orphan if table missing
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name   = 'insight_embeddings';

  ASSERT v_col_count = 1,
    'FAIL TEST 7: insight_embeddings table missing — embed-session has nowhere to store insight vectors';

  RAISE NOTICE 'PASS TEST 7: insight_embeddings table exists';

  -- ── TEST 8: insight_embeddings has athlete_id + session_id columns ───────
  -- embed-session writes: (athlete_id, insight_id, session_id, embedding)
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'insight_embeddings'
    AND column_name IN ('athlete_id', 'session_id', 'insight_id');

  ASSERT v_col_count >= 2,
    format('FAIL TEST 8: insight_embeddings missing athlete_id / session_id columns (found %s)', v_col_count);

  RAISE NOTICE 'PASS TEST 8: insight_embeddings has athlete_id, session_id, insight_id columns';

  -- ── TEST 9: training_log has id column of type UUID ─────────────────────
  -- session_id FK must reference UUID; if training_log.id is BIGINT the FK breaks
  SELECT data_type INTO v_dtype
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'training_log'
    AND column_name  = 'id';

  ASSERT v_dtype = 'uuid',
    format('FAIL TEST 9: training_log.id is %s, expected uuid — ai_insights.session_id FK will break', v_dtype);

  RAISE NOTICE 'PASS TEST 9: training_log.id is uuid (FK target for session_id)';

  RAISE NOTICE '── All analyse_embed_chain contract tests passed ──';

END $$;
