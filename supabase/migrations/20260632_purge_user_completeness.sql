-- 20260632_purge_user_completeness.sql
-- GDPR deletion-completeness fix (deep-dive 2026-06-17). purge_user is the verbatim
-- live body + 3 guarded statements injected BEFORE the profiles DELETE:
--  (HIGH) clear coach_invites.used_by (NO ACTION FK) so a redeemer's deletion can
--  complete; (MED) delete ai_proxy_usage orphan; (LOW) delete processed_webhooks row.

CREATE OR REPLACE FUNCTION public.purge_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- (GDPR fix) coach_invites.used_by -> profiles is NO ACTION; clear it or the
  -- profiles DELETE below RESTRICTs and the deletion request can NEVER complete.
  IF to_regclass('public.coach_invites')      IS NOT NULL THEN EXECUTE 'UPDATE public.coach_invites SET used_by = NULL WHERE used_by = $1' USING p_user_id; END IF;
  -- ai_proxy_usage has no FK on athlete_id -> orphaned per-day usage rows after delete.
  IF to_regclass('public.ai_proxy_usage')     IS NOT NULL THEN EXECUTE 'DELETE FROM public.ai_proxy_usage     WHERE athlete_id = $1' USING p_user_id; END IF;
  -- processed_webhooks.user_id is SET NULL (row + payload survive) -> purge this user's rows.
  IF to_regclass('public.processed_webhooks') IS NOT NULL THEN EXECUTE 'DELETE FROM public.processed_webhooks WHERE user_id    = $1' USING p_user_id; END IF;
  IF to_regclass('public.profiles')           IS NOT NULL THEN EXECUTE 'DELETE FROM public.profiles           WHERE id         = $1' USING p_user_id; END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'purged_at', purge_ts);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'user_id', p_user_id, 'error', SQLERRM);
END;
$function$;
