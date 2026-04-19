-- Migration 055: E5 Coach retention — morning briefing opt-out + session classification
-- 2026-04-19

-- ─── profiles: morning briefing opt-in ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS morning_briefing_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.morning_briefing_enabled IS
  'Coach daily briefing email at 06:00 local time (E5). Default true. Coaches opt out here.';

-- ─── training_log: session classification tag ─────────────────────────────────
-- classifySession() in src/lib/coach/classifySession.js populates this column
-- Tags: planned_match | planned_miss | unplanned_high | unplanned_low | test | recovery | junk | moderate
ALTER TABLE training_log
  ADD COLUMN IF NOT EXISTS session_tag TEXT,
  ADD COLUMN IF NOT EXISTS session_tag_reason TEXT;

COMMENT ON COLUMN training_log.session_tag IS
  'Auto-classification via classifySession() (E5). Values: planned_match, planned_miss, unplanned_high, unplanned_low, test, recovery, junk, moderate.';

COMMENT ON COLUMN training_log.session_tag_reason IS
  'Human-readable explanation for the session_tag value.';

CREATE INDEX IF NOT EXISTS idx_training_log_tag ON training_log(session_tag);
CREATE INDEX IF NOT EXISTS idx_training_log_user_tag ON training_log(user_id, session_tag);

-- ─── coach_message_templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_en     TEXT NOT NULL,
  name_tr     TEXT,
  body_en     TEXT NOT NULL,
  body_tr     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE coach_message_templates IS
  'Coach-defined reusable message templates with variable substitution (E5).';

CREATE INDEX IF NOT EXISTS idx_coach_msg_templates_coach ON coach_message_templates(coach_id, sort_order);

-- RLS
ALTER TABLE coach_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach owns their templates" ON coach_message_templates
  FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- ─── Grant ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_message_templates TO authenticated;
