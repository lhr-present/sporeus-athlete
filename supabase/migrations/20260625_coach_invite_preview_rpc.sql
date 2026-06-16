-- 20260625_coach_invite_preview_rpc.sql
-- Close the coach_invites enumeration leak (deep-dive 2026-06-16).
--
-- The SELECT policy's athlete branch `(used_by IS NULL AND expires_at > now())`
-- let ANY authenticated user `select code from coach_invites` and enumerate every
-- unused invite code, then redeem into a coach's roster they were never invited to.
--
-- Fix: replace the athlete-side direct table read with a SECURITY DEFINER preview
-- RPC keyed by a code the caller ALREADY HOLDS (no enumeration — a wrong code just
-- returns valid=false), and restrict the SELECT policy to the owning coach.
-- Redemption itself already runs server-side in the redeem-invite edge function
-- (service role). Verified live 2026-06-16: table empty (0 rows); the UPDATE policy
-- was already coach-only, so the old athlete-side used_by write was a silent no-op.
-- Columns verified: id, coach_id, code, created_at, expires_at, used_by, label,
-- max_uses, uses_count, revoked_at.

create or replace function public.preview_coach_invite(p_code text)
returns table (valid boolean, reason text, coach_id uuid, coach_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.coach_invites%rowtype;
  v_name   text;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select false, 'MISSING_CODE', null::uuid, null::text; return;
  end if;

  select * into v_invite from public.coach_invites where code = upper(btrim(p_code));

  if not found then
    return query select false, 'INVALID_CODE', null::uuid, null::text; return;
  end if;
  if v_invite.revoked_at is not null then
    return query select false, 'REVOKED', null::uuid, null::text; return;
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return query select false, 'EXPIRED', null::uuid, null::text; return;
  end if;
  if v_invite.max_uses is not null and coalesce(v_invite.uses_count, 0) >= v_invite.max_uses then
    return query select false, 'MAX_USES_REACHED', null::uuid, null::text; return;
  end if;
  -- auth.uid() resolves from the request JWT even inside a SECURITY DEFINER fn.
  if v_invite.coach_id = auth.uid() then
    return query select false, 'SELF_INVITE', null::uuid, null::text; return;
  end if;

  -- Return only the coach's display name (fall back to 'Coach' — never leak email).
  select coalesce(display_name, 'Coach') into v_name from public.profiles where id = v_invite.coach_id;

  return query select true, 'OK', v_invite.coach_id, coalesce(v_name, 'Coach');
end;
$$;

revoke all     on function public.preview_coach_invite(text) from public, anon;
grant  execute on function public.preview_coach_invite(text) to authenticated;

-- Restrict SELECT to the owning coach — remove the athlete enumeration branch.
drop policy if exists "coach_invites: select" on public.coach_invites;
create policy "coach_invites: select"
  on public.coach_invites for select
  using ((select auth.uid()) = coach_id);
