-- ═══════════════════════════════════════════════════════════════════════════
-- Security: RLS initplan fix (auth.uid() → (SELECT auth.uid())) + consolidation
-- ═══════════════════════════════════════════════════════════════════════════

-- ── activity_upload_jobs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_upload_jobs: own rows" ON public.activity_upload_jobs;
CREATE POLICY "activity_upload_jobs: own rows" ON public.activity_upload_jobs
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── ai_insights ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ai_insights: own rows" ON public.ai_insights;
CREATE POLICY "ai_insights: own rows" ON public.ai_insights FOR SELECT
  USING ((SELECT auth.uid()) = athlete_id);

DROP POLICY IF EXISTS ai_insights_tier_check ON public.ai_insights;
CREATE POLICY ai_insights_tier_check ON public.ai_insights
  USING ((athlete_id = (SELECT auth.uid()))
         AND (get_my_tier() = ANY (ARRAY['coach'::text, 'club'::text])))
  WITH CHECK ((athlete_id = (SELECT auth.uid()))
              AND (get_my_tier() = ANY (ARRAY['coach'::text, 'club'::text])));

-- ── api_keys ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS api_keys_owner ON public.api_keys;
CREATE POLICY api_keys_owner ON public.api_keys FOR SELECT
  USING (org_id = (SELECT auth.uid()));

-- ── athlete_devices ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own devices" ON public.athlete_devices;
CREATE POLICY "Users manage own devices" ON public.athlete_devices
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── audit_log ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ── billing_events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS billing_events_user_read ON public.billing_events;
CREATE POLICY billing_events_user_read ON public.billing_events FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ── coach_athletes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_athletes: coach or athlete" ON public.coach_athletes;
CREATE POLICY "coach_athletes: coach or athlete" ON public.coach_athletes
  USING (((SELECT auth.uid()) = coach_id) OR ((SELECT auth.uid()) = athlete_id))
  WITH CHECK (((SELECT auth.uid()) = coach_id) OR ((SELECT auth.uid()) = athlete_id));

-- ── coach_invites ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_invites: coach manages own" ON public.coach_invites;
CREATE POLICY "coach_invites: coach manages own" ON public.coach_invites
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

-- ── coach_notes (CONSOLIDATION: 3 policies → 1) ────────────────────────────
DROP POLICY IF EXISTS "coach_notes: coach writes, athlete reads own" ON public.coach_notes;
DROP POLICY IF EXISTS coach_notes_coach ON public.coach_notes;
DROP POLICY IF EXISTS coach_notes_athlete_read ON public.coach_notes;
CREATE POLICY "coach_notes: coach writes, athlete reads own" ON public.coach_notes
  USING (((SELECT auth.uid()) = coach_id) OR ((SELECT auth.uid()) = athlete_id))
  WITH CHECK ((SELECT auth.uid()) = coach_id);

-- ── coach_plans ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach_plans: athlete reads" ON public.coach_plans;
CREATE POLICY "coach_plans: athlete reads" ON public.coach_plans FOR SELECT
  USING ((SELECT auth.uid()) = athlete_id);

DROP POLICY IF EXISTS "coach_plans: coach manages" ON public.coach_plans;
CREATE POLICY "coach_plans: coach manages" ON public.coach_plans
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

-- ── coach_sessions (CONSOLIDATION: 2 SELECT policies → 1, drop redundant) ─
DROP POLICY IF EXISTS coach_sessions_coach_read ON public.coach_sessions;
DROP POLICY IF EXISTS coach_sessions_athlete_read ON public.coach_sessions;

DROP POLICY IF EXISTS coach_sessions_coach_write ON public.coach_sessions;
CREATE POLICY coach_sessions_coach_write ON public.coach_sessions
  USING ((SELECT auth.uid()) = coach_id);

CREATE POLICY coach_sessions_select ON public.coach_sessions FOR SELECT
  USING (
    (SELECT auth.uid()) = coach_id
    OR EXISTS (
      SELECT 1 FROM coach_athletes
      WHERE coach_athletes.coach_id = coach_sessions.coach_id
        AND coach_athletes.athlete_id = (SELECT auth.uid())
        AND coach_athletes.status = 'active'::link_status
    )
  );

-- ── consents ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS consents_self_all ON public.consents;
CREATE POLICY consents_self_all ON public.consents
  USING ((SELECT auth.uid()) = user_id);

