-- ── Ops support tables ────────────────────────────────────────────────────────
-- Enables: alert-monitor, check-dependencies, ingest-telemetry, operator-digest

-- ── operator_alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operator_alerts (
  id         bigserial PRIMARY KEY,
  kind       text        NOT NULL,
  severity   text        NOT NULL CHECK (severity IN ('warning', 'critical')),
  title      text        NOT NULL,
  body       text        NOT NULL DEFAULT '',
  fired_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_alerts ENABLE ROW LEVEL SECURITY;

-- Only service_role (BYPASSRLS) accesses this; no user policies needed.
-- Explicit deny for authenticated prevents accidental REST API exposure.
CREATE POLICY "operator_alerts: deny public" ON public.operator_alerts
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_operator_alerts_kind_fired_at
  ON public.operator_alerts (kind, fired_at DESC);

-- ── system_status ─────────────────────────────────────────────────────────────
-- Written by check-dependencies, read by alert-monitor.
CREATE TABLE IF NOT EXISTS public.system_status (
  service    text        PRIMARY KEY,
  status     text        NOT NULL DEFAULT 'unknown' CHECK (status IN ('up', 'down', 'degraded', 'unknown')),
  message    text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_status: deny public" ON public.system_status
  FOR ALL USING (false);

-- ── client_events ─────────────────────────────────────────────────────────────
-- Written by ingest-telemetry (service_role). 30-day TTL via pg_cron.
CREATE TABLE IF NOT EXISTS public.client_events (
  id           bigserial   PRIMARY KEY,
  session_id   text        NOT NULL,
  user_id_hash text,
  event_type   text        NOT NULL,
  category     text        NOT NULL,
  action       text        NOT NULL,
  label        text,
  value        numeric,
  page         text,
  app_version  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_events: deny public" ON public.client_events
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_client_events_created_at
  ON public.client_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_events_session_id
  ON public.client_events (session_id);

-- 30-day TTL: delete events older than 30 days (runs with nightly-batch)
SELECT cron.schedule(
  'purge-client-events',
  '30 3 * * *',
  $$DELETE FROM public.client_events WHERE created_at < now() - interval '30 days';$$
);
