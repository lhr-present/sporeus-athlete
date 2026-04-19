-- ─── Migration 053 — Subscription hardening: trial, status, end_date ────────
-- Adds trial tracking, a richer subscription_status enum, and end_date
-- (distinct from expires_at which is the hard access cutoff).
-- Also registers the reconcile-subscriptions daily cron job.

-- ── profiles additions ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT    NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','trialing','past_due','cancelled','expired')),
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at  TIMESTAMPTZ;

-- trial_ends_at: set to NOW()+14d on first Coach checkout when no prior payment.
--   Cron job sets subscription_tier='free' after trial_ends_at if no payment.
-- subscription_status:
--   active    — paid and current
--   trialing  — in 14-day free trial
--   past_due  — payment failed; 3-day grace period (grace_period_ends_at)
--   cancelled — cancelled but still within paid period (subscription_end_date)
--   expired   — past expiry; cron job will set tier='free'
-- subscription_end_date: last day of current paid period (set on cancellation).
-- grace_period_ends_at: past_due grace cutoff = failed_payment_at + 3 days.

COMMENT ON COLUMN profiles.trial_ends_at IS
  '14-day free Coach trial end. NULL = not on trial. Cron downgrades after this.';
COMMENT ON COLUMN profiles.subscription_status IS
  'active | trialing | past_due | cancelled | expired. Drives PastDueBanner.';
COMMENT ON COLUMN profiles.subscription_end_date IS
  'Last day of current paid period (set on cancellation). Access until this date.';
COMMENT ON COLUMN profiles.grace_period_ends_at IS
  'past_due grace deadline = payment_failed_at + 3 days. Downgrade after this.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends
  ON profiles(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sub_status
  ON profiles(subscription_status)
  WHERE subscription_status != 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_grace_ends
  ON profiles(grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

-- ── reconcile-subscriptions cron job ─────────────────────────────────────────
-- Runs daily at 00:30 UTC. Handles 4 cases:
--   1. Trial expired, no payment → downgrade to free
--   2. Grace period expired (past_due) → downgrade to free
--   3. Subscription end_date passed (cancelled) → downgrade to free
--   4. subscription_expires_at passed (catch-all) → downgrade to free
SELECT cron.schedule(
  'reconcile-subscriptions',
  '30 0 * * *',
  $$
  -- 1. Trial ended, still trialing
  UPDATE profiles SET
    subscription_tier   = 'free',
    subscription_status = 'expired',
    trial_ends_at       = NULL,
    updated_at          = NOW()
  WHERE subscription_status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();

  -- 2. Grace period expired (past_due)
  UPDATE profiles SET
    subscription_tier      = 'free',
    subscription_status    = 'expired',
    grace_period_ends_at   = NULL,
    updated_at             = NOW()
  WHERE subscription_status = 'past_due'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at < NOW();

  -- 3. Cancelled subscription, end_date passed
  UPDATE profiles SET
    subscription_tier      = 'free',
    subscription_status    = 'expired',
    subscription_end_date  = NULL,
    updated_at             = NOW()
  WHERE subscription_status = 'cancelled'
    AND subscription_end_date IS NOT NULL
    AND subscription_end_date < NOW();

  -- 4. Catch-all: expires_at passed (old schema rows)
  UPDATE profiles SET
    subscription_tier   = 'free',
    subscription_status = 'expired',
    updated_at          = NOW()
  WHERE subscription_tier   != 'free'
    AND subscription_status  = 'active'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW();
  $$
);
