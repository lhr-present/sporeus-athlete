-- ─── Migration 054 — apply_tier_change() atomic SQL function ─────────────────
-- Wraps tier transition + billing_events insert in one transaction.
-- Called exclusively from dodo-webhook / stripe edge functions.
-- SECURITY DEFINER + REVOKE ensures only service_role can call it.
--
-- Parameters:
--   p_user_id          UUID    — target user
--   p_new_tier         TEXT    — 'free' | 'coach' | 'club'
--   p_reason           TEXT    — audit note (e.g. 'payment.succeeded', 'trial_start')
--   p_webhook_event_id TEXT    — idempotency ID from processed_webhooks (optional)
--   p_old_tier         TEXT    — previous tier (read from profiles if NULL)
--   p_amount_cents     INT     — payment amount in cents for billing_events (optional)
--   p_currency         TEXT    — ISO 4217 code, e.g. 'TRY', 'EUR' (optional)
--   p_webhook_source   TEXT    — 'dodo' | 'stripe' (optional)
--   p_sub_status       TEXT    — override subscription_status (auto-derived if NULL)
--   p_expires_days     INT     — days until subscription_expires_at (default 30)

CREATE OR REPLACE FUNCTION apply_tier_change(
  p_user_id          UUID,
  p_new_tier         TEXT,
  p_reason           TEXT,
  p_webhook_event_id TEXT     DEFAULT NULL,
  p_old_tier         TEXT     DEFAULT NULL,
  p_amount_cents     INT      DEFAULT NULL,
  p_currency         TEXT     DEFAULT NULL,
  p_webhook_source   TEXT     DEFAULT NULL,
  p_sub_status       TEXT     DEFAULT NULL,
  p_expires_days     INT      DEFAULT 30
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier   TEXT;
  v_event_type TEXT;
  v_new_status TEXT;
BEGIN
  -- Validate tier argument
  IF p_new_tier NOT IN ('free', 'coach', 'club') THEN
    RAISE EXCEPTION 'apply_tier_change: invalid tier "%"', p_new_tier;
  END IF;

  -- Resolve old tier from DB if caller didn't pass it
  IF p_old_tier IS NULL THEN
    SELECT subscription_tier INTO v_old_tier
      FROM profiles WHERE id = p_user_id;
  ELSE
    v_old_tier := p_old_tier;
  END IF;

  -- Derive billing event type
  v_event_type := CASE
    WHEN p_reason = 'trial_start'                     THEN 'trial_start'
    WHEN p_new_tier = 'free' AND p_reason LIKE 'trial%' THEN 'trial_end'
    WHEN p_new_tier = 'free'                          THEN 'tier_downgrade'
    ELSE 'tier_upgrade'
  END;

  -- Derive subscription_status unless caller overrides
  v_new_status := COALESCE(p_sub_status,
    CASE
      WHEN p_reason = 'trial_start'  THEN 'trialing'
      WHEN p_new_tier = 'free'       THEN 'expired'
      ELSE 'active'
    END
  );

  -- ── Atomic profile update ──────────────────────────────────────────────────
  UPDATE profiles SET
    subscription_tier       = p_new_tier,
    subscription_status     = v_new_status,
    -- Only extend expires_at on paid upgrades; keep current value on downgrades
    subscription_expires_at = CASE
      WHEN p_new_tier != 'free'
        THEN NOW() + (p_expires_days || ' days')::INTERVAL
      ELSE subscription_expires_at
    END,
    -- Set trial_ends_at only on trial_start events
    trial_ends_at           = CASE
      WHEN p_reason = 'trial_start' THEN NOW() + INTERVAL '14 days'
      WHEN p_new_tier = 'free'      THEN NULL   -- clear on downgrade
      ELSE trial_ends_at
    END,
    -- Clear grace period on any successful payment
    grace_period_ends_at    = CASE
      WHEN v_new_status = 'active' THEN NULL
      ELSE grace_period_ends_at
    END,
    -- Clear subscription_end_date on paid upgrade
    subscription_end_date   = CASE
      WHEN p_new_tier != 'free' THEN NULL
      ELSE subscription_end_date
    END,
    updated_at              = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_tier_change: user % not found', p_user_id;
  END IF;

  -- ── Immutable billing audit row ────────────────────────────────────────────
  INSERT INTO billing_events (
    user_id, event_type, old_tier, new_tier,
    webhook_source, webhook_event_id, reason,
    amount_cents, currency
  ) VALUES (
    p_user_id, v_event_type, v_old_tier, p_new_tier,
    p_webhook_source, p_webhook_event_id, p_reason,
    p_amount_cents, p_currency
  );
END;
$$;

-- ── Access control ─────────────────────────────────────────────────────────────
-- Only the service_role (edge functions) may call apply_tier_change.
-- Revoke from public and authenticated so no client can invoke it directly.
REVOKE ALL ON FUNCTION apply_tier_change(
  UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, INT
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION apply_tier_change(
  UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, INT
) FROM authenticated;

COMMENT ON FUNCTION apply_tier_change IS
  'Atomic tier transition: updates profiles + inserts billing_events in one txn. '
  'SECURITY DEFINER — service_role only. Called from dodo-webhook / stripe edge fns.';
