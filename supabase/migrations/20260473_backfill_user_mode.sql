-- 20260473_backfill_user_mode.sql
-- Ensure all pre-existing profiles keep the endurance experience unchanged.
UPDATE profiles SET user_mode = 'endurance' WHERE user_mode IS NULL OR user_mode = '';
