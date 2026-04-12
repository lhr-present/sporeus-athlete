-- ─── Referral system ────────────────────────────────────────────────────────
-- referral_codes: one row per coach, tracks how many clubs signed up via their code.
-- referral_rewards: one row per earned reward milestone (every 3 referrals = 1 month free).

CREATE TABLE IF NOT EXISTS referral_codes (
  code           TEXT        PRIMARY KEY,
  coach_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uses_count     INT         NOT NULL DEFAULT 0,
  reward_granted BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type  TEXT        NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at   TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS referral_codes_coach_idx  ON referral_codes (coach_id);
CREATE INDEX IF NOT EXISTS referral_rewards_coach_idx ON referral_rewards (coach_id);

-- RLS
ALTER TABLE referral_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Coaches can read and upsert their own code
CREATE POLICY "coach reads own referral code"
  ON referral_codes FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "coach inserts own referral code"
  ON referral_codes FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- Allow any authenticated user to increment uses_count when applying a code
CREATE POLICY "authenticated updates referral code"
  ON referral_codes FOR UPDATE
  USING (true);

-- Coaches read their own rewards
CREATE POLICY "coach reads own rewards"
  ON referral_rewards FOR SELECT
  USING (coach_id = auth.uid());

-- Service role only inserts rewards (milestone logic runs server-side)
-- (no INSERT policy for anon/authenticated — handled by service key in edge fn)
