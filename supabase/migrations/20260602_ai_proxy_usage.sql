-- 20260602_ai_proxy_usage.sql — v9.364.0 — AI cost-cap at the ai-proxy chokepoint
--
-- ai-proxy is the SOLE path for Claude calls (aiPrompts.js), but its quota
-- counted `ai_insights` rows — which the client writes inconsistently: the
-- summary path inserts one, but the "Why/explain" path and coach-chat only
-- UPDATE / never insert, so those Claude calls were UNCOUNTED. The count was
-- also a non-atomic check-then-call (concurrent burst bypass).
--
-- Fix: a dedicated usage ledger the proxy increments per call, with an atomic
-- check-and-increment RPC (per-athlete advisory lock serializes concurrent
-- calls so the daily/monthly caps can't be burst past).
-- Apply with the H1 edge-fn deploy bundle (ai-proxy reads this RPC).
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.ai_proxy_usage (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  athlete_id  uuid        NOT NULL,
  day         date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_proxy_usage_athlete_day
  ON public.ai_proxy_usage (athlete_id, day);

ALTER TABLE public.ai_proxy_usage ENABLE ROW LEVEL SECURITY;
-- No client policies: only service_role (ai-proxy) touches this table.

-- Atomic check-and-increment. Returns {allowed, scope, used}. Records a usage
-- row ONLY when under both caps. SECURITY DEFINER; service_role-only.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_athlete uuid, p_daily_limit int, p_monthly_cap int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_day   int;
  v_month int;
BEGIN
  -- Serialize concurrent calls for this athlete so the cap can't be burst past.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_athlete::text, 0));

  SELECT count(*) INTO v_day
    FROM public.ai_proxy_usage WHERE athlete_id = p_athlete AND day = v_today;
  IF v_day >= p_daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'scope', 'daily', 'used', v_day);
  END IF;

  SELECT count(*) INTO v_month
    FROM public.ai_proxy_usage
   WHERE athlete_id = p_athlete AND day >= date_trunc('month', v_today)::date;
  IF v_month >= p_monthly_cap THEN
    RETURN jsonb_build_object('allowed', false, 'scope', 'monthly', 'used', v_month);
  END IF;

  INSERT INTO public.ai_proxy_usage (athlete_id) VALUES (p_athlete);
  RETURN jsonb_build_object('allowed', true, 'daily', v_day + 1, 'monthly', v_month + 1);
END $$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, int, int) TO service_role;
