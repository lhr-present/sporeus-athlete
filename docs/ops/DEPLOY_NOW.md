# DEPLOY NOW — consolidated operator sequence (state @ v9.381 / 2026-06-06)

Single copy-paste runbook to ship everything currently undeployed. Supersedes the
ordering notes in `h1_security_deploy_runbook.md` (which still has the *why* for
each step — read it if anything below is unclear). **Do the phases in order.**

Conventions used below:
```bash
export SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token)   # PAT (memory: reference_supabase_access)
DBQ() { npx supabase db query --linked "$1"; }                        # run one SQL statement
cd ~/sporeus-athlete-app                                               # project root (linked: ref pvicqwapvvfempjdgwbm)
```

---

## Phase 0 — confirm secrets exist (one-time)
The hardened functions **fail closed** without `WEBHOOK_SECRET`. Check, and set anything missing.
```bash
npx supabase secrets list        # should include all of the below
```
Required (edge): `WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (auto), `ANTHROPIC_API_KEY`, `EMBEDDING_API_KEY`,
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`,
`DODO_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
`STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`,
`GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET`, `DEVICE_SYNC_ALLOWED_HOSTS`.

If `WEBHOOK_SECRET` is unset, generate once and set on BOTH sides:
```bash
SECRET=$(openssl rand -hex 32)
npx supabase secrets set WEBHOOK_SECRET="$SECRET"
DBQ "ALTER DATABASE postgres SET app.webhook_secret = '$SECRET';"
```

---

## Phase A — 🔴 ROTATE the service_role key (DO FIRST)
The leaked key is only invalidated by rotation (scrubbing source/history does not).
1. Supabase Dashboard → Project Settings → API → **roll/reset `service_role`**.
2. Copy the NEW key, then point the DB GUC at it (read at session start → pg_cron picks it up next tick):
```bash
DBQ "ALTER DATABASE postgres SET app.service_role_key = '<NEW_SERVICE_ROLE_KEY>';"
```
Edge functions read `SUPABASE_SERVICE_ROLE_KEY` from env (Supabase auto-updates it) — they recover on the redeploy in Phase C.

---

## Phase B — apply migrations in order
First see what's already applied:
```bash
DBQ "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260601' ORDER BY 1;"
```
Apply each one NOT listed, in ascending order. Pattern (repeat per file):
```bash
npx supabase db query --linked < supabase/migrations/<FILE>.sql
DBQ "INSERT INTO supabase_migrations.schema_migrations (version,name,statements)
     VALUES ('<VERSION>','<name>',NULL) ON CONFLICT (version) DO NOTHING;"
```
Order + purpose:
| Version | File | Effect | Prereq |
|---|---|---|---|
| 20260601 | `webhook_secret_headers` | adds `x-sporeus-webhook-secret` header to 7 crons + embed trigger | `app.webhook_secret` set (Phase 0) |
| 20260602 | `ai_proxy_usage` | ai-proxy usage table/quota | — |
| 20260603 | `service_role_key_from_guc` | rewrites live cron/embed callers' Authorization bearer → `app.service_role_key` GUC | **`app.service_role_key` set (Phase A)** — migration RAISEs if empty |
| 20260604 | `subscription_event_hardening` | reject id-less webhook events, no `coach` default, tier whitelist | — |
| 20260605 | `get_my_tier_status_aware` | tier revoked at expiry, not at cron | — |
| 20260606 | `tier_for_user_and_gates` | `tier_for_user(uuid)` + org_branding club write-gate | — |

---

## Phase C — deploy edge functions
Simplest + safe (idempotent): deploy all.
```bash
npx supabase functions deploy
```
If you prefer the explicit changed set (H1 v9.354 + post-H1 fixes through v9.381):
```bash
npx supabase functions deploy \
  ai-batch-worker enqueue-ai-batch push-worker trigger-checkin-reminders \
  strava-backfill-worker adjust-coach-plan analyse-session embed-session \
  send-push generate-report comment-notification \
  ai-proxy redeem-invite public-api alert-monitor operator-digest \
  parse-activity dodo-webhook attribution-log
```
(Per-version: H1 = first 11; v9.364 ai-proxy/redeem-invite; v9.366 public-api/alert-monitor; v9.372 operator-digest/adjust-coach-plan; v9.374 analyse-session/parse-activity; v9.375 dodo-webhook/trigger-checkin/push-worker; v9.376 attribution-log/public-api; v9.381 generate-report.)

---

## Phase D — verify (expect the ✓ result)
```bash
# 1. No cron/function still carries the literal leaked bearer  → expect 0 rows
DBQ "SELECT jobname FROM cron.job WHERE command ILIKE '%Bearer eyJ%';"
# 2. Webhook-secret header landed on the 7 hardened crons       → all 't'
DBQ "SELECT jobname, command ILIKE '%x-sporeus-webhook-secret%' AS patched
     FROM cron.job WHERE jobname IN ('ai-batch-worker','enqueue-ai-batch',
       'generate-report-weekly','generate-report-monthly-squad','push-worker',
       'strava-backfill-worker','trigger-checkin-reminders') ORDER BY 1;"
# 3. tier_for_user exists + status-aware                        → returns a tier or 'free'
DBQ "SELECT public.tier_for_user('00000000-0000-0000-0000-000000000000');"
```
App-level smoke (a few minutes after deploy):
- A normal user logs a session → `on_training_log_embed` → `embed-session` 200s (Supabase function logs).
- A **free** user hitting `generate-report` (any kind) → **403** "PDF report export requires a Coach or Club plan".
- A coach weekly/monthly report still generates.
- Background workers (push-worker, ai-batch-worker) show no 401s in logs.

## Rollback
If background jobs 401 after deploy: edge `WEBHOOK_SECRET` ≠ DB `app.webhook_secret` (re-set both, no stray whitespace). To revert a function: `git show <prev>:supabase/functions/<fn>/index.ts` and redeploy. Migrations are forward-only; leaving them applied is harmless.
