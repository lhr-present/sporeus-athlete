-- 20260457_ai_feedback.sql — E7: AI quality feedback loop
-- ai_feedback: per-output thumbs up/down with prompt version logging
-- prompt_versions: soft-lock of which prompt SHA was active on each date

-- ── ai_feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface         TEXT NOT NULL,            -- analyse_session | weekly_digest | ask_coach | etc.
  prompt_version  TEXT NOT NULL,            -- e.g. 'v1:a3f2b1c0'
  rating          SMALLINT NOT NULL CHECK (rating IN (1, -1)),
  comment         TEXT,                     -- optional free-text (max 500 chars)
  insight_id      UUID,                     -- optional: ai_insights row id this feedback refers to
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_feedback ADD CONSTRAINT ai_feedback_comment_len
  CHECK (comment IS NULL OR char_length(comment) <= 500);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_surface_prompt
  ON ai_feedback(surface, prompt_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user
  ON ai_feedback(user_id, created_at DESC);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Athletes can INSERT their own feedback; no UPDATE/DELETE
CREATE POLICY "ai_feedback: athlete can insert own"
  ON ai_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_feedback: athlete can read own"
  ON ai_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- ── prompt_versions ────────────────────────────────────────────────────────
-- Log table: records which prompt SHA was deployed on each date per surface.
-- Append-only — enables bisecting quality regressions to a specific prompt change.
CREATE TABLE IF NOT EXISTS prompt_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface     TEXT NOT NULL,
  version     TEXT NOT NULL,        -- e.g. 'v1:a3f2b1c0'
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Admin-only read (no user-facing access)
CREATE POLICY "prompt_versions: service role only"
  ON prompt_versions
  USING (false);   -- blocked for all; edge functions use service role key directly

-- ── admin view: feedback stats per surface ─────────────────────────────────
CREATE OR REPLACE VIEW ai_feedback_summary AS
SELECT
  surface,
  prompt_version,
  COUNT(*) FILTER (WHERE rating =  1) AS thumbs_up,
  COUNT(*) FILTER (WHERE rating = -1) AS thumbs_down,
  COUNT(*)                            AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE rating = 1) / NULLIF(COUNT(*), 0),
    1
  ) AS positive_pct,
  MAX(created_at) AS last_feedback_at
FROM ai_feedback
GROUP BY surface, prompt_version
ORDER BY surface, last_feedback_at DESC;
