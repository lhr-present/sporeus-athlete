-- 20260621_acquisition_by_source_rpc.sql — Growth analytics: acquisition by source
--
-- Segments the activation funnel by first-touch utm_source (signups · first-session ·
-- first-week · activation% · avg days-to-first, per source). Complements
-- get_funnel_cohort_summary (which is by-day). Source = profiles.first_touch->>'utm_source'
-- (jsonb, stamped once by the attribution-log edge fn); NULL/'' → 'direct'.
--
-- Admin-gated (profiles.role='admin') so the client ObservabilityDashboard can call it,
-- with service_role allowed (auth.uid() IS NULL) for edge/ops — mirrors
-- get_recent_client_errors. No new PII (utm_source is non-personal). Read-only.

create or replace function public.get_acquisition_by_source(p_start date, p_end date)
returns table (
  source            text,
  signed_up         bigint,
  first_session     bigint,
  first_week        bigint,
  activation_rate   numeric,
  avg_days_to_first numeric
)
language plpgsql security definer set search_path = 'public' stable
as $function$
begin
  if auth.uid() is not null
     and coalesce((select role::text from public.profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'Admin role required to read acquisition analytics' using errcode = '42501';
  end if;

  return query
  with cohort as (
    select pr.id as user_id,
           pr.created_at::date as signup_day,
           coalesce(nullif(pr.first_touch->>'utm_source', ''), 'direct') as source
    from   public.profiles pr
    where  pr.created_at::date >= p_start and pr.created_at::date <= p_end
  ),
  first_logs as (
    select tl.user_id, min(tl.created_at) as first_entry_at
    from   public.training_log tl
    where  tl.created_at >= p_start::timestamp
      and  tl.created_at <  (p_end::timestamp + interval '38 days')
    group  by tl.user_id
  ),
  m as (
    select c.source, c.user_id,
      (fl.first_entry_at is not null)::int as had_session,
      (fl.first_entry_at is not null
        and (fl.first_entry_at::date - c.signup_day) between 0 and 7)::int as had_first_week,
      case when fl.first_entry_at is not null and fl.first_entry_at::date >= c.signup_day
           then (fl.first_entry_at::date - c.signup_day) end as days_to_first
    from cohort c
    left join first_logs fl on fl.user_id = c.user_id
  )
  select
    m.source,
    count(distinct m.user_id)::bigint,
    sum(m.had_session)::bigint,
    sum(m.had_first_week)::bigint,
    case when count(distinct m.user_id) > 0
         then round(sum(m.had_session)::numeric / count(distinct m.user_id) * 100, 2) end,
    case when count(m.days_to_first) > 0 then round(avg(m.days_to_first)::numeric, 1) end
  from m
  group by m.source
  order by count(distinct m.user_id) desc;
end;
$function$;

revoke execute on function public.get_acquisition_by_source(date, date) from public, anon;
grant  execute on function public.get_acquisition_by_source(date, date) to authenticated, service_role;
