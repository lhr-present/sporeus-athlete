-- 20260480_coach_messages.sql
-- v9.133.0 — Realtime coach<->athlete messaging foundation.
--
-- Pre-v9.133 messaging was file-based JSON export/import (see
-- CLAUDE.md "Known Limitations"). Coaches sent a JSON file, athletes
-- imported it manually. Anachronistic and lossy — messages routinely
-- got out of order or dropped because no one remembered to import.
--
-- This migration creates the storage + RLS + realtime publication for
-- DB-backed messages. The hook + UI swap come in follow-on prompts;
-- shipping the foundation alone lets the schema settle without UI
-- pressure to ship same-day.
--
-- Schema notes:
--   sender — enum-style TEXT with CHECK constraint. Two values
--     because either side of the (coach, athlete) pair can send.
--   read_at — nullable; null = unread. Only the OTHER side can mark
--     read (athlete marks coach-sent messages; coach marks athlete-
--     sent messages).
--   length(body) ≤ 4000 — generous but bounded so a runaway client
--     can't fill storage with one POST.

CREATE TABLE IF NOT EXISTS coach_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

-- Constraints applied separately so re-runs against an existing table
-- (e.g. via apply_migration) don't drop the table.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_messages_sender_chk'
  ) THEN
    ALTER TABLE coach_messages
      ADD CONSTRAINT coach_messages_sender_chk
      CHECK (sender IN ('coach', 'athlete'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_messages_body_len_chk'
  ) THEN
    ALTER TABLE coach_messages
      ADD CONSTRAINT coach_messages_body_len_chk
      CHECK (length(body) > 0 AND length(body) <= 4000);
  END IF;
END $$;

-- Thread-scan index: paginate a single coach<->athlete thread in
-- reverse-chronological order. Most read paths target this exact tuple.
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread
  ON coach_messages (coach_id, athlete_id, created_at DESC);

-- Coach-side "unread inbox" index — counts of unread athlete messages
-- per coach. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_coach_messages_coach_unread
  ON coach_messages (coach_id, athlete_id)
  WHERE sender = 'athlete' AND read_at IS NULL;

-- Athlete-side "unread inbox" — partial index for unread coach messages.
CREATE INDEX IF NOT EXISTS idx_coach_messages_athlete_unread
  ON coach_messages (athlete_id, coach_id)
  WHERE sender = 'coach' AND read_at IS NULL;

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

-- ── SELECT policies ───────────────────────────────────────────────────
-- Either side of the (coach_id, athlete_id) pair can read, but only if
-- they're the auth.uid() AND the coach<->athlete link exists in
-- coach_athletes (so revoked links retroactively hide the history).

DROP POLICY IF EXISTS coach_messages_select_coach   ON coach_messages;
DROP POLICY IF EXISTS coach_messages_select_athlete ON coach_messages;

CREATE POLICY coach_messages_select_coach
  ON coach_messages FOR SELECT
  USING (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id   = coach_messages.coach_id
        AND coach_athletes.athlete_id = coach_messages.athlete_id
    )
  );

CREATE POLICY coach_messages_select_athlete
  ON coach_messages FOR SELECT
  USING (
    auth.uid() = athlete_id
    AND EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id   = coach_messages.coach_id
        AND coach_athletes.athlete_id = coach_messages.athlete_id
    )
  );

-- ── INSERT policies ───────────────────────────────────────────────────
-- Sender must match auth.uid() AND the link must exist.

DROP POLICY IF EXISTS coach_messages_insert_coach   ON coach_messages;
DROP POLICY IF EXISTS coach_messages_insert_athlete ON coach_messages;

CREATE POLICY coach_messages_insert_coach
  ON coach_messages FOR INSERT
  WITH CHECK (
    auth.uid() = coach_id
    AND sender = 'coach'
    AND EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id   = coach_messages.coach_id
        AND coach_athletes.athlete_id = coach_messages.athlete_id
    )
  );

CREATE POLICY coach_messages_insert_athlete
  ON coach_messages FOR INSERT
  WITH CHECK (
    auth.uid() = athlete_id
    AND sender = 'athlete'
    AND EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id   = coach_messages.coach_id
        AND coach_athletes.athlete_id = coach_messages.athlete_id
    )
  );

-- ── UPDATE (mark-read) policies ───────────────────────────────────────
-- Only the recipient can mark a message read. Coach marks athlete-sent
-- messages; athlete marks coach-sent messages. The WITH CHECK constraint
-- prevents anyone from clobbering body/sender/created_at on update.

DROP POLICY IF EXISTS coach_messages_update_coach   ON coach_messages;
DROP POLICY IF EXISTS coach_messages_update_athlete ON coach_messages;

CREATE POLICY coach_messages_update_coach
  ON coach_messages FOR UPDATE
  USING  (auth.uid() = coach_id   AND sender = 'athlete')
  WITH CHECK (auth.uid() = coach_id AND sender = 'athlete');

CREATE POLICY coach_messages_update_athlete
  ON coach_messages FOR UPDATE
  USING  (auth.uid() = athlete_id AND sender = 'coach')
  WITH CHECK (auth.uid() = athlete_id AND sender = 'coach');

-- ── Realtime publication ──────────────────────────────────────────────
-- Adds coach_messages to supabase_realtime so the upcoming hook can
-- subscribe to INSERT events filtered by (coach_id, athlete_id).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'coach_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_messages;
  END IF;
END $$;

COMMENT ON TABLE coach_messages IS
  'v9.133 realtime coach<->athlete DM thread. Replaces v6-era file-based JSON export.';
