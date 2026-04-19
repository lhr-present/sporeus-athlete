-- ─── Migration 052 — processed_webhooks + billing_events ────────────────────
-- processed_webhooks: idempotency dedup for Dodo + Stripe webhooks.
--   Insert (webhook_source, event_id) before processing; UNIQUE constraint
--   causes a conflict on replay → handler skips duplicate work.
-- billing_events: immutable monetization audit trail (separate from GDPR audit_log
--   which only covers GDPR-required read/write/delete actions).

-- ── processed_webhooks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_source TEXT        NOT NULL CHECK (webhook_source IN ('dodo','stripe')),
  event_id       TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (webhook_source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_user ON processed_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_ts   ON processed_webhooks(processed_at DESC);

ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
-- Only service_role can read/write — no authenticated access
CREATE POLICY "processed_webhooks_service_only" ON processed_webhooks
  USING (false)
  WITH CHECK (false);

-- ── billing_events ────────────────────────────────────────────────────────────
-- Immutable monetary event log: tier changes, payments, refunds, trials.
CREATE TABLE IF NOT EXISTS billing_events (
  id             BIGSERIAL   PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,  -- 'tier_upgrade','tier_downgrade','payment_success',
                                        -- 'payment_failed','refund','trial_start','trial_end'
  old_tier       TEXT,
  new_tier       TEXT,
  amount_cents   INT,
  currency       TEXT,
  webhook_source TEXT,
  webhook_event_id TEXT,
  reason         TEXT,
  metadata       JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type, created_at DESC);

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own billing history
CREATE POLICY "billing_events_user_read" ON billing_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Only service_role can insert
CREATE POLICY "billing_events_service_insert" ON billing_events
  FOR INSERT TO authenticated WITH CHECK (false);

COMMENT ON TABLE processed_webhooks IS
  'Idempotency dedup for Dodo/Stripe webhook replays. UNIQUE(source,event_id) '
  'ensures handler logic runs exactly once per webhook event.';
COMMENT ON TABLE billing_events IS
  'Immutable monetization audit trail. Never update or delete rows here. '
  'Source of truth for payment reconciliation and support queries.';
