-- Tier-0 security hardening (v9.400): lock down the SECURITY DEFINER RPC surface
-- + close cross-tenant view/MV exposure.
--
-- Context: get_advisors flagged ~87 SECURITY DEFINER functions EXECUTE-grantable by
-- anon/authenticated via /rest/v1/rpc/*, running as definer (RLS bypassed). A multi-agent
-- audit (2026-06-14) verified call sites: these functions are invoked only by edge
-- functions / pg_cron (via service_role) / triggers / the auth hook — ZERO genuine
-- client supabase.rpc() callers. Many were granted to PUBLIC, so we must REVOKE FROM
-- PUBLIC (not just anon/authenticated) and re-GRANT to service_role / supabase_auth_admin
-- so the internal callers keep working.
--
-- NOT touched here (need a code-level guard, tracked separately, NOT a blind revoke):
--   generate_api_key, get_squad_overview, get_recent_client_errors  (real client callers, unguarded)
--   referral_codes always-true UPDATE policy (client updates uses_count directly; needs a column-scoped policy)
-- Kept as-is (self-guarded / client-needed): get_my_tier, encrypt_device_token,
--   coach_verify_athlete, match_sessions_for_coach, enqueue_push_fanout (held, uncertain).

-- ── Group A: privileged / internal functions — full lockdown (anon+authenticated+PUBLIC) ──
-- service_role retains EXECUTE (edge functions + cron call these with the service key).
do $$
declare
  sig text;
  sigs text[] := array[
    'public.ack_ai_session_msg(bigint)',
    'public.delete_ai_batch_msg(bigint)',
    'public.delete_push_fanout_msg(bigint)',
    'public.delete_strava_backfill_msg(bigint)',
    'public.drain_ai_session_queue(integer, integer)',
    'public.read_ai_batch(integer, integer)',
    'public.read_push_fanout(integer, integer)',
    'public.read_strava_backfill(integer, integer)',
    'public.move_to_dlq(jsonb)',
    'public.enqueue_ai_batch(jsonb, integer)',
    'public.enqueue_strava_backfill(jsonb)',
    'public.embed_backfill_batch(integer)',
    'public.enqueue_session_analysis(text, date, text, numeric, numeric, numeric)',
    'public.apply_subscription_event(jsonb)',
    'public.apply_tier_change(uuid, text, text, text, text, integer, text, text, text, integer)',
    'public.tier_for_user(uuid)',
    'public.check_and_increment_ai_usage(uuid, integer, integer)',
    'public.increment_upload_count(uuid)',
    'public.reset_monthly_upload_count()',
    'public.build_user_export(uuid)',
    'public.purge_user(uuid)',
    'public.decrypt_device_token(bytea)',
    'public.get_queue_metrics()',
    'public.get_funnel_cohort_summary(date, date)',
    'public.maybe_refresh_squad_mv()',
    'public.refresh_mv_load()',
    'public.refresh_queue_metrics()',
    'public.increment_referral_uses(text)'
  ];
begin
  foreach sig in array sigs loop
    execute format('revoke execute on function %s from public, anon, authenticated;', sig);
    execute format('grant  execute on function %s to service_role;', sig);
  end loop;
end $$;

-- ── Group B: self-guarded read fns (auth.uid() inside) — strip anon+PUBLIC, keep authenticated ──
do $$
declare
  sig text;
  sigs text[] := array[
    'public.get_load_timeline(integer)',
    'public.get_squad_readiness()',
    'public.get_weekly_summary(integer)'
  ];
begin
  foreach sig in array sigs loop
    execute format('revoke execute on function %s from public, anon;', sig);
  end loop;
end $$;

-- ── Group C: trigger functions — never need RPC EXECUTE; fire in trigger (definer) context ──
revoke execute on function public.on_training_log_embed()        from public, anon, authenticated;
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.log_consent_change()           from public, anon, authenticated;
revoke execute on function public.referral_codes_freeze_identity() from public, anon, authenticated;

-- ── Group D: custom access-token auth hook — only the auth admin role may run it ──
revoke execute on function public.inject_tier_jwt_claim(jsonb) from public, anon, authenticated;
grant  execute on function public.inject_tier_jwt_claim(jsonb) to supabase_auth_admin, service_role;

-- ── View: ai_feedback_summary was SECURITY DEFINER (ran as owner, bypassing ai_feedback RLS) ──
-- security_invoker=true makes it honour the caller's RLS (ai_feedback has auth.uid()=user_id).
alter view public.ai_feedback_summary set (security_invoker = true);
revoke select on public.ai_feedback_summary from anon;

-- ── Materialized views: no RLS → any signed-in user could read every athlete's data ──
-- Not read directly by the client (access is via guarded SECURITY DEFINER fns).
revoke select on public.mv_ctl_atl_daily   from anon, authenticated;
revoke select on public.mv_squad_readiness from anon, authenticated;
