-- 20260633_build_user_export_completeness.sql
-- GDPR right-of-access completeness (deep-dive 2026-06-17): build_user_export omitted
-- several tables holding the data subject's own data. Verbatim live body + 7 column-safe
-- to_jsonb(*) sections appended before RETURN: training_plans, onboarding_state,
-- notification_log, generated_reports, billing_events, audit_log, and coach_notes ABOUT
-- the athlete (athlete_id). Columns verified against live schema.

CREATE OR REPLACE FUNCTION public.build_user_export(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- (GDPR right-of-access completeness, 2026-06-17) data subject's own data that was omitted
  IF to_regclass('public.training_plans') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.training_plans WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('training_plans', v_section);
  END IF;
  IF to_regclass('public.onboarding_state') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.onboarding_state WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('onboarding_state', v_section);
  END IF;
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.notification_log WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('notification_log', v_section);
  END IF;
  IF to_regclass('public.generated_reports') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.generated_reports WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('generated_reports', v_section);
  END IF;
  IF to_regclass('public.billing_events') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.billing_events WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('billing_events', v_section);
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.audit_log WHERE user_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('audit_log', v_section);
  END IF;
  IF to_regclass('public.coach_notes') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.coach_notes WHERE athlete_id = $1) t'
      INTO v_section USING p_user_id;
    result := result || jsonb_build_object('coach_notes_about_me', v_section);
  END IF;

  RETURN result;
END;
$function$;
