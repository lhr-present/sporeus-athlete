-- ─── 20260419_fts.sql — Full-text search across sessions, notes, messages, announcements ──
-- Uses 'simple' FTS config (no stemming) + client-side Turkish diacritic folding.
-- GIN indexes keep search sub-100ms on expected data volumes.

-- ── tsvector generated columns ─────────────────────────────────────────────────

ALTER TABLE training_log
  ADD COLUMN IF NOT EXISTS notes_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(notes, ''))) STORED;

ALTER TABLE coach_notes
  ADD COLUMN IF NOT EXISTS body_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(note, ''))) STORED;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body, ''))) STORED;

ALTER TABLE team_announcements
  ADD COLUMN IF NOT EXISTS body_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(message, ''))) STORED;

-- ── GIN indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tl_notes_tsv        ON training_log       USING GIN (notes_tsv);
CREATE INDEX IF NOT EXISTS idx_cn_body_tsv         ON coach_notes        USING GIN (body_tsv);
CREATE INDEX IF NOT EXISTS idx_msg_content_tsv     ON messages           USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS idx_ann_body_tsv        ON team_announcements USING GIN (body_tsv);

-- ── search_everything(q, limit_per_kind) RPC ───────────────────────────────────
-- Returns ranked results across 4 kinds: session | note | message | announcement
-- record_id is text (team_announcements.id is bigint, others are uuid)
-- RLS is applied inline per subquery — SECURITY DEFINER so we can join coach_athletes

CREATE OR REPLACE FUNCTION search_everything(
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
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION search_everything(text, int) TO authenticated;
