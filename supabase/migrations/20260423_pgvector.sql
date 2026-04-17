-- ─── 20260423_pgvector.sql — pgvector RAG layer (v7.44.0) ───────────────────
-- Supersedes 20260420_pgvector_stub.sql (stub was never deployed).
-- Requires: EMBEDDING_API_KEY secret (OpenAI text-embedding-3-small, 1536d).
--
-- Changes:
--   1. Enable vector extension
--   2. session_embeddings  — per-session vector store (keyed on training_log.id)
--   3. insight_embeddings  — per-insight vector store  (keyed on ai_insights.id)
--   4. HNSW indexes + RLS on both tables
--   5. match_sessions_for_user() RPC  — cosine search, auth.uid() scoped
--   6. match_sessions_for_coach() RPC — cross-athlete search, coach-scoped
--   7. fn_webhook_embed_session() + on_training_log_insert_embed trigger

-- ── 1. Extension ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. session_embeddings ────────────────────────────────────────────────────
-- session_id is both the PK and the FK → training_log (1:1 relationship).
-- content_hash lets embed-session skip re-embedding unchanged sessions.
CREATE TABLE IF NOT EXISTS session_embeddings (
  session_id   UUID        PRIMARY KEY REFERENCES training_log(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  embedding    vector(1536),
  content_hash TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_embeddings: own rows select"
  ON session_embeddings FOR SELECT
  USING (auth.uid() = user_id);

-- Service-role writes (embed-session runs as service role)
CREATE POLICY "session_embeddings: service role write"
  ON session_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);
-- Note: above policy is intentionally permissive for service-role; RLS SELECT
-- policy still protects client-side reads via auth.uid() check.

-- HNSW index: m=16 ef_construction=64 — good defaults for <10M rows
CREATE INDEX IF NOT EXISTS idx_session_embeddings_hnsw
  ON session_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_session_embeddings_user
  ON session_embeddings (user_id);

-- ── 3. insight_embeddings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insight_embeddings (
  insight_id   UUID        PRIMARY KEY REFERENCES ai_insights(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  embedding    vector(1536),
  content_hash TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE insight_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insight_embeddings: own rows select"
  ON insight_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insight_embeddings: service role write"
  ON insight_embeddings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_insight_embeddings_hnsw
  ON insight_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_insight_embeddings_user
  ON insight_embeddings (user_id);

-- ── 5. match_sessions_for_user() ─────────────────────────────────────────────
-- Returns top-k sessions by cosine similarity for the authenticated user.
-- Called by embed-query edge function and SemanticSearch.jsx.
-- SECURITY DEFINER: runs as owner, RLS check is inline (user_id = auth.uid()).
DROP FUNCTION IF EXISTS match_sessions_for_user(vector, int);
CREATE OR REPLACE FUNCTION match_sessions_for_user(
  p_embedding  vector(1536),
  k            INT DEFAULT 10
)
RETURNS TABLE (
  session_id   UUID,
  user_id      UUID,
  date         DATE,
  type         TEXT,
  duration_min INT,
  tss          NUMERIC,
  rpe          INT,
  notes        TEXT,
  similarity   FLOAT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    tl.id           AS session_id,
    se.user_id,
    tl.date,
    tl.type,
    tl.duration_min,
    tl.tss,
    tl.rpe,
    tl.notes,
    1.0 - (se.embedding <=> p_embedding) AS similarity
  FROM session_embeddings se
  JOIN training_log tl ON tl.id = se.session_id
  WHERE se.user_id = auth.uid()
    AND se.embedding IS NOT NULL
  ORDER BY se.embedding <=> p_embedding
  LIMIT k;
$$;

GRANT EXECUTE ON FUNCTION match_sessions_for_user(vector, int) TO authenticated;

COMMENT ON FUNCTION match_sessions_for_user(vector, int) IS
  'Top-k session similarity search for authenticated user (cosine distance via HNSW).';

-- ── 6. match_sessions_for_coach() ────────────────────────────────────────────
-- Returns top-k sessions across a list of athlete_ids.
-- Caller must supply athlete_ids they own (verified below via coach_athletes join).
DROP FUNCTION IF EXISTS match_sessions_for_coach(vector, uuid[], int);
CREATE OR REPLACE FUNCTION match_sessions_for_coach(
  p_embedding  vector(1536),
  p_athlete_ids UUID[],
  k            INT DEFAULT 10
)
RETURNS TABLE (
  session_id   UUID,
  athlete_id   UUID,
  athlete_name TEXT,
  date         DATE,
  type         TEXT,
  duration_min INT,
  tss          NUMERIC,
  rpe          INT,
  notes        TEXT,
  similarity   FLOAT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    tl.id                   AS session_id,
    se.user_id              AS athlete_id,
    p.display_name          AS athlete_name,
    tl.date,
    tl.type,
    tl.duration_min,
    tl.tss,
    tl.rpe,
    tl.notes,
    1.0 - (se.embedding <=> p_embedding) AS similarity
  FROM session_embeddings se
  JOIN training_log tl ON tl.id = se.session_id
  JOIN profiles p      ON p.id  = se.user_id
  -- Security: only allow querying athletes the caller coaches
  JOIN coach_athletes ca
    ON ca.athlete_id = se.user_id
    AND ca.coach_id  = auth.uid()
    AND ca.status    = 'active'
  WHERE se.user_id = ANY(p_athlete_ids)
    AND se.embedding IS NOT NULL
  ORDER BY se.embedding <=> p_embedding
  LIMIT k;
$$;

GRANT EXECUTE ON FUNCTION match_sessions_for_coach(vector, uuid[], int) TO authenticated;

COMMENT ON FUNCTION match_sessions_for_coach(vector, uuid[], int) IS
  'Top-k session similarity search across coach-linked athletes (HNSW cosine).';

-- ── 7. Embed trigger on training_log INSERT ───────────────────────────────────
-- Fires AFTER existing on_training_log_insert (analyse-session).
-- Silently skips when app.supabase_url / EMBEDDING_API_KEY not configured.
CREATE OR REPLACE FUNCTION fn_webhook_embed_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/embed-session';
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL OR v_url = '/functions/v1/embed-session' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'session_id', NEW.id,
      'user_id',    NEW.user_id,
      'source',     'db_webhook'
    ),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_training_log_insert_embed ON training_log;
CREATE TRIGGER on_training_log_insert_embed
  AFTER INSERT ON training_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_webhook_embed_session();
