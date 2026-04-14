-- ─── 20260417_weekly_digests.sql — Weekly coach digest cache ─────────────────
-- Stores per-coach weekly AI digest generated every Sunday by nightly-batch.
-- Coach/club tier only (tier_enforcement gate applied at query time).

CREATE TABLE IF NOT EXISTS public.weekly_digests (
  id          BIGSERIAL PRIMARY KEY,
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  digest_json JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, week_start)
);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY wd_coach_read ON weekly_digests
  FOR SELECT USING (auth.uid() = coach_id);

CREATE INDEX IF NOT EXISTS weekly_digests_coach_week
  ON weekly_digests (coach_id, week_start DESC);

COMMENT ON TABLE weekly_digests IS
  'Sunday AI digest per coach. Written by nightly-batch, read by coach. Tier-gated (coach/club).';
