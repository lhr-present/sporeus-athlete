-- ─── 20260428_fts.sql — Full-text search: tsvector columns + search_everything ──
-- Adds generated tsvector columns (normalized for Turkish diacritics), GIN indexes,
-- and the search_everything(q, limit_per_kind) RPC that unions all content tables.
--
-- Normalization: translate('ışçğüöİŞÇĞÜÖ' → 'iscguoiscguo') + lower()
-- so 'koşu' and 'kosu' match each other bidirectionally.

-- ── normalize_for_fts() — IMMUTABLE (required for generated columns) ───────────
CREATE OR REPLACE FUNCTION public.normalize_for_fts(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT lower(translate(t, 'ışçğüöİŞÇĞÜÖ', 'iscguoiscguo'))
$$;

COMMENT ON FUNCTION public.normalize_for_fts(text) IS
  'Fold Turkish diacritics (ş→s, ç→c, ğ→g, ü→u, ö→o, ı/İ→i) then lowercase. Used in tsvector generated columns.';

-- ── Generated tsvector columns ────────────────────────────────────────────────

ALTER TABLE public.training_log
  ADD COLUMN IF NOT EXISTS notes_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', public.normalize_for_fts(coalesce(notes, '')))
    ) STORED;

ALTER TABLE public.coach_notes
  ADD COLUMN IF NOT EXISTS note_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', public.normalize_for_fts(coalesce(note, '')))
    ) STORED;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS body_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', public.normalize_for_fts(coalesce(body, '')))
    ) STORED;

ALTER TABLE public.team_announcements
  ADD COLUMN IF NOT EXISTS message_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', public.normalize_for_fts(coalesce(message, '')))
    ) STORED;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', public.normalize_for_fts(coalesce(display_name, '')))
    ) STORED;

-- ── GIN indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_training_log_notes_fts
  ON public.training_log USING GIN (notes_tsv);

CREATE INDEX IF NOT EXISTS idx_coach_notes_note_fts
  ON public.coach_notes USING GIN (note_tsv);

CREATE INDEX IF NOT EXISTS idx_messages_body_fts
  ON public.messages USING GIN (body_tsv);

CREATE INDEX IF NOT EXISTS idx_team_announcements_message_fts
  ON public.team_announcements USING GIN (message_tsv);

CREATE INDEX IF NOT EXISTS idx_profiles_name_fts
  ON public.profiles USING GIN (name_tsv);

-- ── search_everything(q, limit_per_kind) ──────────────────────────────────────
-- Union search across 5 content tables, filtered by the calling user's access.
-- SECURITY INVOKER so RLS applies; auth.uid() read from request.jwt.claims.
-- Client normalizes q before calling; we also normalize server-side for direct callers.

CREATE OR REPLACE FUNCTION public.search_everything(
  q               text,
  limit_per_kind  int DEFAULT 10
)
RETURNS TABLE (
  kind       text,
  record_id  text,
  rank       real,
  snippet    text,
  date_hint  text
)
LANGUAGE sql
SECURITY INVOKER
STABLE PARALLEL SAFE
AS $$
  WITH nq AS (
    SELECT plainto_tsquery('simple', public.normalize_for_fts(q)) AS tsq
  )

  -- Sessions (own)
  (
    SELECT
      'session'::text                                                AS kind,
      tl.id::text                                                    AS record_id,
      ts_rank_cd(tl.notes_tsv, nq.tsq)                             AS rank,
      left(coalesce(tl.notes, ''), 150)                             AS snippet,
      tl.date::text                                                  AS date_hint
    FROM public.training_log tl, nq
    WHERE tl.notes_tsv @@ nq.tsq
      AND tl.user_id = auth.uid()
    ORDER BY rank DESC
    LIMIT limit_per_kind
  )

  UNION ALL

  -- Coach notes (coach who wrote them, or athlete they're about)
  (
    SELECT
      'note'::text,
      cn.id::text,
      ts_rank_cd(cn.note_tsv, nq.tsq),
      left(cn.note, 150),
      cn.created_at::date::text
    FROM public.coach_notes cn, nq
    WHERE cn.note_tsv @@ nq.tsq
      AND (cn.coach_id = auth.uid() OR cn.athlete_id = auth.uid())
    ORDER BY ts_rank_cd(cn.note_tsv, nq.tsq) DESC
    LIMIT limit_per_kind
  )

  UNION ALL

  -- Messages (coach or athlete in the thread)
  (
    SELECT
      'message'::text,
      m.id::text,
      ts_rank_cd(m.body_tsv, nq.tsq),
      left(m.body, 150),
      m.sent_at::date::text
    FROM public.messages m, nq
    WHERE m.body_tsv @@ nq.tsq
      AND (m.coach_id = auth.uid() OR m.athlete_id = auth.uid())
    ORDER BY ts_rank_cd(m.body_tsv, nq.tsq) DESC
    LIMIT limit_per_kind
  )

  UNION ALL

  -- Team announcements (coach who posted, or athlete on their squad)
  (
    SELECT
      'announcement'::text,
      ta.id::text,
      ts_rank_cd(ta.message_tsv, nq.tsq),
      left(ta.message, 150),
      ta.created_at::date::text
    FROM public.team_announcements ta, nq
    WHERE ta.message_tsv @@ nq.tsq
      AND (
        ta.coach_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coach_athletes ca
          WHERE ca.coach_id = ta.coach_id
            AND ca.athlete_id = auth.uid()
            AND ca.status = 'active'
        )
      )
    ORDER BY ts_rank_cd(ta.message_tsv, nq.tsq) DESC
    LIMIT limit_per_kind
  )

  UNION ALL

  -- Athletes (coaches search their squad by name)
  (
    SELECT
      'athlete'::text,
      p.id::text,
      ts_rank_cd(p.name_tsv, nq.tsq),
      coalesce(p.display_name, ''),
      NULL::text
    FROM public.profiles p
    JOIN public.coach_athletes ca ON ca.athlete_id = p.id AND ca.status = 'active'
    CROSS JOIN nq
    WHERE p.name_tsv @@ nq.tsq
      AND ca.coach_id = auth.uid()
    ORDER BY ts_rank_cd(p.name_tsv, nq.tsq) DESC
    LIMIT limit_per_kind
  )
$$;

GRANT EXECUTE ON FUNCTION public.search_everything(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_for_fts(text) TO authenticated, service_role;
