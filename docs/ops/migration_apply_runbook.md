# Migration Apply Runbook

**Last updated:** 2026-05-25

## When to use this

Use this runbook any time you want to apply pending migrations to **prod**. The schema_migrations table on prod is currently out of sync with the repo (50 entries applied vs 99 files) — most of the schema is correct, but the version table doesn't accurately reflect what's been run. This runbook gives you a verify-first approach so you don't double-apply or over-apply.

## Pre-flight (always)

```bash
cd ~/sporeus-athlete-app

# 1. What's applied (top entries)
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "SELECT version FROM supabase_migrations.schema_migrations
   ORDER BY version DESC LIMIT 10;"

# 2. What's in the repo (top entries)
ls supabase/migrations/ | sort -r | head -10

# 3. Check critical tables exist (paste-ready)
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "SELECT relname FROM pg_class
   WHERE relname IN ('attribution_events','billing_events','processed_webhooks',
                     'client_events','system_status','operator_alerts',
                     'generated_reports','data_rights_requests')
     AND relnamespace='public'::regnamespace
   ORDER BY relname;"
```

If a critical table is missing, the migration that creates it never ran in prod. Re-create idempotently (`CREATE TABLE IF NOT EXISTS`).

## Applying a single new migration (RECOMMENDED for normal work)

For a single new migration file you've just added (e.g. `20260483_X.sql`):

```bash
# Dry-run first: read the migration body, confirm it's idempotent
cat supabase/migrations/20260483_X.sql

# Apply via the linked project's database
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  < supabase/migrations/20260483_X.sql

# Manually record it in schema_migrations (Supabase CLI doesn't auto-record
# when you apply via `db query`; only `db push` records)
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
     VALUES ('20260483', 'pentest_corrective', NULL)
     ON CONFLICT (version) DO NOTHING;"

# Verify
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "SELECT version FROM supabase_migrations.schema_migrations
   WHERE version = '20260483';"
```

## Verification queries (after applying any migration)

Tailor these to what the migration changed:

```sql
-- Did the table get created?
SELECT relname FROM pg_class WHERE relname = '<table>' AND relnamespace='public'::regnamespace;

-- Are policies in place?
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = '<table>';

-- Is RLS enabled?
SELECT relname, relrowsecurity FROM pg_class WHERE relname = '<table>';

-- Did permissions change?
SELECT grantee, privilege_type FROM information_schema.table_privileges
WHERE table_name = '<table>' AND table_schema = 'public';
```

## Full sync (DO NOT do casually)

To make `schema_migrations` reflect all 99 repo files, the standard Supabase flow is `supabase db push`. **This is currently risky** because:

1. The CLI computes a hash of each migration file and refuses to re-apply files whose hash differs from what's recorded. Some applied versions have NO corresponding file (timestamp-named versions from earlier CLI usage) — those will look "applied" but the repo file using a different name may try to re-apply.
2. Migrations like `20260480_coach_messages` ADD a table, and `20260481_drop_coach_messages_and_publish_messages` DROPs it. Applying them in sequence is fine; cherry-picking is not.
3. Some old migrations may reference roles/extensions that have since been renamed.

If you need a full sync:

1. **First**, audit each unapplied repo file: read its body, decide whether its effects are already present in prod schema.
2. For files whose effects are already present: insert their version into `schema_migrations` manually (no apply).
3. For files whose effects are NOT present: re-write as idempotent corrective migrations (like `20260483_pentest_corrective.sql`).
4. After the schema_migrations table is reconciled, future `supabase db push` will only run truly new migrations.

**Estimated effort**: half-day or more for the full reconciliation. Pair with branch CI verification.

## RLS pen test (the workflow that surfaced this)

```bash
# View latest run
gh run list --branch main --workflow "RLS Penetration Test" --limit 3

# View detail
gh run view <run-id> --log-failed

# Local re-run against the prod DB
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  < supabase/tests/rls/pentest/scenarios.sql
```

## Incidents to escalate (do NOT auto-fix)

Per [[project_sporeus_master_reference]] gate-before-E14:
- RLS leak on `session_comments` or `session_views` = **INCIDENT, not bug**. Write a post-mortem.
- Cross-user data exposure via any function = **INCIDENT**.
- Service-role key leak = **INCIDENT** + rotate immediately.

The 2026-05-25 pen test failures were NOT in these categories — they were a deployment gap (attribution_events) + a permission hardening (MV REFRESH) + two SECURITY DEFINER-with-internal-filtering false positives. Documented in `supabase/migrations/20260483_pentest_corrective.sql` comment.
