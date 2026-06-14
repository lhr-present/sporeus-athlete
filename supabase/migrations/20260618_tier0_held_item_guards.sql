-- Tier-0 security hardening, second pass (v9.401): add caller guards to the 4 held items
-- from the SECURITY DEFINER audit (could not be a blind revoke — they have real client callers).
--
-- Designed + adversarially verified by a multi-agent pass, then corrected against the LIVE DB:
--  * search_path='' is kept — auth.uid() is schema-qualified so it resolves fine (verified
--    against live get_my_tier / get_squad_readiness which already do exactly this).
--  * Guards allow auth.uid() IS NULL (service_role / public-api backend path) through, and
--    enforce caller==owner only for genuine authenticated (JWT) callers. anon is revoked.

-- ── 1. generate_api_key: only the org owner (auth.uid() == p_org_id) may mint a key ──
-- Client call site: src/components/admin/ObservabilityDashboard.jsx passes authProfile.id (= auth.uid()).
create or replace function public.generate_api_key(p_label text, p_org_id uuid)
returns text
language plpgsql security definer
set search_path to ''
as $function$
declare
  v_key text;
begin
  if p_org_id is distinct from auth.uid() then
    raise exception 'Insufficient permissions: cannot mint an API key for another org'
      using errcode = '42501';
  end if;
  v_key := 'sk-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.api_keys (api_key, org_id, label, tier, created_at)
  values (v_key, p_org_id, p_label, 'club', now());
  return v_key;
end;
$function$;
revoke execute on function public.generate_api_key(text, uuid) from public, anon;
grant  execute on function public.generate_api_key(text, uuid) to authenticated, service_role;

-- ── 2. get_squad_overview: a coach may read only their own squad ──
-- Allows service_role (public-api, auth.uid() IS NULL) through; enforces caller==coach for JWT callers.
create or replace function public.get_squad_overview(p_coach_id uuid)
returns table(athlete_id uuid, display_name text, today_ctl numeric, today_atl numeric,
              today_tsb numeric, acwr_ratio numeric, acwr_status text, last_hrv_score numeric,
              last_session_date date, missed_sessions_7d integer, training_status text, adherence_pct numeric)
language plpgsql security definer
set search_path to ''
as $function$
declare
  _ath      record;
  _day      record;
  _ctl      numeric;
  _atl      numeric;
  _ctl_7ago numeric;
  _tss7     numeric;
  _tss28    numeric;
  _cutoff   date := current_date - 179;
  _7ago     date := current_date - 7;
  k_ctl constant numeric := 1.0 - exp(-1.0/42);
  k_atl constant numeric := 1.0 - exp(-1.0/7);
begin
  -- guard: authenticated callers may only view their own squad; service_role (NULL uid) allowed
  if auth.uid() is not null and p_coach_id is distinct from auth.uid() then
    raise exception 'Unauthorized: can only view your own squad overview' using errcode = '42501';
  end if;

  for _ath in
    select ca.athlete_id,
           coalesce(p.display_name, p.email, 'Athlete') as dname
    from   public.coach_athletes ca
    join   public.profiles p on p.id = ca.athlete_id
    where  ca.coach_id = p_coach_id
      and  ca.status   = 'active'
  loop
    _ctl := 0; _atl := 0; _ctl_7ago := 0;

    for _day in (
      with ds as (
        select generate_series(_cutoff, current_date, '1 day'::interval)::date as d
      )
      select ds.d,
             coalesce(sum(tl.tss), 0) as daily_tss
      from   ds
      left join public.training_log tl
             on tl.user_id = _ath.athlete_id and tl.date = ds.d
      group  by ds.d
      order  by ds.d
    ) loop
      if _day.d = _7ago then _ctl_7ago := _ctl; end if;
      _ctl := _ctl * (1 - k_ctl) + _day.daily_tss * k_ctl;
      _atl := _atl * (1 - k_atl) + _day.daily_tss * k_atl;
    end loop;

    athlete_id   := _ath.athlete_id;
    display_name := _ath.dname;
    today_ctl    := round(_ctl::numeric, 1);
    today_atl    := round(_atl::numeric, 1);
    today_tsb    := round((_ctl - _atl)::numeric, 1);

    select coalesce(sum(tss), 0) into _tss7
    from   public.training_log
    where  user_id = _ath.athlete_id and date >= current_date - 6;

    select coalesce(sum(tss), 0) into _tss28
    from   public.training_log
    where  user_id = _ath.athlete_id and date >= current_date - 27;

    if _tss28 = 0 then
      acwr_ratio  := null;
      acwr_status := 'low';
    else
      acwr_ratio  := round((_tss7 / (_tss28 / 4.0))::numeric, 2);
      acwr_status := case
        when acwr_ratio > 1.5  then 'danger'
        when acwr_ratio > 1.3  then 'caution'
        when acwr_ratio >= 0.8 then 'optimal'
        else 'low'
      end;
    end if;

    select hrv into last_hrv_score
    from   public.recovery
    where  user_id = _ath.athlete_id and hrv is not null
    order  by date desc limit 1;

    select max(date) into last_session_date
    from   public.training_log
    where  user_id = _ath.athlete_id;

    missed_sessions_7d := 0;

    select least(100, round(count(*) / 7.0 * 100)::numeric)
    into   adherence_pct
    from   public.training_log
    where  user_id = _ath.athlete_id and date >= current_date - 6;

    training_status := case
      when _atl > _ctl + 20                            then 'Overreaching'
      when last_session_date is null
        or last_session_date < current_date - 4        then 'Detraining'
      when _ctl > _ctl_7ago + 3                         then 'Building'
      when (_ctl - _atl) > 15                           then 'Peaking'
      when _ctl < _ctl_7ago - 3                         then 'Recovering'
      else                                                  'Maintaining'
    end;

    return next;
  end loop;
end;
$function$;
revoke execute on function public.get_squad_overview(uuid) from public, anon;
grant  execute on function public.get_squad_overview(uuid) to authenticated, service_role;

-- ── 3. get_recent_client_errors: gate to admin (profiles.role='admin'); service_role allowed ──
-- Aggregate-only (no PII). Client admin dashboard calls as authenticated; keep that grant.
create or replace function public.get_recent_client_errors(p_limit integer default 5)
returns table(category text, action text, count bigint)
language plpgsql stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null
     and coalesce((select role from public.profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'Admin role required to read error telemetry' using errcode = '42501';
  end if;
  return query
    select ce.category, ce.action, count(*) as count
    from   public.client_events ce
    where  ce.event_type = 'error'
      and  ce.created_at >= now() - interval '24 hours'
    group  by ce.category, ce.action
    order  by count desc
    limit  p_limit;
end;
$function$;
revoke execute on function public.get_recent_client_errors(integer) from public, anon;
grant  execute on function public.get_recent_client_errors(integer) to authenticated, service_role;

-- ── 4. referral_codes: column-scoped UPDATE (redeemers may only touch uses_count) ──
-- Client writes: referral.js:49 .update({uses_count}); referral.js:78 upsert ignoreDuplicates
-- (ON CONFLICT DO NOTHING — never UPDATEs, so unaffected). The BEFORE UPDATE freeze trigger
-- stays as defense-in-depth. Column GRANT is the primary RBAC control.
revoke update on public.referral_codes from authenticated;
grant  update (uses_count) on public.referral_codes to authenticated;
