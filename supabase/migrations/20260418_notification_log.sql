-- Migration: notification_log table + push_subscriptions additions
-- Applied via: npx supabase db query --linked
-- Version: v7.28.0 (Phase 1.5 — Push Notifications)

-- ── notification_log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind             text        NOT NULL CHECK (kind IN (
                                 'checkin_reminder', 'invite_accepted', 'readiness_red',
                                 'session_feedback', 'missed_checkin', 'test',
                                 'race_countdown', 'injury_alert', 'system', 'message')),
  dedupe_key       text,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  subject_id       uuid,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  delivery_status  text        NOT NULL DEFAULT 'pending'
                               CHECK (delivery_status IN (
                                 'pending', 'delivered', 'failed',
                                 'expired_subscription', 'deduped')),
  error            text
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user_kind_sent
  ON notification_log (user_id, kind, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_log_dedupe
  ON notification_log (dedupe_key, sent_at DESC)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Athletes can read their own notification history
CREATE POLICY "notif_log_own_read"
  ON notification_log FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE only via service role (bypasses RLS)

COMMENT ON TABLE notification_log IS
  'Server-side push notification delivery log. INSERT only via edge function service role.';
COMMENT ON COLUMN notification_log.dedupe_key IS
  'Unique key for deduplication window, e.g. checkin_reminder:userId:2026-04-18';
COMMENT ON COLUMN notification_log.delivery_status IS
  'pending=in flight, delivered=success, failed=error, expired_subscription=410, deduped=skipped';

-- ── push_subscriptions: add columns referenced by pushNotify.js ───────────────
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS last_success_at  timestamptz,
  ADD COLUMN IF NOT EXISTS user_agent       text;

-- Ensure unique constraint exists on (user_id, endpoint) for upsert correctness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_id_endpoint_key'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_endpoint_key
      UNIQUE (user_id, endpoint);
  END IF;
END $$;

-- ── pg_cron schedules (run once via SQL Editor after migration) ────────────────
-- Requires pg_cron extension enabled in Supabase Dashboard.
-- Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> with actual values.
--
-- SELECT cron.schedule(
--   'trigger-checkin-reminders',
--   '0 * * * *',
--   $$SELECT net.http_post(
--     url := '<SUPABASE_URL>/functions/v1/trigger-checkin-reminders',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   )$$
-- );
