-- ─── 20260416_security_fixes.sql — Audit v7.19 security fixes ───────────────
-- Addresses H-1, H-3 (RLS USING(true) violations) and C-2 (ai_insights
-- on-demand dedup constraint) from the 2026-04-16 full-stack audit.

-- ─── H-1: referral_codes UPDATE — replace USING(true) with RPC ───────────────
-- The permissive UPDATE policy lets any authenticated user overwrite any row,
-- including zeroing competitor counts or fabricating reward milestones.
DROP POLICY IF EXISTS "authenticated updates referral code" ON referral_codes;

-- Increment via a SECURITY DEFINER RPC called by service-role edge function only.
-- Public users have no direct UPDATE access; uses_count changes only through here.
CREATE OR REPLACE FUNCTION increment_referral_uses(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
     SET uses_count = COALESCE(uses_count, 0) + 1
   WHERE code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION increment_referral_uses(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION increment_referral_uses(TEXT) TO service_role;

COMMENT ON FUNCTION increment_referral_uses IS
  'Atomic referral counter increment. Called by service-role edge function only. '
  'Direct UPDATE on referral_codes is prohibited to prevent count manipulation.';

-- ─── H-3: team_announcements SELECT — restrict to own org ────────────────────
-- Previous USING(true) let every authenticated user read every coach's
-- announcements from every club in the database.
DROP POLICY IF EXISTS "ta_athlete_read" ON public.team_announcements;

CREATE POLICY "ta_athlete_read" ON public.team_announcements
  FOR SELECT USING (
    -- Coach sees their own announcements
    coach_id = auth.uid()
    OR
    -- Athlete sees announcements from their active coach
    EXISTS (
      SELECT 1 FROM public.coach_athletes ca
      WHERE ca.coach_id = team_announcements.coach_id
        AND ca.athlete_id = auth.uid()
        AND ca.status = 'active'
    )
  );

-- ─── C-2: ai_insights on-demand dedup constraint ─────────────────────────────
-- AICoachInsights.jsx now uses data_hash = 'on-demand' (fixed string) for
-- all client-side-generated insights. Combined with the existing unique
-- constraint on (athlete_id, date, data_hash), this prevents a second
-- "Generate Insight" click from burning a second API call on the same day.
-- The existing unique constraint already covers this; this comment documents
-- the intent. No schema change needed beyond fixing the client data_hash.

COMMENT ON TABLE ai_insights IS
  'Daily AI training summaries. Written by nightly-batch (data_hash = SHA-256 of payload) '
  'or on-demand by athlete (data_hash = ''on-demand''). The unique(athlete_id, date, data_hash) '
  'constraint prevents duplicate on-demand calls on the same day.';
