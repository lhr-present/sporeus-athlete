-- 20260531_fix_data_rights_functions.sql — C1 (CRITICAL, KVKK/GDPR)
--
-- Corrective rewrite of build_user_export() and purge_user() from
-- 20260425_data_rights.sql. The originals referenced:
--   • a table that no migration creates: `goals`
--   • a table that was DROPPED in 20260481: `coach_messages`
--   • wrong user-scoping columns:
--       ai_insights      → real col is `athlete_id` (not user_id)
--       client_events    → real col is `user_id_hash` = substr(sha256(uid),1,16)
--                          (not a raw `user_id` UUID)
--       coach_athletes   → real cols are `coach_id` / `athlete_id` (no user_id)
--
-- Result of the originals: the FIRST bad statement aborts the whole txn
-- (purge_user EXCEPTION → ok:false), so the purge cron marks every deletion
-- request `failed` and NEVER calls auth.admin.deleteUser → zero data purged.
-- Export threw identically.
--
-- This migration is idempotent (CREATE OR REPLACE) and guards EVERY table
-- reference with to_regclass(...) so it can never throw on an optional table
-- that is absent in a given environment (e.g. branch DBs out of sync).
--
-- Verified real column names against the source migrations this session:
--   athlete_goals.user_id, personal_records.user_id, subscription_events.user_id
--   (all exist & are correct — keep), ai_insights.athlete_id, client_events.user_id_hash,
--   coach_athletes.coach_id/athlete_id, coach_sessions.coach_id,
--   session_attendance.athlete_id, session_comments.author_id,
--   consents.user_id, consent_purposes.user_id, attribution_events.user_id,
--   ai_feedback.user_id, athlete_devices.user_id, insight_embeddings.insight_id/user_id.
--
-- pgcrypto is required for digest() (used to match client_events.user_id_hash).
-- Already enabled by 001_initial_schema; this is defensive + idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── build_user_export(p_user_id) ──────────────────────────────────────────────
-- Builds the export object section-by-section using dynamic SQL so that any
-- missing optional table is silently skipped instead of aborting the export.
CREATE OR REPLACE FUNCTION public.build_user_export(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result   JSONB := '{}'::jsonb;
  v_hash   TEXT;
  v_section JSONB;
BEGIN
  -- Resolve pgcrypto's digest() regardless of its install schema (public on
  -- self-hosted, extensions on Supabase) since search_path is locked to ''.
  EXECUTE format(
    'SELECT substr(encode(%s.digest($1::text, ''sha256''), ''hex''), 1, 16)',
    (SELECT n.nspname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'digest' LIMIT 1)
  ) INTO v_hash USING p_user_id;
  result := jsonb_build_object(
    '_meta', jsonb_build_object(
      'exported_at', now(),
      'user_id',     p_user_id,
      'format',      'sporeus-export-v3',
      'note',        'athlete_devices.token_enc and embedding vectors excluded; missing optional tables omitted'
    )
  );

  -- Each block: only runs if the table exists. agg null → '[]'.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.profiles WHERE id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('profiles', v_section);
  END IF;

  IF to_regclass('public.training_log') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.training_log WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('training_log', v_section);
  END IF;

  IF to_regclass('public.recovery') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.recovery WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('recovery', v_section);
  END IF;

  IF to_regclass('public.test_results') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.test_results WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('test_results', v_section);
  END IF;

  IF to_regclass('public.race_results') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.race_results WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('race_results', v_section);
  END IF;

  IF to_regclass('public.injuries') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.injuries WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('injuries', v_section);
  END IF;

  IF to_regclass('public.athlete_goals') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.athlete_goals WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('athlete_goals', v_section);
  END IF;

  IF to_regclass('public.personal_records') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.personal_records WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('personal_records', v_section);
  END IF;

  -- coach_plans is scoped by coach_id / athlete_id (no user_id column)
  IF to_regclass('public.coach_plans') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.coach_plans WHERE coach_id = $1 OR athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('coach_plans', v_section);
  END IF;

  -- coach_athletes: user appears as either coach or athlete
  IF to_regclass('public.coach_athletes') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.coach_athletes WHERE coach_id = $1 OR athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('coach_athletes', v_section);
  END IF;

  -- messages (current coach<->athlete messaging table; replaced dropped coach_messages)
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.messages WHERE coach_id = $1 OR athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('messages', v_section);
  END IF;

  IF to_regclass('public.coach_sessions') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.coach_sessions WHERE coach_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('coach_sessions', v_section);
  END IF;

  IF to_regclass('public.session_attendance') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.session_attendance WHERE athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('session_attendance', v_section);
  END IF;

  IF to_regclass('public.session_comments') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.session_comments WHERE author_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('session_comments', v_section);
  END IF;

  -- ai_insights: user-scoping column is athlete_id (NOT user_id)
  IF to_regclass('public.ai_insights') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.ai_insights WHERE athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('ai_insights', v_section);
  END IF;

  IF to_regclass('public.ai_feedback') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.ai_feedback WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('ai_feedback', v_section);
  END IF;

  IF to_regclass('public.consents') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.consents WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('consents', v_section);
  END IF;

  IF to_regclass('public.consent_purposes') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.consent_purposes WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('consent_purposes', v_section);
  END IF;

  IF to_regclass('public.attribution_events') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.attribution_events WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('attribution_events', v_section);
  END IF;

  -- client_events: scoping column is user_id_hash = substr(sha256(uid),1,16)
  IF to_regclass('public.client_events') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.client_events WHERE user_id_hash = $1) t'
      INTO v_section USING v_hash;
    result := result || jsonb_build_object('client_events', v_section);
  END IF;

  IF to_regclass('public.subscription_events') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.subscription_events WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('subscription_events', v_section);
  END IF;

  IF to_regclass('public.data_rights_requests') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.data_rights_requests WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('data_rights_requests', v_section);
  END IF;

  -- athlete_devices: exclude encrypted token_enc blob
  IF to_regclass('public.athlete_devices') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT id, user_id, provider, label, base_url, last_sync_at, created_at FROM public.athlete_devices WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('athlete_devices', v_section);
  END IF;

  -- insight_embeddings: metadata only (no embedding vector)
  IF to_regclass('public.insight_embeddings') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT insight_id, user_id, content_hash, created_at FROM public.insight_embeddings WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('insight_embeddings', v_section);
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_user_export(UUID) TO service_role;

