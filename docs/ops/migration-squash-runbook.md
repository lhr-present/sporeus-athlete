# Migration-drift squash — runbook (needs a Docker- or pg_dump-equipped machine)

## Why this exists
The local `supabase/migrations/` history (**127 files** as of 2026-06-15) does NOT match
prod (`pvicqwapvvfempjdgwbm`, **77 applied versions**, `001` → `20260615143936`). The two
diverge in both COUNT (127 vs 77) and NAMING (repo uses `YYYYMMDD[NN]_name`; prod
`schema_migrations` mixes `001`-style, 14-digit timestamps, and MCP-generated versions).
Prod's `schema_migrations` skips many repo migrations
(e.g. `20260449/450/460/476/477`, `20260603/604/605`) and uses divergent naming.
Symptom: CI's branch-provisioning checks (`contract-smoke`, `db-branch-preview`,
`perf-regression`, `rls-pentest`) all run `supabase db push` against a FRESH branch
and fail (`MIGRATIONS_FAILED`) because the 121-file history can't replay cleanly.

**This was NOT done from the agent sandbox** because a correct squash needs a
faithful prod schema dump, and `supabase db dump` requires Docker (absent), `pg_dump`
isn't installed, and no prod DB password is available here. A hand-built baseline
would be incomplete (missing function bodies / RLS expressions / grants / triggers)
and would make fresh branches silently diverge — worse than the current loud failure.

Prod itself is fine and is NOT deployed via `db push` (migrations are applied
manually via MCP/SQL editor). So this squash is purely to fix CI fresh-provisioning
and make the repo match prod — it does not change prod's actual schema.

## Prerequisites
- A machine with Docker running (or `pg_dump` ≥15) + Supabase CLI.
- `SUPABASE_ACCESS_TOKEN` (PAT) and the prod DB password (Dashboard → Settings → Database).
- A current PITR snapshot / backup (Pro plan has PITR — confirm before step 3).

## Steps
1. **Dump the real prod schema as the baseline** (the authoritative source of truth):
   ```bash
   supabase link --project-ref pvicqwapvvfempjdgwbm
   supabase db dump --linked -f supabase/migrations/20260101000000_prod_baseline.sql
   # (full schema: tables, types, functions, triggers, RLS, grants, indexes, extensions)
   ```
   Sanity-check the file is non-trivial (hundreds of KB) and includes the objects
   verified present on prod: tables training_log (with distance_m/avg_hr/avg_cadence),
   coach_notes, functions tier_for_user(uuid), get_my_tier(), get_funnel_cohort_summary,
   get_recent_client_errors, apply_subscription_event, apply_tier_change.

2. **Archive the old history** (keep it in git, out of the migrations path):
   ```bash
   mkdir -p supabase/migrations_archive
   git mv supabase/migrations/0* supabase/migrations_archive/   # everything EXCEPT the new baseline
   # (leave 20260101000000_prod_baseline.sql in supabase/migrations/)
   ```
   Net result: `supabase/migrations/` contains ONLY the baseline.

3. **Reconcile prod's `schema_migrations` bookkeeping** so `supabase db push` to prod
   (if ever used) doesn't try to re-run the baseline. Bookkeeping only — does NOT touch
   actual schema; recoverable by re-running repair:
   ```bash
   # mark every existing prod version as reverted (forget them):
   supabase migration list --linked        # capture all current versions
   supabase migration repair --status reverted <each existing version> --linked
   # mark the baseline as already applied:
   supabase migration repair --status applied 20260101000000 --linked
   ```
   (If prod is only ever migrated via MCP/SQL-editor, step 3 is optional — but do it
   so the two stay consistent.)

4. **Verify fresh provisioning** (the whole point):
   - Trigger `db-branch-preview` (or `supabase branches create test-squash` then
     `supabase db push --db-url <branch_url>`). It must now provision clean (baseline
     applies in one shot) — `MIGRATIONS_FAILED` gone.
   - Diff the fresh branch schema vs prod (`supabase db diff`) → should be empty.

5. **Future migrations** go on top of the baseline as normal `supabase/migrations/<ts>_*.sql`.

## What the agent already applied to prod (so the baseline WILL include them)
v9.387–v9.399 round:
- `training_log` metric columns (distance_m/avg_hr/avg_cadence)
- `get_funnel_cohort_summary(date,date)` RPC
- `coach_notes` active-link RLS
- `search_path` on `get_recent_client_errors`
- `tier_for_user(uuid)` + status-aware `get_my_tier()` + org_branding white-label gate (20260606)

v9.400–v9.412 round (2026-06-14/15) — ALL applied via MCP, so a fresh `db dump` baseline captures them:
- **SECURITY DEFINER RPC lockdown** — EXECUTE revoked from public/anon/authenticated on ~32 internal
  fns + 4 triggers (re-granted service_role); `inject_tier_jwt_claim` → supabase_auth_admin only.
- **Held-item guards** — `generate_api_key` (org-owner), `get_squad_overview` (coach-self),
  `get_recent_client_errors` (admin-gate), `referral_codes` column-scoped UPDATE.
- **Advisor cleanup** — 11 RLS policies wrapped `(select auth.uid())`; dup policy/index dropped;
  2 FK covering indexes; `search_path` on `search_everything`/`log_consent_change`.
- **view** `ai_feedback_summary` → `security_invoker`; **MVs** `mv_ctl_atl_daily`/`mv_squad_readiness`
  SELECT revoked from anon/authenticated.
- **Dropped** `profiles.training_age` column.
- **`get_acquisition_by_source(date,date)`** RPC (admin-gated).
- **enum-cast fix** — `role::text` in `get_acquisition_by_source` + `get_recent_client_errors`.

Sanity-check the dumped baseline includes the above (esp. the revoked grants + the dropped
training_age column + the two new analytics RPCs) before archiving the old history.

## Still NOT applied to prod (decide per item)
- `20260603` service_role_key_from_guc — tied to the 🔴 service_role key ROTATION +
  the `app.service_role_key` GUC; apply only as part of the rotation.
- `20260604` apply_subscription_event hardening — replaces live BILLING webhook logic;
  review against prod's current function before applying.
- `20260449/450` get_system_status/get_funnel_today — absent on prod; decide if wanted.
