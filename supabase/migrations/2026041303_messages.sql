-- ─── 20260413_messages.sql — Coach-athlete direct messages ─────────────────

CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT        NOT NULL CHECK (sender_role IN ('coach','athlete')),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX idx_messages_thread  ON messages (coach_id, athlete_id, sent_at DESC);
CREATE INDEX idx_messages_athlete ON messages (athlete_id, read_at) WHERE read_at IS NULL;

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Coach sees all messages in threads they own
CREATE POLICY msg_coach_select ON messages FOR SELECT
  USING (coach_id = auth.uid());

-- Coach can insert messages as sender
CREATE POLICY msg_coach_insert ON messages FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND sender_role = 'coach');

-- Athlete sees messages addressed to them
CREATE POLICY msg_athlete_select ON messages FOR SELECT
  USING (athlete_id = auth.uid());

-- Athlete can insert reply messages
CREATE POLICY msg_athlete_insert ON messages FOR INSERT
  WITH CHECK (athlete_id = auth.uid() AND sender_role = 'athlete');

-- Athlete can mark their own received messages as read
CREATE POLICY msg_athlete_update ON messages FOR UPDATE
  USING (athlete_id = auth.uid() AND sender_role = 'coach')
  WITH CHECK (athlete_id = auth.uid());

COMMENT ON TABLE messages IS 'Direct coach-to-athlete messages with read receipts';
