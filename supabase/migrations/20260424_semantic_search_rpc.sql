-- ─── 20260424_semantic_search_rpc.sql — Named semantic search RPCs (v7.45.0) ──
-- Adds spec-compliant RPC names on top of the v7.44.0 pgvector foundations.
-- Callers embed query text via the embed-query edge function first, then pass
-- the resulting vector to these RPCs.  (Synchronous in-SQL HTTP embedding is
-- not available without pg_http; embed-query edge fn handles text → vector.)
--
-- New RPCs:
--   search_sessions_semantic(p_embedding, k) — user-scoped alias for clarity
--   search_squad_pattern(p_embedding, p_athlete_ids, k) — coach pattern search

-- ── search_sessions_semantic ─────────────────────────────────────────────────
-- Named per-spec; delegates to match_sessions_for_user which owns the HNSW query.
DROP FUNCTION IF EXISTS search_sessions_semantic(vector, int);
CREATE OR REPLACE FUNCTION search_sessions_semantic(
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
  SELECT * FROM match_sessions_for_user(p_embedding, k);
$$;

GRANT EXECUTE ON FUNCTION search_sessions_semantic(vector, int) TO authenticated;

COMMENT ON FUNCTION search_sessions_semantic(vector, int) IS
  'Semantic session search for authenticated user — spec-compliant alias for match_sessions_for_user. '
  'Text-to-embedding: call embed-query edge fn first, pass the returned vector here.';

-- ── search_squad_pattern ─────────────────────────────────────────────────────
-- Coach-tier: find cross-athlete sessions matching a pattern embedding.
-- Caller verifies athlete_ids belong to their squad before calling.
DROP FUNCTION IF EXISTS search_squad_pattern(vector, uuid[], int);
CREATE OR REPLACE FUNCTION search_squad_pattern(
  p_embedding   vector(1536),
  p_athlete_ids UUID[],
  k             INT DEFAULT 10
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
  SELECT * FROM match_sessions_for_coach(p_embedding, p_athlete_ids, k);
$$;

GRANT EXECUTE ON FUNCTION search_squad_pattern(vector, uuid[], int) TO authenticated;

COMMENT ON FUNCTION search_squad_pattern(vector, uuid[], int) IS
  'Squad pattern search for coach — finds sessions across linked athletes matching an embedding. '
  'Requires coach tier; enforced via coach_athletes join in match_sessions_for_coach. '
  'Text-to-embedding: call embed-query edge fn with squad:true to run the full pipeline.';
