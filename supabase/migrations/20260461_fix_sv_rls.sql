-- 20260461_fix_sv_rls.sql — Fix session_views SELECT RLS
-- Bug: athlete could not see coach's view record for their own session.
-- The third OR branch checked "session owner is a coach + I am their athlete"
-- which never matches (sessions are owned by athletes, not coaches).
-- Fix: add a fourth branch — "the viewer (session_views.user_id) is my coach".

DROP POLICY IF EXISTS "sv: read own or linked" ON public.session_views;

CREATE POLICY "sv: read own or linked"
  ON public.session_views FOR SELECT
  USING (
    -- Own view record
    user_id = auth.uid()
    -- Coach can see own athletes' view records (for squad dashboard)
    OR EXISTS (
      SELECT 1 FROM public.training_log tl
      JOIN public.coach_athletes ca ON ca.athlete_id = tl.user_id
      WHERE tl.id = session_views.session_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
    )
    -- Athlete can see their coach's view record (CoachPresenceBadge)
    OR EXISTS (
      SELECT 1 FROM public.training_log tl
      JOIN public.coach_athletes ca ON ca.coach_id = session_views.user_id
                                    AND ca.athlete_id = tl.user_id
      WHERE tl.id = session_views.session_id
        AND tl.user_id = auth.uid()
        AND ca.status = 'active'
    )
  );
