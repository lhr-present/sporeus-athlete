-- ─── 20260416_fix_jwt_hook.sql ───────────────────────────────────────────────
-- Fix 1: inject_tier_jwt_claim — null-safe for users with no profile row yet
--        (first-time Google OAuth users hit the hook before profile is created)
-- Fix 2: handle_new_user trigger — auto-insert profile row on auth.users INSERT
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fix 1: null-safe JWT hook ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION inject_tier_jwt_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims    JSONB;
  user_tier TEXT;
  user_id   UUID;
BEGIN
  -- Safely parse user_id; return event unchanged on any error
  BEGIN
    user_id := (event->>'user_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN event;
  END;

  claims := event->'claims';

  -- SELECT INTO leaves user_tier NULL when no profile row exists yet
  SELECT subscription_tier INTO user_tier
  FROM profiles WHERE id = user_id;

  -- Default to 'free' whether row is missing or column is null
  user_tier := COALESCE(user_tier, 'free');

  -- Only mutate claims when they exist; never return null claims to Supabase auth
  IF claims IS NOT NULL THEN
    claims := jsonb_set(claims, '{subscription_tier}', to_jsonb(user_tier));
    RETURN jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION inject_tier_jwt_claim TO supabase_auth_admin;

-- ── Fix 2: auto-create profile on new auth user ───────────────────────────────
-- Fires after every INSERT on auth.users (email, Google OAuth, magic link, etc.)
-- Creates a minimal profile row so the JWT hook and RLS policies always find one.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION inject_tier_jwt_claim(JSONB) IS 'JWT hook: null-safe tier injection. Returns free tier when no profile row exists (first Google OAuth sign-in).';
COMMENT ON FUNCTION handle_new_user() IS 'Auto-creates profiles row on every new auth.users INSERT so JWT hook and RLS always have a row to read.';
