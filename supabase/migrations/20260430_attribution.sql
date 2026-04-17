-- ── 20260430_attribution.sql — Funnel attribution capture ───────────────────
-- Captures first-touch UTM context, anonymous landing events, and conversion
-- milestones (signup, first_session, first_week). Zero external analytics
-- vendors — all data stays in Supabase.
--
-- Tables:  attribution_events (append-only event log)
-- Columns: profiles.first_touch JSONB (stamped once on first authenticated event)
-- View:    attribution_summary (owner: service_role only)
-- RLS:     users read own rows; edge function (service_role) writes all rows

-- ── attribution_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attribution_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id        text        NOT NULL,
  event_name     text        NOT NULL,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  referrer       text,
  landing_path   text,
  user_agent_class text,
  props          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_attribution_user   ON public.attribution_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_attribution_anon   ON public.attribution_events (anon_id, created_at DESC);
CREATE INDEX idx_attribution_event  ON public.attribution_events (event_name, created_at DESC);
CREATE INDEX idx_attribution_utm_src ON public.attribution_events (utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

-- RLS
ALTER TABLE public.attribution_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users read only their own rows
CREATE POLICY "attribution_own_read" ON public.attribution_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service-role writes all rows (edge function uses service key)
CREATE POLICY "attribution_service_write" ON public.attribution_events
  FOR INSERT WITH CHECK (true);  -- service_role bypasses RLS by default; this
                                   -- covers authenticated edge fn paths

-- ── profiles.first_touch — stamped once per user, never overwritten ──────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_touch jsonb;

COMMENT ON COLUMN public.profiles.first_touch IS
  'First-touch attribution context: utm_source, utm_medium, utm_campaign, referrer, landing_path, anon_id. Stamped once on first authenticated attribution event, never overwritten.';

-- ── attribution_summary view — service_role reporting only ────────────────────
CREATE OR REPLACE VIEW public.attribution_summary AS
  SELECT
    utm_source,
    utm_medium,
    utm_campaign,
    event_name,
    date_trunc('day', created_at)::date AS day,
    count(*)                             AS events,
    count(DISTINCT anon_id)              AS unique_visitors,
    count(DISTINCT user_id)              AS authenticated_users
  FROM public.attribution_events
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 5 DESC, 6 DESC;

-- Only service_role can query the summary (no RLS needed on views; security via
-- GRANT — revoke public access and grant only to service_role)
REVOKE ALL ON public.attribution_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.attribution_summary TO service_role;
