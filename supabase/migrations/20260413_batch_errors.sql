-- ─── batch_errors — Nightly batch failure log ────────────────────────────────
-- Records athletes that failed AI summary generation after all retries.
-- Used for alerting and manual re-run workflows.
--
-- Note on messages table encryption:
--   ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT true;
--   Existing rows pre-encryption should be treated as plaintext (encrypted=false).

CREATE TABLE IF NOT EXISTS batch_errors (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE    NOT NULL,
  error_code  TEXT    NOT NULL,
  attempts    INT     NOT NULL DEFAULT 3,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS batch_errors_date_idx ON batch_errors (date);
CREATE INDEX IF NOT EXISTS batch_errors_athlete_idx ON batch_errors (athlete_id, date);

-- Only service role can read/write batch_errors (nightly batch uses service key)
ALTER TABLE batch_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_errors_service_only ON batch_errors USING (false);
