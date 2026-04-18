-- ─── supabase/tests/seed-test-data.sql — E2E test data seed ─────────────────
-- Run against a fresh Supabase DB branch before the E2E suite.
-- Creates three standing test users and links them.
--
-- NOTE: User creation itself is done via the admin API in global-setup.ts.
--       This script seeds the *data* rows (profiles, sessions, links).
--       It is idempotent — safe to run multiple times.
--
-- Usage:
--   npx supabase db query --linked < supabase/tests/seed-test-data.sql
--   Or via the CI workflow (e2e-critical-paths.yml runs it after branch creation).

-- ── Ensure pg_cron / realtime publication don't error in test schema ──────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE training_log, recovery, injuries;
  END IF;
END $$;

-- ── Seed consent records for any existing E2E users ───────────────────────────
-- The global-setup.ts also calls seedConsent() via JS; this covers any gap
-- if the JS setup is skipped (e.g. manual branch testing).
INSERT INTO public.consents (user_id, consent_type, version)
SELECT id, 'data_processing', '1.1' FROM auth.users
WHERE email LIKE '%@test.sporeus.dev'
ON CONFLICT (user_id, consent_type, version) DO NOTHING;

INSERT INTO public.consents (user_id, consent_type, version)
SELECT id, 'health_data', '1.1' FROM auth.users
WHERE email LIKE '%@test.sporeus.dev'
ON CONFLICT (user_id, consent_type, version) DO NOTHING;

-- ── Diagnostic: show what was seeded ─────────────────────────────────────────
SELECT
  u.email,
  p.subscription_tier,
  COUNT(DISTINCT tl.id)   AS sessions,
  COUNT(DISTINCT ca.athlete_id) AS linked_athletes,
  COUNT(DISTINCT cn.user_id)    AS consent_rows
FROM auth.users u
LEFT JOIN public.profiles        p  ON p.id  = u.id
LEFT JOIN public.training_log    tl ON tl.user_id = u.id
LEFT JOIN public.coach_athletes  ca ON ca.coach_id = u.id AND ca.status = 'active'
LEFT JOIN public.consents        cn ON cn.user_id = u.id
WHERE u.email LIKE '%@test.sporeus.dev'
GROUP BY u.email, p.subscription_tier
ORDER BY u.email;
