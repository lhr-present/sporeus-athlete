-- ─── 20260449_system_status.sql — External dependency status tracking ──────────
-- Stores the result of periodic health checks against external services.
-- Written by check-dependencies edge function (every 5 min via pg_cron).
-- Read by StatusBanner component (public SELECT) and ObservabilityDashboard.

CREATE TABLE IF NOT EXISTS system_status (
  service     TEXT        PRIMARY KEY,
  status      TEXT        NOT NULL CHECK (status IN ('ok', 'degraded', 'down', 'unknown')),
  message     TEXT,
  latency_ms  INT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  system_status IS 'One row per external dependency. Updated every 5 min by check-dependencies edge function.';
COMMENT ON COLUMN system_status.service IS 'Service identifier: supabase_api, strava_api, anthropic_api, dodo_payments, stripe';
COMMENT ON COLUMN system_status.status  IS 'ok | degraded | down | unknown';

-- Seed initial rows (unknown until first check runs)
INSERT INTO system_status (service, status, message, checked_at) VALUES
  ('supabase_api',   'unknown', 'Not yet checked', NOW()),
  ('strava_api',     'unknown', 'Not yet checked', NOW()),
  ('anthropic_api',  'unknown', 'Not yet checked', NOW()),
  ('dodo_payments',  'unknown', 'Not yet checked', NOW()),
  ('stripe',         'unknown', 'Not yet checked', NOW())
ON CONFLICT (service) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- Public read — StatusBanner needs it without auth
CREATE POLICY IF NOT EXISTS "system_status_public_read"
  ON system_status FOR SELECT
  USING (true);

-- Only service_role can write (check-dependencies edge function)
CREATE POLICY IF NOT EXISTS "system_status_service_write"
  ON system_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── operator_alerts: log every alert that fires ───────────────────────────────
CREATE TABLE IF NOT EXISTS operator_alerts (
  id          BIGSERIAL    PRIMARY KEY,
  kind        TEXT         NOT NULL,   -- 'error_rate', 'queue_depth', 'dlq', 'cron_lag', etc.
  severity    TEXT         NOT NULL CHECK (severity IN ('warning', 'critical')),
  title       TEXT         NOT NULL,
  body        TEXT,
  fired_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  notified    BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_operator_alerts_fired
  ON operator_alerts (fired_at DESC);

ALTER TABLE operator_alerts ENABLE ROW LEVEL SECURITY;

-- Only service_role reads/writes alerts
CREATE POLICY IF NOT EXISTS "operator_alerts_service"
  ON operator_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin can read
CREATE POLICY IF NOT EXISTS "operator_alerts_admin_read"
  ON operator_alerts FOR SELECT
  USING ( (auth.jwt()->'app_metadata'->>'role') = 'admin' );

-- ── RPC: get_system_status ─────────────────────────────────────────────────────
-- Returns all services; used by StatusBanner and ObservabilityDashboard.
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS TABLE (
  service     TEXT,
  status      TEXT,
  message     TEXT,
  latency_ms  INT,
  checked_at  TIMESTAMPTZ,
  stale       BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    service,
    status,
    message,
    latency_ms,
    checked_at,
    -- stale if not updated in last 10 min (check-dependencies should run every 5 min)
    (checked_at < NOW() - INTERVAL '10 minutes') AS stale
  FROM system_status
  ORDER BY service;
$$;

GRANT EXECUTE ON FUNCTION get_system_status() TO anon, authenticated;

-- ── pg_cron: check-dependencies every 5 min ───────────────────────────────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'check-dependencies';

SELECT cron.schedule(
  'check-dependencies',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/check-dependencies',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- ── pg_cron: operator-digest Monday 05:00 UTC (08:00 Istanbul) ────────────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'operator-digest-weekly';

SELECT cron.schedule(
  'operator-digest-weekly',
  '0 5 * * 1',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/operator-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{"trigger":"cron"}'::jsonb
    )
  $$
);

-- ── pg_cron: alert monitor every minute ──────────────────────────────────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'alert-monitor';

SELECT cron.schedule(
  'alert-monitor',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/alert-monitor',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{}'::jsonb
    )
  $$
);
