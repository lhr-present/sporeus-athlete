-- ─── 20260417_telegram.sql — Add Telegram chat_id to push_subscriptions ──────
-- Enables Telegram as a fallback notification channel (Turkish market).
-- Athletes connect by entering their Telegram chat_id in NotificationSettings.

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

COMMENT ON COLUMN push_subscriptions.telegram_chat_id IS
  'Telegram chat_id for notification fallback. Null = Web Push only.';
