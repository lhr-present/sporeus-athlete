-- 20260484_search_functions_invoker.sql
-- v9.327.0 — Convert search_everything + match_sessions_for_user to
--            SECURITY INVOKER (pen test C3/C4 hardening) (part 2/2).
--
-- ⚠️  HOLD-BEFORE-APPLY: This migration is functionally equivalent to
--    the existing DEFINER+explicit-filter pattern (verified 2026-05-25:
--    RLS policies on training_log, coach_notes, messages,
--    team_announcements, session_embeddings mirror the WHERE clauses
--    inside each function). Conversion to INVOKER is defense-in-depth,
--    not a fix for a real leak.
--
--    Before applying, run search smoke tests as a real authenticated
--    user (NOT service_role) on prod:
--      1. GlobalSearch (Ctrl+Shift+F): query for a known term from your
--         training log notes → results appear
--      2. SemanticSearch (Ctrl+Shift+K): query → vector matches appear
--      3. Coach side: search across own coach_notes / messages /
--         team_announcements works
--    Silent-empty-result is the failure mode. If any of the above
--    returns empty on prod where it used to return results, REVERT by
--    re-applying 20260419_fts.sql + 20260424_semantic_search_rpc.sql.
--
-- This migration KEEPS the explicit auth.uid() filters inside each
-- function body. With INVOKER + explicit filter + RLS as third layer,
-- it's "belt and suspenders and parachute".

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. search_everything — INVOKER, body unchanged (filters preserved)
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_everything(
  q             text,
  limit_per_kind int DEFAULT 10
)
RETURNS TABLE (
  kind      text,
  record_id text,
  rank      real,
  snippet   text,
  date_hint text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $func$
BEGIN
  -- Training log sessions (own sessions only)
  RETURN QUERY
    SELECT 'session'::text, id::text,
      ts_rank_cd(notes_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(notes,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      date::text
    FROM training_log
    WHERE notes_tsv @@ plainto_tsquery('simple', q) AND user_id = auth.uid()
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Coach notes (accessible by coach or athlete)
  RETURN QUERY
    SELECT 'note'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(note,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM coach_notes
    WHERE body_tsv @@ plainto_tsquery('simple', q) AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Messages (accessible by either party)
  RETURN QUERY
    SELECT 'message'::text, id::text,
      ts_rank_cd(content_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(body,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      sent_at::date::text
    FROM messages
    WHERE content_tsv @@ plainto_tsquery('simple', q) AND (coach_id = auth.uid() OR athlete_id = auth.uid())
    ORDER BY 3 DESC LIMIT limit_per_kind;

  -- Team announcements (coach sees own; athlete sees linked coach's)
  RETURN QUERY
    SELECT 'announcement'::text, id::text,
      ts_rank_cd(body_tsv, plainto_tsquery('simple', q))::real,
      ts_headline('simple', coalesce(message,''), plainto_tsquery('simple', q), 'MaxWords=12,MinWords=4'),
      created_at::date::text
    FROM team_announcements
    WHERE body_tsv @@ plainto_tsquery('simple', q)
      AND (coach_id = auth.uid() OR EXISTS (
        SELECT 1 FROM coach_athletes ca
        WHERE ca.athlete_id = auth.uid() AND ca.coach_id = team_announcements.coach_id AND ca.status = 'active'
      ))
    ORDER BY 3 DESC LIMIT limit_per_kind;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.search_everything(text, int) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. match_sessions_for_user — INVOKER, body unchanged
-- ─────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.match_sessions_for_user(vector, int);
CREATE OR REPLACE FUNCTION public.match_sessions_for_user(
  p_embedding  vector(1536),
  k            INT DEFAULT 10
)
RETURNS TABLE (
  session_id   UUID,
  date         DATE,
  type         TEXT,
  duration_min INT,
  tss          NUMERIC,
  rpe          INT,
  notes        TEXT,
  similarity   FLOAT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
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

GRANT EXECUTE ON FUNCTION public.match_sessions_for_user(vector, int) TO authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Verification (run after applying)
-- ─────────────────────────────────────────────────────────────────────
--
-- SELECT proname, prosecdef
--   FROM pg_proc
--   WHERE proname IN ('search_everything','match_sessions_for_user');
--   -- Expected: both prosecdef = false (INVOKER)
--
-- Then run the smoke tests above as a real authenticated user.
