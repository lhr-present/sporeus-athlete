-- 20260533_team_announcements_rls.sql — H2 (HIGH, cross-tenant read)
--
-- 20260417_team_announcements.sql created the athlete-read policy as
--   CREATE POLICY "ta_athlete_read" ... FOR SELECT USING (true);
-- → ANY authenticated user can read EVERY coach's announcements (cross-tenant).
--
-- Fix: drop the open policy and recreate it scoped so a row is visible only to:
--   • the owning coach (coach_id = auth.uid()), OR
--   • an athlete actively linked to that coach via coach_athletes.
-- The existing "ta_coach_all" (FOR ALL USING coach_id = auth.uid()) is kept for
-- coach writes; the new SELECT policy also covers the coach's own reads.
-- Idempotent: guarded drop + create.

DO $$
BEGIN
  IF to_regclass('public.team_announcements') IS NULL THEN
    RAISE NOTICE 'team_announcements absent — skipping';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "ta_athlete_read" ON public.team_announcements;

  CREATE POLICY "ta_athlete_read"
    ON public.team_announcements
    FOR SELECT
    USING (
      coach_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.coach_athletes ca
        WHERE ca.coach_id   = public.team_announcements.coach_id
          AND ca.athlete_id = (SELECT auth.uid())
          AND ca.status     = 'active'
      )
    );
END $$;
