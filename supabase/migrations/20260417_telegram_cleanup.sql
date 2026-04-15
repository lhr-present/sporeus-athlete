-- ─── 20260417_telegram_cleanup.sql — Remove Telegram column ──────────────────
-- Drops the telegram_chat_id column added by 20260417_telegram.sql.
-- Telegram replaced by in-app NotificationBell (v6.9.3).

ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS telegram_chat_id;

-- Also remove the legacy telegram_chat_id column from profiles if it exists
-- (was selected in nightly-batch; safe to drop if unused).
ALTER TABLE profiles DROP COLUMN IF EXISTS telegram_chat_id;