-- ── purge_user(p_user_id) ─────────────────────────────────────────────────────
-- Cascade-safe deletion using guarded dynamic SQL so a single missing/altered
-- table never aborts the whole purge. Mirrors the original's intent:
--   • coach_sessions → archive (NULL coach_id, append note), keep attendance history
--   • session_comments → soft-delete (body '[deleted]', deleted_at = now)
--   • everything else → hard delete in FK-dependency order
-- Does NOT call auth.admin.deleteUser (edge fn does that after ok:true).
CREATE OR REPLACE FUNCTION public.purge_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  purge_ts TIMESTAMPTZ := now();
  v_hash   TEXT;
BEGIN
  -- Resolve pgcrypto's digest() schema (see build_user_export rationale).
  EXECUTE format(
    'SELECT substr(encode(%s.digest($1::text, ''sha256''), ''hex''), 1, 16)',
    (SELECT n.nspname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'digest' LIMIT 1)
  ) INTO v_hash USING p_user_id;

  -- 1. Archive coach sessions (null coach_id, preserve athlete attendance)
  IF to_regclass('public.coach_sessions') IS NOT NULL THEN
    EXECUTE 'UPDATE public.coach_sessions
               SET coach_id = NULL,
                   notes = COALESCE(notes || chr(10), '''') || ''[Coach account purged '' || $2::text || '']''
             WHERE coach_id = $1'
      USING p_user_id, purge_ts;
  END IF;

  -- 2. Soft-delete comments (erase content, preserve thread structure)
  IF to_regclass('public.session_comments') IS NOT NULL THEN
    EXECUTE 'UPDATE public.session_comments
               SET body = ''[deleted]'', deleted_at = $2
             WHERE author_id = $1 AND deleted_at IS NULL'
      USING p_user_id, purge_ts;
  END IF;

  -- 3. Remove this user's attendance entries as an athlete
  IF to_regclass('public.session_attendance') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.session_attendance WHERE athlete_id = $1' USING p_user_id;
  END IF;

  -- 4. Application tables in FK-dependency order (each guarded + correct column)
  IF to_regclass('public.ai_feedback')        IS NOT NULL THEN EXECUTE 'DELETE FROM public.ai_feedback        WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.insight_embeddings') IS NOT NULL THEN EXECUTE 'DELETE FROM public.insight_embeddings WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.ai_insights')        IS NOT NULL THEN EXECUTE 'DELETE FROM public.ai_insights        WHERE athlete_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.client_events')      IS NOT NULL THEN EXECUTE 'DELETE FROM public.client_events      WHERE user_id_hash = $1' USING v_hash; END IF;
  IF to_regclass('public.attribution_events') IS NOT NULL THEN EXECUTE 'DELETE FROM public.attribution_events WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.personal_records')   IS NOT NULL THEN EXECUTE 'DELETE FROM public.personal_records   WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.athlete_goals')      IS NOT NULL THEN EXECUTE 'DELETE FROM public.athlete_goals      WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.athlete_devices')    IS NOT NULL THEN EXECUTE 'DELETE FROM public.athlete_devices    WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN EXECUTE 'DELETE FROM public.push_subscriptions WHERE user_id    = $1' USING p_user_id; END IF;
  -- messages (replaces dropped coach_messages): user is coach or athlete
  IF to_regclass('public.messages')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.messages           WHERE coach_id = $1 OR athlete_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.coach_athletes')     IS NOT NULL THEN EXECUTE 'DELETE FROM public.coach_athletes     WHERE coach_id = $1 OR athlete_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.coach_plans')        IS NOT NULL THEN EXECUTE 'DELETE FROM public.coach_plans        WHERE coach_id = $1 OR athlete_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.test_results')       IS NOT NULL THEN EXECUTE 'DELETE FROM public.test_results       WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.race_results')       IS NOT NULL THEN EXECUTE 'DELETE FROM public.race_results       WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.injuries')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.injuries           WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.recovery')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.recovery           WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.session_embeddings') IS NOT NULL THEN EXECUTE 'DELETE FROM public.session_embeddings WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.training_log')       IS NOT NULL THEN EXECUTE 'DELETE FROM public.training_log       WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.subscription_events') IS NOT NULL THEN EXECUTE 'DELETE FROM public.subscription_events WHERE user_id  = $1' USING p_user_id; END IF;
  IF to_regclass('public.consent_purposes')   IS NOT NULL THEN EXECUTE 'DELETE FROM public.consent_purposes   WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.consents')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.consents           WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.export_jobs')        IS NOT NULL THEN EXECUTE 'DELETE FROM public.export_jobs        WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.deletion_requests')  IS NOT NULL THEN EXECUTE 'DELETE FROM public.deletion_requests  WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.gdpr_erasure_log')   IS NOT NULL THEN EXECUTE 'DELETE FROM public.gdpr_erasure_log   WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.data_rights_requests') IS NOT NULL THEN EXECUTE 'DELETE FROM public.data_rights_requests WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.profiles')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.profiles           WHERE id         = $1' USING p_user_id; END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'purged_at', purge_ts);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'user_id', p_user_id, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_user(UUID) TO service_role;
