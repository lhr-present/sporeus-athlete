-- 20260458_privacy_lifecycle.sql — E8: GDPR/KVKK data portability + account lifecycle
--
-- Adds:
--   export_jobs           — tracks async data export requests per user
--   deletion_requests     — grace-period account deletion queue
--   consent_purposes      — granular per-purpose consent (extends consents table)
--
-- Audit log already exists (20260416_audit_log.sql). Consents table exists (20260417).

-- ── export_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','ready','failed','expired')),
  formats        TEXT[] NOT NULL DEFAULT ARRAY['json','csv'],  -- json, csv, zip
  signed_url     TEXT,           -- null until ready; 7-day expiry
  url_expires_at TIMESTAMPTZ,
  error_message  TEXT,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  CONSTRAINT export_jobs_one_active UNIQUE (user_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- Drop the unique constraint: one user can have multiple jobs in different statuses
ALTER TABLE export_jobs DROP CONSTRAINT IF EXISTS export_jobs_one_active;

CREATE INDEX IF NOT EXISTS idx_export_jobs_user
  ON export_jobs(user_id, requested_at DESC);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs: user owns rows"
  ON export_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── deletion_requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','cancelled','purged')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  grace_until     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancelled_at    TIMESTAMPTZ,
  purged_at       TIMESTAMPTZ,
  purge_audit_id  BIGINT REFERENCES audit_log(id)  -- points to the final audit_log entry
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_requests_pending
  ON deletion_requests(user_id)
  WHERE status = 'pending';

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deletion_requests: user can insert/select own"
  ON deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deletion_requests: user can read own"
  ON deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can UPDATE (to set status=cancelled, purged)
-- Users cancel via cancel-deletion edge function which uses service role key

-- ── consent_purposes ───────────────────────────────────────────────────────
-- Granular per-purpose consent extending the base consents table.
-- Each purpose can be granted/revoked independently.
CREATE TABLE IF NOT EXISTS consent_purposes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL CHECK (purpose IN (
                 'analytics',           -- usage tracking via client_events
                 'ai_processing',       -- AI insights generation (ai_insights, embed_session)
                 'strava_sync',         -- Strava OAuth and activity pull
                 'email_communications', -- transactional + marketing emails
                 'health_data'          -- HRV, injuries, mental state (GDPR Art.9)
               )),
  granted      BOOLEAN NOT NULL DEFAULT true,
  version      TEXT NOT NULL DEFAULT '1.1',  -- matches CONSENT_VERSION in consentVersion.js
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_consent_purposes_user
  ON consent_purposes(user_id, purpose);

ALTER TABLE consent_purposes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_purposes: user owns rows"
  ON consent_purposes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: log consent changes to audit_log automatically
CREATE OR REPLACE FUNCTION log_consent_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, changed_fields)
  VALUES (
    NEW.user_id,
    'update',
    'consent_purposes',
    NEW.id::text,
    ARRAY['purpose:' || NEW.purpose || '→granted:' || NEW.granted::text]
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consent_purpose_audit
  AFTER INSERT OR UPDATE ON consent_purposes
  FOR EACH ROW EXECUTE FUNCTION log_consent_change();

-- ── audit_log: add resource column (backfill-safe) ─────────────────────────
-- Needed for consistent querying (surface, actor, etc.)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'user';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;
