-- 20260628_squad_overview_load_signals.sql — surface load-trend signals to the coach squad row
--
-- WHY: src/components/coach/AthleteRow.jsx feeds getAthleteInsights() (src/lib/ruleInsights.js)
-- only {acwr, wellnessAvg}, so the load-trend / monotony / missed-rest rules — which require a
-- 7-day daily-TSS array and a consecutive-training-day count — could never fire under real squad
-- data (they only lit up for the demo squad, which carries an internal _log). Coaches do NOT hold
-- each athlete's per-session training_log on the client (privacy + scale boundary), so the client
-- cannot derive these. This migration returns the two aggregates the RPC already has from its
-- existing per-day TSS loop, so the client can wire them with no extra access.
--
-- BASE: this is CREATE OR REPLACE'd from the LATEST live definition (20260618_tier0_held_item_guards.sql),
-- NOT the original 2026041305 — it preserves every security hardening from that pass:
--   * SET search_path TO ''  (+ all tables schema-qualified as public.*)
--   * auth.uid() coach guard  (authenticated caller may only read their own squad)
--   * service_role pass-through (public-api edge fn calls with NULL uid)
--   * REVOKE EXECUTE FROM public, anon; GRANT to authenticated, service_role
-- No security surface changes here — we add only DERIVED daily-TSS aggregates (7 numeric values +
-- one integer count) per athlete, all from the same coach-scoped training_log the RPC already reads.
--
-- Adds two columns to the RETURNS TABLE:
--   loads7days                numeric[] — last 7 days' daily TSS, oldest→newest (index 0 = 6d ago,
--                                         index 6 = today). Drives getLoadTrendAlert + getMonotonyWarning.
--   consecutive_training_days integer   — trailing run of consecutive days (ending today or the most
--                                         recent training day) that have ≥1 logged session. Drives
--                                         getMissedRestWarning.
--
-- Verified against the live schema AND the live function body (matches the 20260618 definition
-- exactly except for the two added fields). DROP first: adding columns to a RETURNS TABLE changes
-- the return type, which CREATE OR REPLACE rejects. No hard dependents (squad-sync edge fn calls it
-- by name at runtime); grants re-asserted below. Idempotent via DROP IF EXISTS.

drop function if exists public.get_squad_overview(uuid);

create function public.get_squad_overview(p_coach_id uuid)
returns table(athlete_id uuid, display_name text, today_ctl numeric, today_atl numeric,
              today_tsb numeric, acwr_ratio numeric, acwr_status text, last_hrv_score numeric,
              last_session_date date, missed_sessions_7d integer, training_status text, adherence_pct numeric,
              loads7days numeric[], consecutive_training_days integer)
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
  _from7    date := current_date - 6;   -- start of the trailing 7-day window
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

    -- Last 7 days' daily TSS (oldest→newest). Generated from a 7-day series so missing days
    -- are 0 (rest days), giving getMonotonyWarning / getLoadTrendAlert a fixed-length 7-element
    -- array regardless of how many sessions were logged.
    select array(
      select coalesce(sum(tl.tss), 0)::numeric
      from   generate_series(_from7, current_date, '1 day'::interval) g(d)
      left join public.training_log tl
             on tl.user_id = _ath.athlete_id and tl.date = g.d::date
      group  by g.d
      order  by g.d
    ) into loads7days;

    -- Consecutive training days: trailing run of days (scanning back up to 60 days from today)
    -- that each have ≥1 logged session, stopping at the first rest day. A day is part of the
    -- trailing streak iff no rest day occurs on or after it (breaks_at_or_after = 0). NULL log → 0.
    select coalesce((
      select count(*)::integer
      from (
        select g.day::date as day,
               (exists (
                 select 1 from public.training_log tl
                 where tl.user_id = _ath.athlete_id and tl.date = g.day::date
               ))::int as trained,
               sum(case when exists (
                     select 1 from public.training_log tl
                     where tl.user_id = _ath.athlete_id and tl.date = g.day::date
                   ) then 0 else 1 end)
                 over (order by g.day desc) as breaks_at_or_after
        from generate_series(current_date - 59, current_date, '1 day'::interval) g(day)
      ) scan
      where scan.trained = 1 and scan.breaks_at_or_after = 0
    ), 0)
    into consecutive_training_days;

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
