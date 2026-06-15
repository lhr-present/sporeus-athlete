-- 20260622_fix_admin_role_enum_cast.sql — corrective
--
-- profiles.role is enum user_role; `coalesce(role, '')` is an invalid enum cast that
-- throws "invalid input value for enum user_role: ''" the moment an authenticated user
-- triggers the admin guard. get_recent_client_errors (added v9.401, migration 20260618)
-- carried this latent bug. Cast role to text before the coalesce/compare.
-- (get_acquisition_by_source was fixed in 20260621 directly.)

create or replace function public.get_recent_client_errors(p_limit integer default 5)
returns table(category text, action text, count bigint)
language plpgsql stable security definer set search_path = 'public'
as $function$
begin
  if auth.uid() is not null
     and coalesce((select role::text from public.profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'Admin role required to read error telemetry' using errcode = '42501';
  end if;
  return query
    select ce.category, ce.action, count(*) as count
    from   public.client_events ce
    where  ce.event_type = 'error' and ce.created_at >= now() - interval '24 hours'
    group  by ce.category, ce.action
    order  by count desc
    limit  p_limit;
end;
$function$;
