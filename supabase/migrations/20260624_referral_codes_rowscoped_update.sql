-- 20260624_referral_codes_rowscoped_update.sql
-- Deferred-residual fix (v9.415.0): replace the always-true referral_codes UPDATE
-- policy (from 20260536) with a row-scoped predicate, and drop an over-broad,
-- unused anon UPDATE column-grant.
--
-- Context: the legitimate updater of a referral row is the REDEEMING user
-- (src/lib/referral.js:49 increments uses_count), never the coach who OWNS the
-- row. So we scope UPDATE to "caller is NOT the owner" — this kills the
-- self-inflation vector (a coach bumping their own uses_count / reward
-- milestone) while preserving cross-user redemption.
--
-- Defense layers retained:
--   * Column GRANT (20260618): authenticated may UPDATE only (uses_count).
--   * Freeze trigger (20260536): coach_id/code/created_at restored from OLD,
--     so the WITH CHECK owner test evaluates against the unchanged owner.
--
-- Columns verified against live prod schema 2026-06-16:
--   code, coach_id (owner), created_at, uses_count, reward_granted.
--
-- Note: anon held a column UPDATE grant on ALL 5 columns (leftover from initial
-- schema). There is no anon UPDATE policy, so RLS already blocks anon writes —
-- revoking the grant is pure least-privilege cleanup with no behavior change.

DO $$
BEGIN
  IF to_regclass('public.referral_codes') IS NULL THEN
    RAISE NOTICE 'referral_codes absent — skipping';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "authenticated updates referral code" ON public.referral_codes;

  -- USING gates which rows are visible-to-update; WITH CHECK gates the post-image.
  -- Both require the caller to be a non-owner authenticated redeemer.
  CREATE POLICY "redeemer updates referral code"
    ON public.referral_codes
    FOR UPDATE
    TO authenticated
    USING      (coach_id <> (SELECT auth.uid()))
    WITH CHECK (coach_id <> (SELECT auth.uid()));

  -- Drop the unused/over-broad anon UPDATE grant (RLS already blocks anon).
  REVOKE UPDATE ON public.referral_codes FROM anon;
END $$;
