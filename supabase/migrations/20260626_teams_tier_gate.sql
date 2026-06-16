-- 20260626_teams_tier_gate.sql
-- Deep-dive round 2 (2026-06-16): multi_team is a Coach/Club paid feature but the
-- `teams` RLS policy `teams_owner_all` only checked ownership (org_id = auth.uid()),
-- with no tier predicate. A free/downgraded coach could POST /rest/v1/teams directly
-- (bypassing the client gate in CoachSquadView) and create unlimited teams — the paid
-- multi-team capability was effectively free. Mirrors the v9.381 org_branding fix.
--
-- USING stays ownership-only so a downgraded coach can still READ/DELETE existing
-- teams; WITH CHECK adds the tier gate so only coach/club can CREATE/UPDATE.
-- get_my_tier() is SECURITY DEFINER + status-aware (cancelled/expired → free).

drop policy if exists "teams_owner_all" on public.teams;

create policy "teams_owner_all"
  on public.teams
  for all
  using ((select auth.uid()) = org_id)
  with check ((select auth.uid()) = org_id and public.get_my_tier() in ('coach','club'));
