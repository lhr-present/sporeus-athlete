-- ─── 20260417_invite_linking.sql — Phase 1.1: Coach-Athlete Invite Linking ───
-- Extends coach_invites with label/max_uses/uses_count/revoked_at.
-- Adds coach_id/linked_via_code/linked_at to profiles for fast lookup.
-- Adds 'both' to user_role enum.
-- Does NOT recreate tables that already exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend coach_invites ───────────────────────────────────────────────────
ALTER TABLE coach_invites
  ADD COLUMN IF NOT EXISTS label         text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_uses      int         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uses_count    int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revoked_at    timestamptz DEFAULT NULL;

-- Index for invite lookup by code
CREATE INDEX IF NOT EXISTS coach_invites_code_idx
  ON coach_invites (code)
  WHERE revoked_at IS NULL;

-- ── 2. Extend profiles with coach link fields ─────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_via_code text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_at       timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS profiles_coach_id_idx
  ON profiles (coach_id)
  WHERE coach_id IS NOT NULL;

-- ── 3. Add 'both' to user_role enum ──────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'both';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. RLS policy: athlete can see their own coach_id in profiles ─────────────
-- (profiles already have "own row" policy — no additional policy needed)

COMMENT ON COLUMN coach_invites.label IS 'Optional coach note, e.g. "Rowing squad 2026"';
COMMENT ON COLUMN coach_invites.max_uses IS 'NULL = unlimited uses';
COMMENT ON COLUMN coach_invites.uses_count IS 'Incremented atomically on each successful redemption';
COMMENT ON COLUMN coach_invites.revoked_at IS 'Non-null = invite is revoked';
COMMENT ON COLUMN profiles.coach_id IS 'Fast lookup: UUID of linked coach (mirrors coach_athletes)';
COMMENT ON COLUMN profiles.linked_via_code IS 'Invite code used to establish the link';
COMMENT ON COLUMN profiles.linked_at IS 'Timestamp of coach link establishment';
