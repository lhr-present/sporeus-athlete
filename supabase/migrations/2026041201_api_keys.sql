-- ─── 20260412_api_keys.sql — Public API key management ──────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  api_key     TEXT        PRIMARY KEY,
  org_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier        TEXT        NOT NULL DEFAULT 'club' CHECK (tier IN ('club')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_org ON api_keys(org_id);

-- Rate limit tracking (TTL via created_at, pruned by cron)
CREATE TABLE IF NOT EXISTS request_counts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key     TEXT        NOT NULL REFERENCES api_keys(api_key) ON DELETE CASCADE,
  org_id      UUID        NOT NULL,
  path        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS req_counts_key_time ON request_counts(api_key, created_at DESC);

-- Prune old rate-limit rows daily (older than 2h is safe)
-- Add to existing pg_cron setup:
-- SELECT cron.schedule('prune-request-counts','0 * * * *',
--   $$DELETE FROM request_counts WHERE created_at < now() - interval '2 hours'$$);

-- RLS: only service role can access (edge function uses service key)
ALTER TABLE api_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_counts ENABLE ROW LEVEL SECURITY;

-- Org owner can view their own keys
CREATE POLICY api_keys_owner ON api_keys
  FOR SELECT USING (org_id = auth.uid());

COMMENT ON TABLE api_keys IS 'API keys for Club-tier public REST API access';
