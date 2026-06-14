# Prod deploy state — 2026-06-16 (project pvicqwapvvfempjdgwbm)

What was deployed to **production** this session (PR #4 branch, not yet merged):

## Migrations applied (via MCP / SQL)
- training_log metric columns: `distance_m`, `avg_hr`, `avg_cadence`
- `get_funnel_cohort_summary(date,date)` RPC (service_role only)
- `coach_notes` RLS active-link check
- `search_path` on `get_recent_client_errors`
- `tier_for_user(uuid)` + status-aware `get_my_tier()` + org_branding white-label gate (20260606)

## Edge functions deployed (all deep-dive + earlier-round fixes)
strava-oauth, strava-backfill-worker, ai-proxy, analyse-session, embed-session,
nightly-batch, export-user-data, embed-query, attribution-log, dodo-webhook,
generate-report, parse-activity, public-api, push-worker, trigger-checkin-reminders.

## ⚠️ verify_jwt — pinned in config.toml
A deploy defaulted `verify_jwt=true` and 401'd the internal-auth workers. Fixed by
redeploying with `--no-verify-jwt` and **pinning every function's `verify_jwt` in
`supabase/config.toml`**. Always deploy from this repo so config.toml is honored.

## ⚠️ H1 shared-secret auth — NOW ACTIVE (literal-secret form)
The hardened workers (strava-backfill-worker, push-worker, trigger-checkin-reminders,
generate-report, embed-session) require `x-sporeus-webhook-secret`. To make them work:
- edge env `WEBHOOK_SECRET` is **set**;
- the 7 hardened pg_cron jobs + `on_training_log_embed()` were patched to send the
  matching secret as a **literal** value (the GUC path `ALTER DATABASE SET
  app.webhook_secret` is permission-denied via the API role — Dashboard-only).

Verified: those functions return 200 with the secret, 401 without (guard intact).

### Operator follow-ups
1. **Rotate the leaked `service_role` key** (Dashboard → Settings → API). Still UNRESOLVED.
2. Switch the cron secret from literal → GUC: set `app.webhook_secret` in the Dashboard
   (Database config), apply the real `20260601_webhook_secret_headers.sql` (GUC form),
   then **rotate the webhook secret**. (Current literal value lives in edge env +
   cron.job commands — same exposure as the JWT already there; not committed to git.)
3. Merge PR #4 to ship the client (PWA via GitHub Pages).
4. Migration-drift squash for CI fresh-branch provisioning — see `migration-squash-runbook.md`.
