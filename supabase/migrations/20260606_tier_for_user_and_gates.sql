-- 20260606_tier_for_user_and_gates.sql — server-side feature-gate enforcement
--
-- Two audit findings: paid features (export_pdf, white_label) were gated only in
-- the client; a determined caller could hit the server resource directly. Closes
-- them, status-aware (consistent with 20260605 get_my_tier revoke-at-expiry).
-- Plain DDL — applies independently of edge deploy.

-- ── 1. tier_for_user(uuid) — status-aware tier, parameterized ─────────────────
-- get_my_tier() relies on auth.uid(), which is NULL when an edge function calls
-- it with the service-role client. Extract the logic into a uuid-parameterized
-- function that BOTH the RLS path (via get_my_tier) and edge functions (via
-- service-role rpc) can use — one source of truth for "what tier is this user,
-- right now, accounting for subscription_status".
CREATE OR REPLACE FUNCTION public.tier_for_user(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN p.subscription_tier IS NULL OR p.subscription_tier = 'free' THEN 'free'
    WHEN p.subscription_status IN ('active', 'trialing') THEN p.subscription_tier
    WHEN p.subscription_status = 'past_due' THEN
      CASE WHEN p.grace_period_ends_at > now() THEN p.subscription_tier ELSE 'free' END
    WHEN p.subscription_status IN ('cancelled', 'expired') THEN
      CASE
        WHEN COALESCE(p.subscription_end_date, p.subscription_expires_at,
                      p.subscription_current_period_end) > now()
        THEN p.subscription_tier
        ELSE 'free'
      END
    ELSE 'free'
  END
  FROM public.profiles p
  WHERE p.id = p_user_id
$$;

REVOKE ALL ON FUNCTION public.tier_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tier_for_user(uuid) TO service_role;

-- get_my_tier() now delegates (auth.uid() → tier_for_user). Behavior identical
-- for the RLS path; NULL auth.uid() → no row → NULL (RLS comparisons treat NULL
-- as deny, same as before).
CREATE OR REPLACE FUNCTION public.get_my_tier()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.tier_for_user(auth.uid())
$$;

-- ── 2. white_label — gate org_branding WRITES behind Club tier ────────────────
-- Pre-fix the RLS only checked ownership (org_id = auth.uid()), so a downgraded /
-- free user who owned an org could still upsert branding by bypassing the client
-- gate. Add the tier check to WITH CHECK (writes); USING (reads/deletes) stays
-- ownership-only so a downgraded org can still view/clear its existing branding.
DROP POLICY IF EXISTS org_branding_owner ON public.org_branding;
CREATE POLICY org_branding_owner ON public.org_branding
  USING (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid() AND public.get_my_tier() = 'club');
