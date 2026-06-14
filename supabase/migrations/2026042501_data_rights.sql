-- 20260425_data_rights.sql — KVKK/GDPR: unified data rights table + SQL functions
--
-- Creates:
--   data_rights_requests — canonical unified export + deletion request log
--   build_user_export()  — SECURITY DEFINER, returns full user jsonb for portability
--   purge_user()         — SECURITY DEFINER, cascade-safe deletion in dependency order
--   user-exports storage bucket (private, signed-URL access)
--   purge-deleted-accounts pg_cron job (daily 04:00 UTC)
--
-- NOTE: The earlier export_jobs / deletion_requests tables (20260458) are kept
-- for backward compatibility. New edge functions use data_rights_requests only.

-- ── data_rights_requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_rights_requests (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind               TEXT        NOT NULL CHECK (kind IN ('export', 'deletion')),
  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_purge_at TIMESTAMPTZ,   -- deletion: now() + 30 days; null for export
  completed_at       TIMESTAMPTZ,
  export_url         TEXT,          -- 7-day signed URL once export ready
  export_expires_at  TIMESTAMPTZ,
  notes              TEXT
);

CREATE INDEX IF NOT EXISTS idx_drr_user
  ON public.data_rights_requests(user_id, kind, requested_at DESC);

-- At most one active deletion per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_drr_one_pending_deletion
  ON public.data_rights_requests(user_id)
  WHERE kind = 'deletion' AND status IN ('pending', 'processing');

ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drr: user insert own"
  ON public.data_rights_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drr: user select own"
  ON public.data_rights_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can cancel their own pending deletion only (service_role can update freely)
CREATE POLICY "drr: user cancel deletion"
  ON public.data_rights_requests FOR UPDATE
  USING (
    auth.uid() = user_id
    AND kind = 'deletion'
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'canceled'
  );

-- ── Allow coach_sessions.coach_id to be NULL for graceful purge ───────────────
-- When a coach account is purged, sessions are archived (coach_id → NULL) rather
-- than cascade-deleted, so athlete attendance history is preserved.
ALTER TABLE public.coach_sessions ALTER COLUMN coach_id DROP NOT NULL;

-- ── build_user_export(p_user_id) ──────────────────────────────────────────────
-- Returns one JSONB with all user-owned data across every user-scoped table.
-- Tables are enumerated explicitly — do NOT use information_schema (misses
-- privilege-bound data and silently drops new tables until someone updates this).
--
-- Exclusions for safety:
--   athlete_devices.token_enc  — encrypted server-side, not meaningful to user
--   insight_embeddings.embedding — 1536 floats, not human-readable
CREATE OR REPLACE FUNCTION public.build_user_export(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT
    jsonb_build_object(
      '_meta',            jsonb_build_object(
        'exported_at', now(),
        'user_id',     p_user_id,
        'format',      'sporeus-export-v2',
        'note',        'athlete_devices.token_enc and insight_embeddings.embedding excluded'
      ),
      'profiles',         COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.profiles WHERE id = p_user_id) t), '[]'),
      'training_log',     COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.training_log WHERE user_id = p_user_id) t), '[]'),
      'test_results',     COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.test_results WHERE user_id = p_user_id) t), '[]'),
      'injuries',         COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.injuries WHERE user_id = p_user_id) t), '[]'),
      'goals',            COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.goals WHERE user_id = p_user_id) t), '[]'),
      'athlete_goals',    COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.athlete_goals WHERE user_id = p_user_id) t), '[]'),
      'personal_records', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.personal_records WHERE user_id = p_user_id) t), '[]'),
      'coach_plans',      COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.coach_plans WHERE user_id = p_user_id) t), '[]'),
      'coach_athletes',   COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.coach_athletes WHERE user_id = p_user_id) t), '[]'),
      'coach_messages',   COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.coach_messages WHERE user_id = p_user_id) t), '[]'),
      'coach_sessions',   COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.coach_sessions WHERE coach_id = p_user_id) t), '[]'),
      'session_attendance', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.session_attendance WHERE athlete_id = p_user_id) t), '[]'),
      'session_comments', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.session_comments WHERE author_id = p_user_id) t), '[]'),
      'ai_insights',      COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.ai_insights WHERE user_id = p_user_id) t), '[]'),
      'consents',         COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.consents WHERE user_id = p_user_id) t), '[]'),
      'consent_purposes', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.consent_purposes WHERE user_id = p_user_id) t), '[]'),
      'attribution_events', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.attribution_events WHERE user_id = p_user_id) t), '[]'),
      'client_events',    COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.client_events WHERE user_id = p_user_id) t), '[]'),
      'subscription_events', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.subscription_events WHERE user_id = p_user_id) t), '[]'),
      'data_rights_requests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT * FROM public.data_rights_requests WHERE user_id = p_user_id) t), '[]'),
      -- athlete_devices: exclude token_enc (encrypted blob, not useful to user)
      'athlete_devices',  COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT id, user_id, provider, label, base_url, last_sync_at, created_at
                            FROM public.athlete_devices WHERE user_id = p_user_id) t), '[]'),
      -- insight_embeddings: metadata only, no 1536-float vector column
      'insight_embeddings', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
                            SELECT insight_id, user_id, content_hash, created_at
                            FROM public.insight_embeddings WHERE user_id = p_user_id) t), '[]')
    )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_user_export(UUID) TO service_role;

