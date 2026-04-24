-- ═══════════════════════════════════════════════════════════════════════════
-- Security: Drop unused indexes + add missing FK indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Drop 26 unused indexes (flagged by Supabase performance advisor) ───────
DROP INDEX IF EXISTS public.idx_ai_insights_source;
DROP INDEX IF EXISTS public.coach_invites_code;
DROP INDEX IF EXISTS public.req_counts_key_time;
DROP INDEX IF EXISTS public.batch_errors_date_idx;
DROP INDEX IF EXISTS public.profiles_sub_expires;
DROP INDEX IF EXISTS public.idx_messages_athlete;
DROP INDEX IF EXISTS public.idx_coach_sessions_coach_id;
DROP INDEX IF EXISTS public.idx_coach_sessions_date;
DROP INDEX IF EXISTS public.idx_session_attendance_session;
DROP INDEX IF EXISTS public.audit_log_user_id_idx;
DROP INDEX IF EXISTS public.audit_log_created_at_idx;
DROP INDEX IF EXISTS public.idx_session_attendance_session_athlete;
DROP INDEX IF EXISTS public.profiles_sport_idx;
DROP INDEX IF EXISTS public.coach_invites_code_idx;
DROP INDEX IF EXISTS public.profiles_coach_id_idx;
DROP INDEX IF EXISTS public.idx_notif_log_dedupe;
DROP INDEX IF EXISTS public.idx_msg_content_tsv;
DROP INDEX IF EXISTS public.idx_tl_notes_tsv;
DROP INDEX IF EXISTS public.idx_cn_body_tsv;
DROP INDEX IF EXISTS public.idx_ann_body_tsv;
DROP INDEX IF EXISTS public.idx_profiles_trial_ends;
DROP INDEX IF EXISTS public.idx_profiles_sub_status;
DROP INDEX IF EXISTS public.idx_profiles_grace_ends;
DROP INDEX IF EXISTS public.idx_processed_webhooks_ts;
DROP INDEX IF EXISTS public.idx_billing_events_type;
DROP INDEX IF EXISTS public.idx_sub_events_type;

-- ── Add 3 missing FK indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_upload_jobs_log_entry_id
  ON public.activity_upload_jobs (log_entry_id);

CREATE INDEX IF NOT EXISTS idx_coach_invites_used_by
  ON public.coach_invites (used_by);

CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_id
  ON public.coach_notes (athlete_id);