-- ── data_rights_requests ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "drr: user cancel deletion" ON public.data_rights_requests;
CREATE POLICY "drr: user cancel deletion" ON public.data_rights_requests FOR UPDATE
  USING (((SELECT auth.uid()) = user_id)
         AND (kind = 'deletion'::text) AND (status = 'pending'::text))
  WITH CHECK (((SELECT auth.uid()) = user_id) AND (status = 'canceled'::text));

DROP POLICY IF EXISTS "drr: user insert own" ON public.data_rights_requests;
CREATE POLICY "drr: user insert own" ON public.data_rights_requests FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "drr: user select own" ON public.data_rights_requests;
CREATE POLICY "drr: user select own" ON public.data_rights_requests FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── injuries ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "injuries: coaches read athletes" ON public.injuries;
CREATE POLICY "injuries: coaches read athletes" ON public.injuries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = injuries.user_id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "injuries: own rows" ON public.injuries;
CREATE POLICY "injuries: own rows" ON public.injuries
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── messages (CONSOLIDATION: INSERT 2→1, SELECT 2→1) ──────────────────────
DROP POLICY IF EXISTS msg_athlete_insert ON public.messages;
DROP POLICY IF EXISTS msg_coach_insert   ON public.messages;
CREATE POLICY msg_insert ON public.messages FOR INSERT
  WITH CHECK (
    ((athlete_id = (SELECT auth.uid())) AND (sender_role = 'athlete'::text))
    OR
    ((coach_id   = (SELECT auth.uid())) AND (sender_role = 'coach'::text))
  );

DROP POLICY IF EXISTS msg_athlete_select ON public.messages;
DROP POLICY IF EXISTS msg_coach_select   ON public.messages;
CREATE POLICY msg_select ON public.messages FOR SELECT
  USING ((athlete_id = (SELECT auth.uid())) OR (coach_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS msg_athlete_update ON public.messages;
CREATE POLICY msg_athlete_update ON public.messages FOR UPDATE
  USING ((athlete_id = (SELECT auth.uid())) AND (sender_role = 'coach'::text))
  WITH CHECK (athlete_id = (SELECT auth.uid()));

-- ── notification_log ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS notif_log_own_read ON public.notification_log;
CREATE POLICY notif_log_own_read ON public.notification_log FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── org_branding ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS org_branding_owner ON public.org_branding;
CREATE POLICY org_branding_owner ON public.org_branding
  USING (org_id = (SELECT auth.uid()))
  WITH CHECK (org_id = (SELECT auth.uid()));

-- ── profiles ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: coaches read athletes" ON public.profiles;
CREATE POLICY "profiles: coaches read athletes" ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = profiles.id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "profiles: own row" ON public.profiles;
CREATE POLICY "profiles: own row" ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ── push_subscriptions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "push_subscriptions: own rows" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions: own rows" ON public.push_subscriptions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── queue_metrics ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS queue_metrics_admin_read ON public.queue_metrics;
CREATE POLICY queue_metrics_admin_read ON public.queue_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'::user_role
  ));

-- ── race_results ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "race_results: coaches read athletes" ON public.race_results;
CREATE POLICY "race_results: coaches read athletes" ON public.race_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = race_results.user_id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "race_results: own rows" ON public.race_results;
CREATE POLICY "race_results: own rows" ON public.race_results
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── recovery ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "recovery: coaches read athletes" ON public.recovery;
CREATE POLICY "recovery: coaches read athletes" ON public.recovery FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = recovery.user_id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "recovery: own rows" ON public.recovery;
CREATE POLICY "recovery: own rows" ON public.recovery
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── referral_codes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach inserts own referral code" ON public.referral_codes;
CREATE POLICY "coach inserts own referral code" ON public.referral_codes FOR INSERT
  WITH CHECK (coach_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "coach reads own referral code" ON public.referral_codes;
CREATE POLICY "coach reads own referral code" ON public.referral_codes FOR SELECT
  USING (coach_id = (SELECT auth.uid()));

-- ── referral_rewards ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "coach reads own rewards" ON public.referral_rewards;
CREATE POLICY "coach reads own rewards" ON public.referral_rewards FOR SELECT
  USING (coach_id = (SELECT auth.uid()));

-- ── session_attendance ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS attendance_athlete_write ON public.session_attendance;
CREATE POLICY attendance_athlete_write ON public.session_attendance
  USING ((SELECT auth.uid()) = athlete_id);

DROP POLICY IF EXISTS attendance_coach_read ON public.session_attendance;
CREATE POLICY attendance_coach_read ON public.session_attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_sessions
    WHERE coach_sessions.id = session_attendance.session_id
      AND coach_sessions.coach_id = (SELECT auth.uid())
  ));