-- ── purge_user(p_user_id) ─────────────────────────────────────────────────────
-- Cascade-safe deletion. Returns jsonb { ok, user_id, purged_at } or
-- { ok: false, error }.
--
-- coach_sessions choice: when a coach purges, we NULL-out coach_id and append a
-- note rather than deleting the row. This preserves session attendance history for
-- athletes who were enrolled. Athletes can still see their attendance records; the
-- coach name is anonymized. (Deleting would wipe athlete history they cannot recover.)
--
-- session_comments: soft-delete only (body → '[deleted]', deleted_at = now()).
-- Thread continuity is preserved; content is erased.
--
-- audit_log rows are intentionally kept — they are legal-traceability records with
-- no content (just timestamps and action types). They survive auth.users deletion
-- because audit_log.user_id is not a hard FK.
--
-- Does NOT call auth.admin.deleteUser — the edge function does this after this
-- function returns successfully.
CREATE OR REPLACE FUNCTION public.purge_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  purge_ts TIMESTAMPTZ := now();
BEGIN
  -- 1. Archive coach sessions (null coach_id, preserve athlete attendance)
  UPDATE public.coach_sessions
    SET coach_id = NULL,
        notes    = COALESCE(notes || chr(10), '') || '[Coach account purged ' || purge_ts::text || ']'
    WHERE coach_id = p_user_id;

  -- 2. Remove this user's attendance entries as an athlete
  DELETE FROM public.session_attendance WHERE athlete_id = p_user_id;

  -- 3. Soft-delete comments (erase content, preserve thread structure)
  UPDATE public.session_comments
    SET body = '[deleted]', deleted_at = purge_ts
    WHERE author_id = p_user_id AND deleted_at IS NULL;

  -- 4. Application tables in FK-dependency order
  DELETE FROM public.ai_feedback            WHERE user_id = p_user_id;
  DELETE FROM public.ai_insights            WHERE user_id = p_user_id;
  DELETE FROM public.insight_embeddings     WHERE user_id = p_user_id;
  DELETE FROM public.client_events          WHERE user_id = p_user_id;
  DELETE FROM public.attribution_events     WHERE user_id = p_user_id;
  DELETE FROM public.personal_records       WHERE user_id = p_user_id;
  DELETE FROM public.athlete_goals          WHERE user_id = p_user_id;
  DELETE FROM public.athlete_devices        WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions     WHERE user_id = p_user_id;
  DELETE FROM public.coach_messages         WHERE user_id = p_user_id;
  DELETE FROM public.coach_athletes         WHERE user_id = p_user_id;
  DELETE FROM public.coach_plans            WHERE user_id = p_user_id;
  DELETE FROM public.test_results           WHERE user_id = p_user_id;
  DELETE FROM public.injuries               WHERE user_id = p_user_id;
  DELETE FROM public.goals                  WHERE user_id = p_user_id;
  DELETE FROM public.training_log           WHERE user_id = p_user_id;
  DELETE FROM public.subscription_events    WHERE user_id = p_user_id;
  DELETE FROM public.consent_purposes       WHERE user_id = p_user_id;
  DELETE FROM public.consents               WHERE user_id = p_user_id;
  DELETE FROM public.export_jobs            WHERE user_id = p_user_id;
  DELETE FROM public.deletion_requests      WHERE user_id = p_user_id;
  DELETE FROM public.data_rights_requests   WHERE user_id = p_user_id;
  DELETE FROM public.profiles               WHERE id      = p_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'purged_at', purge_ts);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'user_id', p_user_id, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_user(UUID) TO service_role;

-- ── user-exports storage bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-exports',
  'user-exports',
  false,
  52428800,  -- 50 MB
  ARRAY['application/json', 'text/csv', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- Service role uploads; users access via 7-day signed URLs (no direct RLS needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'user-exports: service write'
  ) THEN
    CREATE POLICY "user-exports: service write"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'user-exports');
  END IF;
END $$;

-- ── pg_cron: purge-deleted-accounts daily at 04:00 UTC ───────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-accounts') THEN
    PERFORM cron.unschedule('purge-deleted-accounts');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-deleted-accounts',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/purge-deleted-accounts',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
