-- ─── 20260433_rls_hardening.sql — RLS security hardening (v8.0.2) ─────────────
-- Fixes 5 vulnerabilities found during the C2 automated RLS audit:
--
--   BUG-A (MEDIUM) — ai_insights tier bypass
--     The permissive "ai_insights: own rows" SELECT policy (USING athlete_id=uid())
--     short-circuits the tier-gate "ai_insights_tier_check" policy.
--     Since PostgreSQL ORs permissive policies, any authenticated user regardless
--     of subscription_tier could read ai_insights, defeating the premium tier gate.
--     Fix: DROP the over-permissive policy.
--
--   BUG-B (HIGH) — ai_insights INSERT by any authenticated user
--     "ai_insights: service write" has WITH CHECK (true) with no role restriction.
--     Any authenticated user can INSERT ai_insights rows with any athlete_id,
--     allowing cross-user data injection (fake AI coaching advice).
--     Fix: restrict to service_role only (service_role always bypasses RLS anyway;
--     this policy now only applies to edge functions running with explicit auth tokens).
--
--   BUG-C (MEDIUM) — enqueue_push_fanout granted to authenticated
--     Any logged-in user can call enqueue_push_fanout(arbitrary jsonb) and queue
--     push notifications targeting any user's device token.
--     Fix: REVOKE EXECUTE from authenticated; keep service_role only.
--
--   BUG-D (LOW) — mv_refresh_pending has RLS disabled
--     Any authenticated user can INSERT rows into mv_refresh_pending, causing
--     spurious (free) REFRESH MATERIALIZED VIEW CONCURRENTLY calls (DoS vector).
--     The fn_request_squad_refresh() trigger runs as SECURITY DEFINER and is
--     unaffected by enabling RLS.
--     Fix: ENABLE RLS + deny all to authenticated/anon; service_role only.
--
--   BUG-E (MEDIUM) — attribution_events INSERT allows user_id spoofing
--     "attribution_service_write" WITH CHECK (true) lets any authenticated user
--     INSERT attribution events with any user_id, poisoning funnel attribution.
--     Fix: restrict to (user_id IS NULL OR user_id = auth.uid()).

-- ── BUG-A: DROP ai_insights tier bypass policy ────────────────────────────────
-- The "ai_insights_tier_check" policy (from 20260413_tier_enforcement.sql) covers
-- both USING and WITH CHECK with athlete_id = auth.uid() AND tier IN ('coach','club').
-- The "own rows" policy (from 20260420_session_analysis.sql) was added later without
-- realising it made tier enforcement on SELECT no-op for any authenticated user.
DROP POLICY IF EXISTS "ai_insights: own rows" ON public.ai_insights;

COMMENT ON TABLE public.ai_insights IS
  'Daily AI training summaries. Coach/club tier only (enforced via ai_insights_tier_check). '
  'Nightly-batch writes via service_role; on-demand via data_hash=''on-demand'' dedup.';

-- ── BUG-B: ai_insights INSERT — restrict to service_role ──────────────────────
-- Old policy allowed any role via WITH CHECK (true).
-- New policy is role-restricted: only service_role can INSERT.
DROP POLICY IF EXISTS "ai_insights: service write" ON public.ai_insights;

CREATE POLICY "ai_insights: service write"
  ON public.ai_insights
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── BUG-C: enqueue_push_fanout — revoke from authenticated ────────────────────
-- Queuing push notifications must be a server-side operation.
-- Any authenticated user being able to enqueue arbitrary push payloads is a DoS
-- vector and could be abused to spam other users' devices.
REVOKE EXECUTE ON FUNCTION public.enqueue_push_fanout(jsonb) FROM authenticated;

COMMENT ON FUNCTION public.enqueue_push_fanout IS
  'Queue a push notification in push_fanout queue. Service-role only. '
  'Revoked from authenticated in 20260433 (BUG-C fix).';

-- ── BUG-D: mv_refresh_pending — enable RLS, deny unauthenticated/authenticated ─
ALTER TABLE public.mv_refresh_pending ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (triggers run as SECURITY DEFINER, unaffected)
CREATE POLICY "mv_refresh_pending_service"
  ON public.mv_refresh_pending
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Deny all to everyone else (no SELECT/INSERT/UPDATE/DELETE for authenticated/anon)
-- A RESTRICTIVE policy would be ideal, but adding a service_role-only PERMISSIVE
-- policy combined with RLS enabled achieves the same deny-all for other roles.
-- (Permissive: row is returned only if at least one policy passes. For non-service_role
-- users, no policy matches → zero rows / writes blocked.)

COMMENT ON TABLE public.mv_refresh_pending IS
  'MV refresh debounce signals. Written by fn_request_squad_refresh() (SECURITY DEFINER). '
  'Direct client access denied via RLS (BUG-D fix v8.0.2).';

-- ── BUG-E: attribution_events — prevent user_id spoofing ──────────────────────
-- Old: WITH CHECK (true) — any user can write any user_id.
-- New: WITH CHECK (user_id IS NULL OR user_id = auth.uid())
--      Anonymous events (user_id IS NULL) are still allowed (landing page tracking).
--      Authenticated users can only attribute to themselves.
DROP POLICY IF EXISTS "attribution_service_write" ON public.attribution_events;

-- Service-role edge functions bypass RLS; no policy needed for them.
-- This policy covers authenticated clients who might call the insert endpoint.
CREATE POLICY "attribution_own_write"
  ON public.attribution_events
  FOR INSERT
  WITH CHECK (
    user_id IS NULL               -- anonymous landing events
    OR user_id = auth.uid()       -- authenticated self-attribution only
  );

-- Service role retains full access (bypasses RLS by default; policy below for clarity)
CREATE POLICY "attribution_service_write"
  ON public.attribution_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.attribution_events IS
  'Zero-vendor funnel attribution. Append-only: no UPDATE/DELETE policies. '
  'Auth users can only attribute to themselves or as anonymous (BUG-E fix v8.0.2).';

-- ── Verification queries ────────────────────────────────────────────────────────
-- Run these after applying the migration to verify fixes:
--
-- 1. ai_insights policies (should have 2: tier_check + service write to service_role):
--    SELECT policyname, cmd, roles FROM pg_policies
--    WHERE schemaname='public' AND tablename='ai_insights';
--
-- 2. enqueue_push_fanout grants (authenticated should NOT be present):
--    SELECT has_function_privilege('authenticated',
--      'enqueue_push_fanout(jsonb)', 'EXECUTE');
--    -- Expected: false
--
-- 3. mv_refresh_pending RLS:
--    SELECT relrowsecurity FROM pg_class
--    WHERE relnamespace='public'::regnamespace AND relname='mv_refresh_pending';
--    -- Expected: true
--
-- 4. attribution_events policies (should have 3: own_read, own_write, service_write):
--    SELECT policyname, cmd, roles FROM pg_policies
--    WHERE schemaname='public' AND tablename='attribution_events';
