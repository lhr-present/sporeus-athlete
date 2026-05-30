-- 20260538_gdpr_erasure_log.sql — M5 (MEDIUM)
--
-- src/lib/gdprExport.js (deleteAthleteData) inserts into public.gdpr_erasure_log,
-- but no migration creates it → the erasure-audit insert throws (caught/logged,
-- so the audit trail is silently lost on every client-side erasure).
--
-- Schema matches the caller exactly (gdprExport.js:87):
--   INSERT { user_id, requested_at, completed_at, tables_affected }
-- where tables_affected is a string[] of table names that were cleared.
-- The insert runs as the authenticated user erasing their OWN data.
-- Idempotent: CREATE TABLE / INDEX / POLICY guarded.

CREATE TABLE IF NOT EXISTS public.gdpr_erasure_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  requested_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  tables_affected JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No FK to auth.users: the row must SURVIVE the user's deletion (it is the
-- legal proof that erasure happened). Same rationale as audit_log.

CREATE INDEX IF NOT EXISTS idx_gdpr_erasure_log_user
  ON public.gdpr_erasure_log (user_id, created_at DESC);

ALTER TABLE public.gdpr_erasure_log ENABLE ROW LEVEL SECURITY;

-- A user may insert + read only their own erasure records. No UPDATE/DELETE
-- (append-only audit). service_role bypasses RLS for admin/purge use.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gdpr_erasure_log'
      AND policyname = 'gdpr_erasure_log_own_insert'
  ) THEN
    CREATE POLICY "gdpr_erasure_log_own_insert"
      ON public.gdpr_erasure_log
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'gdpr_erasure_log'
      AND policyname = 'gdpr_erasure_log_own_read'
  ) THEN
    CREATE POLICY "gdpr_erasure_log_own_read"
      ON public.gdpr_erasure_log
      FOR SELECT
      TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;
