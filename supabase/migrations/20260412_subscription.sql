-- ─── 20260412_subscription.sql — Subscription tier columns on profiles ─────────
-- Adds subscription_tier and subscription_expires_at to profiles table.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier       TEXT NOT NULL DEFAULT 'free'
                             CHECK (subscription_tier IN ('free','coach','club')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Index for expiry checks (cron job that downgrades expired subscriptions)
CREATE INDEX IF NOT EXISTS profiles_sub_expires ON profiles (subscription_expires_at)
  WHERE subscription_tier != 'free';

COMMENT ON COLUMN profiles.subscription_tier       IS 'free | coach | club — managed by Dodo/Stripe webhook';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'NULL = active forever (or free). Webhook sets 30d ahead on payment.succeeded.';
