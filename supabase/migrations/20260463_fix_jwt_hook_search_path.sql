-- ─── Migration 063 — Fix JWT hook: add SET search_path = public ──────────────
-- Root cause: supabase_auth_admin runs with a restricted search_path (auth,
-- pg_catalog only). inject_tier_jwt_claim did not set search_path, so
-- "SELECT subscription_tier FROM profiles" raised "relation does not exist"
-- → 500 on every Google / email sign-in.
--
-- Fix: add SET search_path = public + fully-qualify table reference as
-- belt-and-suspenders. Also re-apply all grants in case a prior migration
-- was not deployed to production.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.inject_tier_jwt_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- required: supabase_auth_admin has no public in path
AS $$
DECLARE
  claims    JSONB;
  user_tier TEXT;
  user_id   UUID;
BEGIN
  -- Safely parse user_id; return event unchanged on any parse error
  BEGIN
    user_id := (event->>'user_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN event;
  END;

  -- If user_id came out NULL for any reason, bail out cleanly
  IF user_id IS NULL THEN
    RETURN event;
  END IF;

  claims := event->'claims';

  -- Fully-qualified table name as belt-and-suspenders against search_path drift
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = user_id;

  -- Default to 'free' when no row exists (new OAuth user before trigger fires)
  user_tier := COALESCE(user_tier, 'free');

  -- Only mutate claims when they exist; never return NULL claims to auth
  IF claims IS NOT NULL THEN
    claims := jsonb_set(claims, '{subscription_tier}', to_jsonb(user_tier));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;

EXCEPTION WHEN OTHERS THEN
  -- Last-resort safety net: never let the hook crash auth entirely
  RETURN event;
END;
$$;

-- Re-grant in case the prior GRANT was not applied in production
GRANT EXECUTE ON FUNCTION public.inject_tier_jwt_claim(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.inject_tier_jwt_claim(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inject_tier_jwt_claim(JSONB) FROM authenticated;

COMMENT ON FUNCTION public.inject_tier_jwt_claim(JSONB) IS
  'JWT hook: injects subscription_tier into access token. SET search_path = public '
  'required because supabase_auth_admin has restricted path (auth, pg_catalog). '
  'Last updated: migration 063 (2026-04-23).';
