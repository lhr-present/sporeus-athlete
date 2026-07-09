-- 20260645_admin_rpc_guards.sql — server-side admin gate on founder RPCs (v9.496)
--
-- Publish-readiness F12. Server reality found on inspection:
--   • generate_api_key — NO role check: any authenticated user could mint
--     themselves a 'club'-tier API key (entitlement bypass).
--   • get_recent_client_errors / get_acquisition_by_source — HAD admin guards,
--     but written as `if auth.uid() is not null and role <> 'admin'`: the
--     ANON path (uid IS NULL) bypassed the guard entirely, while the founder
--     (role='athlete') was REJECTED. Exactly backwards.
-- Fix: a dedicated admin_users allowlist (no risky role flip on the founder's
-- profile), an is_admin() helper that rejects null uid, and corrected guards.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- no policies: service_role/DEFINER access only

INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'huseyinakbulut71@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
          OR coalesce((SELECT p.role = 'admin' FROM public.profiles p WHERE p.id = auth.uid()), false))
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 1. generate_api_key: admin-only (was: any authenticated self-mint)
CREATE OR REPLACE FUNCTION public.generate_api_key(p_label text, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare v_key text;
begin
  if not public.is_admin() then
    raise exception 'Insufficient permissions: admin only' using errcode = '42501';
  end if;
  if p_org_id is distinct from auth.uid() then
    raise exception 'Insufficient permissions: cannot mint an API key for another org' using errcode = '42501';
  end if;
  v_key := 'sk-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.api_keys (api_key, org_id, label, tier, created_at)
  values (v_key, p_org_id, p_label, 'club', now());
  return v_key;
end;
$function$;

-- 2+3. Corrected guards on the telemetry reads (null-bypass fixed)
CREATE OR REPLACE FUNCTION public.get_recent_client_errors(p_limit integer DEFAULT 5)
 RETURNS TABLE(category text, action text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Admin role required to read error telemetry' using errcode = '42501';
  end if;
  return query
    select ce.category, ce.action, count(*) as count
    from public.client_events ce
    where ce.event_type = 'error' and ce.created_at >= now() - interval '24 hours'
    group by ce.category, ce.action order by count desc limit p_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_acquisition_by_source(p_start date, p_end date)
 RETURNS TABLE(source text, signed_up bigint, first_session bigint, first_week bigint, activation_rate numeric, avg_days_to_first numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Admin role required to read acquisition analytics' using errcode = '42501';
  end if;
  return query
  with cohort as (
    select pr.id as user_id, pr.created_at::date as signup_day,
           coalesce(nullif(pr.first_touch->>'utm_source', ''), 'direct') as source
    from public.profiles pr
    where pr.created_at::date >= p_start and pr.created_at::date <= p_end
  ),
  first_logs as (
    select tl.user_id, min(tl.created_at) as first_entry_at
    from public.training_log tl
    where tl.created_at >= p_start::timestamp and tl.created_at < (p_end::timestamp + interval '38 days')
    group by tl.user_id
  ),
  m as (
    select c.source, c.user_id,
      (fl.first_entry_at is not null)::int as had_session,
      (fl.first_entry_at is not null and (fl.first_entry_at::date - c.signup_day) between 0 and 7)::int as had_first_week,
      case when fl.first_entry_at is not null and fl.first_entry_at::date >= c.signup_day
           then (fl.first_entry_at::date - c.signup_day) end as days_to_first
    from cohort c left join first_logs fl on fl.user_id = c.user_id
  )
  select m.source, count(distinct m.user_id)::bigint, sum(m.had_session)::bigint, sum(m.had_first_week)::bigint,
    case when count(distinct m.user_id) > 0 then round(sum(m.had_session)::numeric / count(distinct m.user_id) * 100, 2) end,
    case when count(m.days_to_first) > 0 then round(avg(m.days_to_first)::numeric, 1) end
  from m group by m.source order by count(distinct m.user_id) desc;
end;
$function$;

