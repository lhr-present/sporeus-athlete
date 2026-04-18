-- ─── 20260432_fts_coach_session_search.sql — Extend search_everything for coaches ──
-- Bug fix: the original 'session' arm used tl.user_id = auth.uid(), so coaches
-- could not find session notes for the athletes they coach.  Add a 6th UNION ALL
-- arm that returns athlete sessions reachable via coach_athletes.
--
-- The new arm returns kind='athlete_session' so the client can distinguish it from
-- the coach's own sessions.  SearchPalette already maps unknown kinds to the 'log'
-- tab, so no client change is required — but the kind string lets the UI add
-- per-kind colouring if desired in future.

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

  -- Athlete sessions (visible to coach via coach_athletes)
  (
    SELECT
      'athlete_session'::text                                        AS kind,
      tl.id::text                                                    AS record_id,
      ts_rank_cd(tl.notes_tsv, nq.tsq)                             AS rank,
      left(coalesce(tl.notes, ''), 150)                             AS snippet,
      tl.date::text                                                  AS date_hint
    FROM public.training_log tl
    JOIN public.coach_athletes ca
      ON ca.athlete_id = tl.user_id
     AND ca.coach_id   = auth.uid()
     AND ca.status     = 'active'
    CROSS JOIN nq
    WHERE tl.notes_tsv @@ nq.tsq
    ORDER BY ts_rank_cd(tl.notes_tsv, nq.tsq) DESC
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

-- Grants unchanged — already granted to authenticated in 20260428_fts.sql.
-- Re-grant here so this migration is self-contained.
GRANT EXECUTE ON FUNCTION public.search_everything(text, int) TO authenticated;
