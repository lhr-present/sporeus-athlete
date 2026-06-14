-- ── Security + Performance hardening round 2 ─────────────────────────────────

-- ── 1. Fix mutable search_path on trigger functions ──────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_training_plan_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. Fix consents_service_read: auth.role() → (SELECT auth.role()) ─────────

DROP POLICY IF EXISTS "consents_service_read" ON public.consents;
CREATE POLICY "consents_service_read" ON public.consents
  FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

-- ── 3. Drop ai_insights: service write ───────────────────────────────────────
-- service_role has BYPASSRLS; this policy only allows any authed user to insert
-- unchecked, defeating the tier gate on ai_insights_tier_check.

DROP POLICY IF EXISTS "ai_insights: service write" ON public.ai_insights;

-- ── 4. Missing FK indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_athlete_devices_user_id
  ON public.athlete_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_athlete_id
  ON public.messages (athlete_id);

CREATE INDEX IF NOT EXISTS idx_profiles_coach_id
  ON public.profiles (coach_id);

CREATE INDEX IF NOT EXISTS idx_request_counts_api_key
  ON public.request_counts (api_key);
