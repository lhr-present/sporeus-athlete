-- Fix multiple_permissive_policies: merge FOR ALL + SELECT-only policies into
-- explicit per-command policies with a single merged SELECT condition.

-- ── 1. ai_insights ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ai_insights_tier_check"  ON public.ai_insights;
DROP POLICY IF EXISTS "ai_insights: own rows"   ON public.ai_insights;

CREATE POLICY "ai_insights: select" ON public.ai_insights
  FOR SELECT USING (( SELECT auth.uid() AS uid) = athlete_id);

CREATE POLICY "ai_insights: insert" ON public.ai_insights
  FOR INSERT WITH CHECK (
    (athlete_id = ( SELECT auth.uid() AS uid))
    AND (get_my_tier() = ANY (ARRAY['coach'::text, 'club'::text]))
  );

CREATE POLICY "ai_insights: update" ON public.ai_insights
  FOR UPDATE
  USING  ((athlete_id = ( SELECT auth.uid() AS uid)) AND (get_my_tier() = ANY (ARRAY['coach'::text,'club'::text])))
  WITH CHECK ((athlete_id = ( SELECT auth.uid() AS uid)) AND (get_my_tier() = ANY (ARRAY['coach'::text,'club'::text])));

CREATE POLICY "ai_insights: delete" ON public.ai_insights
  FOR DELETE USING (
    (athlete_id = ( SELECT auth.uid() AS uid))
    AND (get_my_tier() = ANY (ARRAY['coach'::text, 'club'::text]))
  );

-- ── 2. coach_invites ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_invites: coach manages own"   ON public.coach_invites;
DROP POLICY IF EXISTS "coach_invites: athlete reads active" ON public.coach_invites;

CREATE POLICY "coach_invites: select" ON public.coach_invites
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = coach_id)
    OR ((used_by IS NULL) AND (expires_at > now()))
  );

CREATE POLICY "coach_invites: insert" ON public.coach_invites
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_invites: update" ON public.coach_invites
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = coach_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_invites: delete" ON public.coach_invites
  FOR DELETE USING (( SELECT auth.uid() AS uid) = coach_id);

-- ── 3. coach_plans ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_plans: coach manages" ON public.coach_plans;
DROP POLICY IF EXISTS "coach_plans: athlete reads"  ON public.coach_plans;

CREATE POLICY "coach_plans: select" ON public.coach_plans
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = coach_id)
    OR (( SELECT auth.uid() AS uid) = athlete_id)
  );

CREATE POLICY "coach_plans: insert" ON public.coach_plans
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_plans: update" ON public.coach_plans
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = coach_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_plans: delete" ON public.coach_plans
  FOR DELETE USING (( SELECT auth.uid() AS uid) = coach_id);

-- ── 4. coach_sessions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_sessions_coach_write" ON public.coach_sessions;
DROP POLICY IF EXISTS "coach_sessions_select"      ON public.coach_sessions;

CREATE POLICY "coach_sessions: select" ON public.coach_sessions
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = coach_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id  = coach_sessions.coach_id
        AND coach_athletes.athlete_id = ( SELECT auth.uid() AS uid)
        AND coach_athletes.status     = 'active'::link_status
    ))
  );

CREATE POLICY "coach_sessions: insert" ON public.coach_sessions
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_sessions: update" ON public.coach_sessions
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = coach_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = coach_id);

CREATE POLICY "coach_sessions: delete" ON public.coach_sessions
  FOR DELETE USING (( SELECT auth.uid() AS uid) = coach_id);

-- ── 5. consents ──────────────────────────────────────────────────────────────
-- service_role bypasses RLS; this SELECT-only policy is a no-op causing the warning
DROP POLICY IF EXISTS "consents_service_read" ON public.consents;

-- ── 6. injuries ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "injuries: own rows"             ON public.injuries;
DROP POLICY IF EXISTS "injuries: coaches read athletes" ON public.injuries;

CREATE POLICY "injuries: select" ON public.injuries
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = injuries.user_id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "injuries: insert" ON public.injuries
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "injuries: update" ON public.injuries
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "injuries: delete" ON public.injuries
  FOR DELETE USING (( SELECT auth.uid() AS uid) = user_id);

-- ── 7. profiles ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: own row"               ON public.profiles;
DROP POLICY IF EXISTS "profiles: coaches read athletes" ON public.profiles;

CREATE POLICY "profiles: select" ON public.profiles
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = profiles.id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "profiles: insert" ON public.profiles
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = id);

