-- ─── Audit Log (GDPR compliance) ─────────────────────────────────────────────
-- Immutable log of data access and mutations for GDPR audit trail.
-- Users can read only their own records; no UPDATE or DELETE allowed.

CREATE TABLE IF NOT EXISTS audit_log (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action         TEXT NOT NULL CHECK (action IN ('read','insert','update','delete','export','erase')),
  table_name     TEXT NOT NULL,
  record_id      TEXT,
  changed_fields TEXT[],
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Athletes/users can INSERT their own entries
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only SELECT their own records
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No UPDATE or DELETE policies — immutable by design