-- ── session_comments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sc: author can update" ON public.session_comments;
CREATE POLICY "sc: author can update" ON public.session_comments FOR UPDATE
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "sc: participants can insert" ON public.session_comments;
CREATE POLICY "sc: participants can insert" ON public.session_comments FOR INSERT
  WITH CHECK (
    (author_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM training_log tl
      WHERE tl.id = session_comments.session_id
        AND (
          tl.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM coach_athletes ca
            WHERE ca.coach_id = (SELECT auth.uid())
              AND ca.athlete_id = tl.user_id
              AND ca.status = 'active'::link_status
          )
        )
    )
  );

DROP POLICY IF EXISTS "sc: participants can read" ON public.session_comments;
CREATE POLICY "sc: participants can read" ON public.session_comments FOR SELECT
  USING (
    (author_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM training_log tl
      WHERE tl.id = session_comments.session_id
        AND (
          tl.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM coach_athletes ca
            WHERE ca.coach_id = (SELECT auth.uid())
              AND ca.athlete_id = tl.user_id
              AND ca.status = 'active'::link_status
          )
        )
    )
  );

-- ── session_views ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sv: insert own" ON public.session_views;
CREATE POLICY "sv: insert own" ON public.session_views FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "sv: read own or linked" ON public.session_views;
CREATE POLICY "sv: read own or linked" ON public.session_views FOR SELECT
  USING (
    (user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM training_log tl
      JOIN coach_athletes ca ON ca.athlete_id = tl.user_id
      WHERE tl.id = session_views.session_id
        AND ca.coach_id = (SELECT auth.uid())
        AND ca.status = 'active'::link_status
    )
    OR EXISTS (
      SELECT 1 FROM training_log tl
      JOIN coach_athletes ca ON (ca.coach_id = session_views.user_id
                                 AND ca.athlete_id = tl.user_id)
      WHERE tl.id = session_views.session_id
        AND tl.user_id = (SELECT auth.uid())
        AND ca.status = 'active'::link_status
    )
  );

DROP POLICY IF EXISTS "sv: update own" ON public.session_views;
CREATE POLICY "sv: update own" ON public.session_views FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── strava_tokens ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "strava_tokens: own row" ON public.strava_tokens;
CREATE POLICY "strava_tokens: own row" ON public.strava_tokens
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── team_announcements ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS ta_athlete_read ON public.team_announcements;
CREATE POLICY ta_athlete_read ON public.team_announcements FOR SELECT
  USING (
    (coach_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id = team_announcements.coach_id
        AND ca.athlete_id = (SELECT auth.uid())
        AND ca.status = 'active'::link_status
    )
  );

DROP POLICY IF EXISTS ta_coach_all ON public.team_announcements;
CREATE POLICY ta_coach_all ON public.team_announcements
  USING (coach_id = (SELECT auth.uid()));

-- ── test_results ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "test_results: coaches read athletes" ON public.test_results;
CREATE POLICY "test_results: coaches read athletes" ON public.test_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = test_results.user_id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "test_results: own rows" ON public.test_results;
CREATE POLICY "test_results: own rows" ON public.test_results
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── training_log ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "training_log: coaches read athletes" ON public.training_log;
CREATE POLICY "training_log: coaches read athletes" ON public.training_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = (SELECT auth.uid())
      AND ca.athlete_id = training_log.user_id
      AND ca.status = 'active'::link_status
  ));

DROP POLICY IF EXISTS "training_log: own rows" ON public.training_log;
CREATE POLICY "training_log: own rows" ON public.training_log
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── training_plans ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own plan" ON public.training_plans;
CREATE POLICY "Users manage own plan" ON public.training_plans
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── weekly_digests ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wd_coach_read ON public.weekly_digests;
CREATE POLICY wd_coach_read ON public.weekly_digests FOR SELECT
  USING ((SELECT auth.uid()) = coach_id);
