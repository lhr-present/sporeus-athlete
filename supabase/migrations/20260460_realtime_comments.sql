-- ─── 20260460_realtime_comments.sql — E11: Session comments + coach presence ───
-- session_comments: threaded comments on training_log entries (coach ↔ athlete)
-- session_views:    tracks last-viewed timestamp for CoachPresenceBadge
--
-- Design invariants:
--   • Soft-delete only (deleted_at IS NOT NULL) — coaches/athletes own their words
--   • body max 2000 chars enforced at DB level
--   • REPLICA IDENTITY FULL on both tables — UPDATE/DELETE events carry old row data
--   • RLS: only session participants (author, session owner, linked coach) see/write

-- ─── session_comments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.training_log(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  parent_id   uuid        REFERENCES public.session_comments(id)      ON DELETE SET NULL,
  body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Required for UPDATE / DELETE postgres_changes events to include row data
ALTER TABLE public.session_comments REPLICA IDENTITY FULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sc_session
  ON public.session_comments (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_author
  ON public.session_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_sc_parent
  ON public.session_comments (parent_id) WHERE parent_id IS NOT NULL;

-- ─── session_views ────────────────────────────────────────────────────────────
-- One row per (user, session). Upserted each time a user opens a session detail.
-- Drives CoachPresenceBadge ("Coach viewed 3 min ago").

CREATE TABLE IF NOT EXISTS public.session_views (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id  uuid        NOT NULL REFERENCES public.training_log(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);

-- Required for UPDATE events to carry old row data via postgres_changes
ALTER TABLE public.session_views REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS idx_sv_session
  ON public.session_views (session_id, viewed_at DESC);

-- ─── Realtime publication ─────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_comments;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_views;
  END IF;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_views    ENABLE ROW LEVEL SECURITY;

-- Helper: is auth.uid() an active coach of the user who owns a training_log row?
-- Inlined in policies to avoid function overhead on hot paths.

-- session_comments — SELECT
-- Visible to: comment author, session owner, coach with active link to session owner
CREATE POLICY "sc: participants can read"
  ON public.session_comments FOR SELECT
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_log tl
      WHERE tl.id = session_comments.session_id
        AND (
          tl.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.coach_athletes ca
            WHERE ca.coach_id = auth.uid()
              AND ca.athlete_id = tl.user_id
              AND ca.status = 'active'
          )
        )
    )
  );

-- session_comments — INSERT
-- author_id must equal auth.uid(); session must be accessible to inserting user
CREATE POLICY "sc: participants can insert"
  ON public.session_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.training_log tl
      WHERE tl.id = session_id
        AND (
          tl.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.coach_athletes ca
            WHERE ca.coach_id = auth.uid()
              AND ca.athlete_id = tl.user_id
              AND ca.status = 'active'
          )
        )
    )
  );

-- session_comments — UPDATE
-- Only the original author may edit; soft-delete is an update setting deleted_at
CREATE POLICY "sc: author can update"
  ON public.session_comments FOR UPDATE
  USING  (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- No hard DELETE policy — enforce soft delete only via deleted_at column

-- session_views — SELECT
-- Own rows or coach viewing their athlete's session views (presence awareness)
CREATE POLICY "sv: read own or linked"
  ON public.session_views FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_log tl
      JOIN public.coach_athletes ca ON ca.athlete_id = tl.user_id
      WHERE tl.id = session_views.session_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.training_log tl
      JOIN public.coach_athletes ca ON ca.coach_id = tl.user_id
      WHERE tl.id = session_views.session_id
        AND ca.athlete_id = auth.uid()
        AND ca.status = 'active'
    )
  );

-- session_views — INSERT: own rows only
CREATE POLICY "sv: insert own"
  ON public.session_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- session_views — UPDATE: own rows only
CREATE POLICY "sv: update own"
  ON public.session_views FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
