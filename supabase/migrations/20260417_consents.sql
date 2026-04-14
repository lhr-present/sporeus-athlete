-- ─── 20260417_consents.sql — GDPR/KVKK consent logging ──────────────────────
-- Records explicit athlete consent for data processing, health data, and marketing.
-- Required before storing any health data (Turkish KVKK Art. 6 & GDPR Art. 9).

CREATE TABLE IF NOT EXISTS public.consents (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('data_processing', 'health_data', 'marketing')),
  version      TEXT NOT NULL DEFAULT '1.0',
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address   TEXT,
  withdrawn_at TIMESTAMPTZ,
  UNIQUE (user_id, consent_type, version)
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Athletes can read/write their own consent records
CREATE POLICY consents_self_all ON consents
  FOR ALL USING (auth.uid() = user_id);

-- Service role (nightly-batch, compliance checks) can read all
CREATE POLICY consents_service_read ON consents
  FOR SELECT USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS consents_user_type
  ON consents (user_id, consent_type, granted_at DESC);

COMMENT ON TABLE consents IS
  'Explicit consent records per athlete. Required before health data storage (KVKK/GDPR).';
