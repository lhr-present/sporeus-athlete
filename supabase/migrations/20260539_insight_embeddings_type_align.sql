-- 20260539_insight_embeddings_type_align.sql — M6 (MEDIUM)
--
-- insight_embeddings.insight_id was defined as UUID in 20260423_pgvector.sql
-- (runs first → wins under CREATE TABLE IF NOT EXISTS) but as BIGINT in the
-- later 20260426_ai_embeddings.sql. ai_insights.id is BIGSERIAL (bigint), and
-- the live code (embed-session/index.ts) upserts insight_id := insight.id
-- (a bigint) with onConflict:'insight_id'; the backfill fn compares
-- ie.insight_id = ai.id (bigint). So the CORRECT type is bigint.
--
-- Note: a UUID column REFERENCES ai_insights(id) bigint is not even a valid FK,
-- so the 20260423 CREATE likely errored or left the table FK-less. We reconcile
-- safely:
--   • If insight_id is already bigint → nothing to do (ensure FK present).
--   • If insight_id is UUID and the table is EMPTY → drop & recreate as bigint
--     (no data loss; UUID values were never real ai_insights ids anyway).
--   • If insight_id is UUID and the table is NON-EMPTY → do NOT touch data;
--     raise a NOTICE so an operator converts manually. (We will not silently
--     destroy embeddings.)
-- Idempotent + safe on an out-of-sync schema_migrations.

DO $$
DECLARE
  v_type   text;
  v_rows   bigint;
BEGIN
  IF to_regclass('public.insight_embeddings') IS NULL THEN
    RAISE NOTICE 'insight_embeddings absent — skipping';
    RETURN;
  END IF;

  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'insight_embeddings'
    AND column_name = 'insight_id';

  IF v_type = 'bigint' THEN
    RAISE NOTICE 'insight_embeddings.insight_id already bigint — OK';
    RETURN;
  END IF;

  IF v_type = 'uuid' THEN
    EXECUTE 'SELECT count(*) FROM public.insight_embeddings' INTO v_rows;

    IF v_rows = 0 THEN
      -- Safe to rebuild empty table with the correct (bigint) type.
      RAISE NOTICE 'insight_embeddings empty + uuid insight_id — rebuilding as bigint';

      DROP TABLE public.insight_embeddings;

      CREATE TABLE public.insight_embeddings (
        insight_id   bigint       NOT NULL PRIMARY KEY REFERENCES public.ai_insights(id) ON DELETE CASCADE,
        user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        embedding    vector(1536),
        content_hash text         NOT NULL DEFAULT '',
        created_at   timestamptz  NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_insight_embeddings_user
        ON public.insight_embeddings (user_id);

      -- ivfflat is the index type used by 20260426; hnsw by 20260423. Use ivfflat
      -- (no special build params required) — either is acceptable for cosine.
      CREATE INDEX IF NOT EXISTS idx_insight_embeddings_vector
        ON public.insight_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

      ALTER TABLE public.insight_embeddings ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "insight_embeddings: own rows select"
        ON public.insight_embeddings FOR SELECT
        USING ((SELECT auth.uid()) = user_id);

      CREATE POLICY "insight_embeddings: service role write"
        ON public.insight_embeddings FOR ALL
        USING (true) WITH CHECK (true);
    ELSE
      RAISE WARNING
        'insight_embeddings.insight_id is UUID with % row(s); MANUAL conversion required (cannot cast UUID->bigint without data mapping). Left unchanged.',
        v_rows;
    END IF;
  ELSE
    RAISE NOTICE 'insight_embeddings.insight_id is unexpected type %, leaving unchanged', v_type;
  END IF;
END $$;
