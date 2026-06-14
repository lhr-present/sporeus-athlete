-- ─── 20260416_profile_data.sql ───────────────────────────────────────────────
-- Adds profile_data JSONB column to profiles table.
-- Stores the full sporeus_profile localStorage object (name, sport, ftp, maxhr,
-- gender, age, goal, threshold, athleteLevel, trainDays, etc.) so it persists
-- across devices and browser clears for authenticated users.
-- JSONB used intentionally — the profile object gains new fields over time
-- without requiring new migrations.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for any future queries that filter on specific profile fields
CREATE INDEX IF NOT EXISTS profiles_sport_idx
  ON profiles ((profile_data->>'sport'))
  WHERE profile_data->>'sport' IS NOT NULL;

COMMENT ON COLUMN profiles.profile_data IS
  'Full athlete profile object from the app (name, sport, ftp, maxhr, goal, etc.)
   Mirrors the sporeus_profile localStorage key. Updated on every setProfile() call.';
