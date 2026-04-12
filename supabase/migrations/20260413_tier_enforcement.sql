-- ─── 20260413_tier_enforcement.sql — Server-side tier enforcement ─────────────
-- get_my_tier() is the authoritative source of tier for the current JWT user.
-- Used in RLS policies so the server enforces limits independently of the client.

-- ── Authoritative tier function ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_tier()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(subscription_tier, 'free')
  FROM profiles
  WHERE id = auth.uid()
$$;

-- ── JWT custom claim injection ────────────────────────────────────────────────
-- This hook fires on every token refresh and injects the subscription_tier
-- into the JWT as a custom claim.
-- ACTIVATION REQUIRED: Supabase Dashboard → Authentication → Hooks →
--   on_auth_token_refresh → select this function.
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
  user_id := (event->>'user_id')::UUID;
  claims  := event->'claims';

  SELECT COALESCE(subscription_tier, 'free') INTO user_tier
  FROM profiles WHERE id = user_id;

  claims := jsonb_set(claims, '{subscription_tier}', to_jsonb(user_tier));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to supabase_auth_admin (required for hook)
GRANT EXECUTE ON FUNCTION inject_tier_jwt_claim TO supabase_auth_admin;

-- ── RLS on ai_insights: only coach+ tier ─────────────────────────────────────
-- Drop the implicit permissive policy if any, then add tier check.
-- Existing data still owned by athlete_id (no data loss).
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_insights_tier_check ON ai_insights;
CREATE POLICY ai_insights_tier_check ON ai_insights
  USING (
    athlete_id = auth.uid()
    AND get_my_tier() IN ('coach', 'club')
  )
  WITH CHECK (
    athlete_id = auth.uid()
    AND get_my_tier() IN ('coach', 'club')
  );

-- ── RLS on messages: already set in 20260413_messages.sql ────────────────────
-- No changes needed — coach_id = auth.uid() policies already enforce auth.

COMMENT ON FUNCTION get_my_tier() IS 'Returns subscription_tier from profiles for the current JWT user. Used in RLS policies.';
COMMENT ON FUNCTION inject_tier_jwt_claim(JSONB) IS 'JWT hook: injects subscription_tier into access token custom claims. Activate via Supabase Dashboard → Auth → Hooks.';
