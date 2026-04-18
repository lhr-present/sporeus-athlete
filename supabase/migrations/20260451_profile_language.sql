-- ─── Migration 051 — profiles.language preference ────────────────────────────
-- Adds a language column to profiles so user language preference persists
-- server-side (used for email templates, push notification content, PDF reports).
-- Default 'tr' — primary audience is Turkish (EŞİK book readers).
-- App reads from localStorage first; syncs to this column on sign-in.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'tr'
    CHECK (language IN ('en', 'tr'));

-- Index: operator-digest groups users by language for batch email rendering
CREATE INDEX IF NOT EXISTS idx_profiles_language ON profiles(language);

-- Backfill: existing rows where localStorage lang is known come from client on
-- next sign-in. For server-generated content, 'tr' default is acceptable.
-- To force English for existing accounts that used EN before this migration,
-- set language='en' WHERE created_at < NOW() — intentionally NOT done here
-- because we cannot determine their actual preference server-side.

COMMENT ON COLUMN profiles.language IS
  'UI language preference: en | tr. Synced from localStorage on sign-in. '
  'Used by edge functions (operator-digest, generate-report, push notifications) '
  'to render content in user''s preferred language.';
