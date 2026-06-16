-- 20260631_increment_invite_use.sql
-- Atomic single-use enforcement for coach invites (TOCTOU fix, LOW de-risk).
--
-- redeem-invite previously did a read-modify-write on uses_count:
--   SELECT ... uses_count   (validate uses_count < max_uses)
--   ... link athlete ...
--   UPDATE ... SET uses_count = uses_count + 1
-- Two concurrent redemptions of a single-use invite both pass the cap check
-- (both read uses_count = 0) and both increment to 1 → the cap is bypassed.
--
-- Fix: a SECURITY DEFINER function that increments AND enforces max_uses in the
-- SAME conditional UPDATE statement. Postgres takes a row lock for the UPDATE,
-- so concurrent callers serialize: the first wins the row (uses_count 0→1) and
-- gets a returned id; the second sees uses_count >= max_uses in its WHERE clause,
-- updates 0 rows, and returns no row → redeem-invite treats that as MAX_USES_REACHED.
--
-- Returns the invite id when it incremented, NULL row otherwise.
-- Called only by the redeem-invite edge function (service role); also locked down
-- from anon/authenticated direct RPC so it can't be used to brute-force-decrement
-- another coach's invites.
--
-- Columns verified against live schema (see 20260625 preview RPC header):
--   coach_invites(id, coach_id, code, created_at, expires_at, used_by, label,
--                 max_uses, uses_count, revoked_at)

create or replace function public.increment_invite_use(p_code text)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.coach_invites
     set uses_count = coalesce(uses_count, 0) + 1
   where code = upper(btrim(p_code))
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     and (max_uses is null or coalesce(uses_count, 0) < max_uses)
  returning id;
$$;

-- Service-role only. NOTE: service_role bypasses RLS, NOT function EXECUTE grants —
-- so we must explicitly GRANT to service_role after revoking the default PUBLIC grant,
-- or the redeem-invite edge fn (service key) gets "permission denied".
revoke all     on function public.increment_invite_use(text) from public, anon, authenticated;
grant  execute on function public.increment_invite_use(text) to service_role;
