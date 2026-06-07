-- ── pgvector + embedding tables + RPC functions ──────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- session_embeddings: one embedding per training session
CREATE TABLE IF NOT EXISTS public.session_embeddings (
  session_id   uuid         NOT NULL PRIMARY KEY REFERENCES public.training_log(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding    vector(1536) NOT NULL,
  content_hash text         NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- insight_embeddings: one embedding per ai_insights row
CREATE TABLE IF NOT EXISTS public.insight_embeddings (
  insight_id   bigint       NOT NULL PRIMARY KEY REFERENCES public.ai_insights(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding    vector(1536) NOT NULL,
  content_hash text         NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Vector similarity indexes (ivfflat, cosine)
CREATE INDEX IF NOT EXISTS idx_session_embeddings_vector
  ON public.session_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_insight_embeddings_vector
  ON public.insight_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_session_embeddings_user_id
  ON public.session_embeddings (user_id);

CREATE INDEX IF NOT EXISTS idx_insight_embeddings_user_id
  ON public.insight_embeddings (user_id);

-- RLS
ALTER TABLE public.session_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_embeddings_own_row" ON public.session_embeddings
  FOR ALL USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "insight_embeddings_own_row" ON public.insight_embeddings
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- ── match_sessions_for_user ───────────────────────────────────────────────────
-- OPERATOR(public.<=>) qualifies the pgvector cosine operator explicitly
-- because SET search_path = '' prevents implicit resolution from public.
CREATE OR REPLACE FUNCTION public.match_sessions_for_user(
  p_embedding vector(1536),
  k           int DEFAULT 10
)
RETURNS TABLE (
  session_id   uuid,
  date         date,
  type         text,
  duration_min integer,
  tss          numeric,
  rpe          integer,
  notes        text,
  similarity   float8
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tl.id::uuid               AS session_id,
    tl.date::date,
    tl.type::text,
    tl.duration_min::integer,
    tl.tss::numeric,
    tl.rpe::integer,
    tl.notes::text,
    (1 - (se.embedding OPERATOR(public.<=>) p_embedding))::float8 AS similarity
  FROM public.session_embeddings se
  JOIN public.training_log tl ON tl.id = se.session_id
  WHERE se.user_id = (SELECT auth.uid())
  ORDER BY se.embedding OPERATOR(public.<=>) p_embedding
  LIMIT k;
$$;

-- ── match_sessions_for_coach ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_sessions_for_coach(
  p_embedding   vector(1536),
  p_athlete_ids uuid[],
  k             int DEFAULT 10
)
RETURNS TABLE (
  session_id    uuid,
  athlete_id    uuid,
  athlete_name  text,
  date          date,
  type          text,
  duration_min  integer,
  tss           numeric,
  rpe           integer,
  notes         text,
  similarity    float8
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    tl.id::uuid                                                     AS session_id,
    se.user_id::uuid                                                AS athlete_id,
    p.display_name::text                                            AS athlete_name,
    tl.date::date,
    tl.type::text,
    tl.duration_min::integer,
    tl.tss::numeric,
    tl.rpe::integer,
    tl.notes::text,
    (1 - (se.embedding OPERATOR(public.<=>) p_embedding))::float8  AS similarity
  FROM public.session_embeddings se
  JOIN public.training_log tl ON tl.id  = se.session_id
  JOIN public.profiles p      ON p.id   = se.user_id
  WHERE se.user_id = ANY(p_athlete_ids)
    AND EXISTS (
      SELECT 1 FROM public.coach_athletes ca
      WHERE ca.coach_id   = (SELECT auth.uid())
        AND ca.athlete_id = se.user_id
        AND ca.status     = 'active'
    )
  ORDER BY se.embedding OPERATOR(public.<=>) p_embedding
  LIMIT k;
$$;