CREATE POLICY "profiles: update" ON public.profiles
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = id)
  WITH CHECK(( SELECT auth.uid() AS uid) = id);

CREATE POLICY "profiles: delete" ON public.profiles
  FOR DELETE USING (( SELECT auth.uid() AS uid) = id);

-- ── 8. race_results ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "race_results: own rows"              ON public.race_results;
DROP POLICY IF EXISTS "race_results: coaches read athletes" ON public.race_results;

CREATE POLICY "race_results: select" ON public.race_results
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = race_results.user_id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "race_results: insert" ON public.race_results
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "race_results: update" ON public.race_results
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "race_results: delete" ON public.race_results
  FOR DELETE USING (( SELECT auth.uid() AS uid) = user_id);

-- ── 9. recovery ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "recovery: own rows"              ON public.recovery;
DROP POLICY IF EXISTS "recovery: coaches read athletes" ON public.recovery;

CREATE POLICY "recovery: select" ON public.recovery
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = recovery.user_id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "recovery: insert" ON public.recovery
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "recovery: update" ON public.recovery
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "recovery: delete" ON public.recovery
  FOR DELETE USING (( SELECT auth.uid() AS uid) = user_id);

-- ── 10. session_attendance ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "attendance_athlete_write" ON public.session_attendance;
DROP POLICY IF EXISTS "attendance_coach_read"    ON public.session_attendance;

CREATE POLICY "session_attendance: select" ON public.session_attendance
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = athlete_id)
    OR (EXISTS (
      SELECT 1 FROM coach_sessions
      WHERE coach_sessions.id       = session_attendance.session_id
        AND coach_sessions.coach_id = ( SELECT auth.uid() AS uid)
    ))
  );

CREATE POLICY "session_attendance: insert" ON public.session_attendance
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = athlete_id);

CREATE POLICY "session_attendance: update" ON public.session_attendance
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = athlete_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = athlete_id);

CREATE POLICY "session_attendance: delete" ON public.session_attendance
  FOR DELETE USING (( SELECT auth.uid() AS uid) = athlete_id);

-- ── 11. team_announcements ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ta_coach_all"    ON public.team_announcements;
DROP POLICY IF EXISTS "ta_athlete_read" ON public.team_announcements;

CREATE POLICY "team_announcements: select" ON public.team_announcements
  FOR SELECT USING (
    (coach_id = ( SELECT auth.uid() AS uid))
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = team_announcements.coach_id
        AND ca.athlete_id = ( SELECT auth.uid() AS uid)
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "team_announcements: insert" ON public.team_announcements
  FOR INSERT WITH CHECK (coach_id = ( SELECT auth.uid() AS uid));

CREATE POLICY "team_announcements: update" ON public.team_announcements
  FOR UPDATE
  USING     (coach_id = ( SELECT auth.uid() AS uid))
  WITH CHECK(coach_id = ( SELECT auth.uid() AS uid));

CREATE POLICY "team_announcements: delete" ON public.team_announcements
  FOR DELETE USING (coach_id = ( SELECT auth.uid() AS uid));

-- ── 12. test_results ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "test_results: own rows"              ON public.test_results;
DROP POLICY IF EXISTS "test_results: coaches read athletes" ON public.test_results;

CREATE POLICY "test_results: select" ON public.test_results
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = test_results.user_id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "test_results: insert" ON public.test_results
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "test_results: update" ON public.test_results
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "test_results: delete" ON public.test_results
  FOR DELETE USING (( SELECT auth.uid() AS uid) = user_id);

-- ── 13. training_log ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "training_log: own rows"              ON public.training_log;
DROP POLICY IF EXISTS "training_log: coaches read athletes" ON public.training_log;

CREATE POLICY "training_log: select" ON public.training_log
  FOR SELECT USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id   = ( SELECT auth.uid() AS uid)
        AND ca.athlete_id = training_log.user_id
        AND ca.status     = 'active'::link_status
    ))
  );

CREATE POLICY "training_log: insert" ON public.training_log
  FOR INSERT WITH CHECK (( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "training_log: update" ON public.training_log
  FOR UPDATE
  USING     (( SELECT auth.uid() AS uid) = user_id)
  WITH CHECK(( SELECT auth.uid() AS uid) = user_id);

CREATE POLICY "training_log: delete" ON public.training_log
  FOR DELETE USING (( SELECT auth.uid() AS uid) = user_id);
