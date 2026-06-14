-- 20260605_get_my_tier_status_aware.sql — revoke paid tier at expiry, not at cron
--
-- get_my_tier() (the authority RLS policies use to gate paid features) returned
-- the stored subscription_tier and IGNORED subscription_status — so a cancelled /
-- expired / past-due account kept paid access until the daily reconcile cron got
-- around to flipping the column (a single point of failure: cron lag/failure =
-- free access to paid tiers). (round-4 audit MED, billing)
--
-- Now access is derived at read time:
--   • active / trialing            → the stored tier
--   • past_due                     → tier ONLY while inside grace_period_ends_at
--   • cancelled / expired          → tier ONLY until the period-end date
--   • anything else / unknown date → 'free' (fail safe)
-- The reconcile cron still tidies the stored column later; this just stops relying
-- on it for enforcement. Plain CREATE OR REPLACE — applies independently, STABLE.

CREATE OR REPLACE FUNCTION public.get_my_tier()
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
  WHERE p.id = auth.uid()
$$;
