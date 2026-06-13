-- 20260614_coach_notes_active_link_rls.sql
-- Security fix: coach_notes athlete-read RLS lacked an active-link check.
--
-- The consolidated policy from 2026042605_security_hardening_rls.sql reads:
--   USING ( auth.uid() = coach_id OR auth.uid() = athlete_id )
-- Every sibling coach-scoped table (coach_sessions, session_comments, training_log,
-- recovery, injuries) gates the athlete branch on an ACTIVE coach_athletes link
-- (status = 'active'::link_status). coach_notes did not — so a revoked/inactive
-- athlete could still SELECT every clinical note a coach ever wrote about them via
-- the direct REST API (RLS is the real perimeter; the UI hiding it is cosmetic).
--
-- Re-create the policy mirroring the coach_sessions pattern. Coach write access
-- (WITH CHECK = coach-only) is unchanged; this only narrows athlete reads to the
-- duration of an active link. Idempotent (DROP IF EXISTS + CREATE).

DROP POLICY IF EXISTS "coach_notes: coach writes, athlete reads own" ON public.coach_notes;
CREATE POLICY "coach_notes: coach writes, athlete reads own" ON public.coach_notes
  USING (
    (SELECT auth.uid()) = coach_id
    OR EXISTS (
      SELECT 1 FROM public.coach_athletes ca
      WHERE ca.coach_id   = coach_notes.coach_id
        AND ca.athlete_id = (SELECT auth.uid())
        AND ca.status     = 'active'::link_status
    )
  )
  WITH CHECK ((SELECT auth.uid()) = coach_id);
