-- ─── 20260450_client_events.sql — Server-persistent client telemetry ──────────
-- Receives batched events from the upgraded telemetry.js via ingest-telemetry fn.
-- 30-day TTL enforced by pg_cron daily cleanup job.
-- Privacy: user_id is stored as sha256[:16] hex — never raw UUID or email.

CREATE TABLE IF NOT EXISTS client_events (
  id           BIGSERIAL    PRIMARY KEY,
  session_id   TEXT         NOT NULL,   -- random UUID per browser session
  user_id_hash TEXT,                    -- sha256(user_id).slice(0,16) or null for guests
  event_type   TEXT         NOT NULL CHECK (event_type IN ('page_view','feature','error','perf','funnel')),
  category     TEXT         NOT NULL,
  action       TEXT         NOT NULL,
  label        TEXT,
  value        NUMERIC,                 -- for perf marks: duration_ms
  page         TEXT,                    -- e.g. '#log', '#dashboard'
  app_version  TEXT,
  ts           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  client_events IS '30-day rolling telemetry from browser clients. user_id_hash is privacy-safe.';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_client_events_ts
  ON client_events (ts DESC);

CREATE INDEX IF NOT EXISTS idx_client_events_type_ts
  ON client_events (event_type, ts DESC);

CREATE INDEX IF NOT EXISTS idx_client_events_category_action
  ON client_events (category, action, ts DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE client_events ENABLE ROW LEVEL SECURITY;

-- Only service_role writes (ingest-telemetry edge function)
CREATE POLICY IF NOT EXISTS "client_events_service_write"
  ON client_events FOR INSERT TO service_role WITH CHECK (true);

-- Admin reads all
CREATE POLICY IF NOT EXISTS "client_events_admin_read"
  ON client_events FOR SELECT
  USING ( (auth.jwt()->'app_metadata'->>'role') = 'admin' );

-- ── Funnel metrics RPC ────────────────────────────────────────────────────────
-- Returns today's funnel step counts for ObservabilityDashboard.
CREATE OR REPLACE FUNCTION get_funnel_today()
RETURNS TABLE (
  step      TEXT,
  count     BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT action, COUNT(*)
  FROM client_events
  WHERE event_type = 'funnel'
    AND ts >= CURRENT_DATE
  GROUP BY action
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_today() TO authenticated;

-- ── Recent errors RPC ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_recent_client_errors(p_limit int DEFAULT 20)
RETURNS TABLE (
  category TEXT,
  action   TEXT,
  label    TEXT,
  count    BIGINT,
  last_at  TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT category, action, label, COUNT(*) AS count, MAX(ts) AS last_at
  FROM client_events
  WHERE event_type = 'error'
    AND ts >= NOW() - INTERVAL '24 hours'
  GROUP BY category, action, label
  ORDER BY count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_recent_client_errors(int) TO authenticated;

-- ── pg_cron: TTL cleanup — delete rows older than 30 days at 04:00 UTC ────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'client-events-ttl';

SELECT cron.schedule(
  'client-events-ttl',
  '0 4 * * *',
  $$ DELETE FROM client_events WHERE ts < NOW() - INTERVAL '30 days' $$
);
