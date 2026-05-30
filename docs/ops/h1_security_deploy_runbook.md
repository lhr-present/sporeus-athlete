# H1 — Edge-function security deploy runbook

**What this is:** the coordinated rollout for the v9.354 hardening, which replaced
a forgeable unsigned-JWT `role==='service_role'` check with a constant-time
`x-sporeus-webhook-secret` shared-secret check (`supabase/functions/_shared/serviceAuth.ts`).

**Why it needs a runbook:** the hardened functions **fail closed** when the secret
is absent. If you `supabase functions deploy` them before the secret exists on
BOTH sides (edge env + the SQL callers), every cron/trigger/webhook invocation
gets 401 and background jobs silently stop. Order matters.

**Hardened functions:** ai-batch-worker, enqueue-ai-batch, push-worker,
trigger-checkin-reminders, strava-backfill-worker, adjust-coach-plan,
analyse-session, embed-session, send-push, generate-report. (comment-notification
is unchanged but forwards the secret to send-push.)

---

## Step 0 — choose the secret
Generate a long random value once, e.g. `openssl rand -hex 32`. Call it `<SECRET>`.

## Step 1 — set the secret on BOTH sides (do this BEFORE deploying functions)

**Edge env** (read by `serviceAuth.ts` via `Deno.env.get('WEBHOOK_SECRET')`):
```bash
cd ~/sporeus-athlete-app
supabase secrets set WEBHOOK_SECRET=<SECRET>
```

**Database GUC** (read by the cron/trigger headers via `current_setting('app.webhook_secret')`):
```bash
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "ALTER DATABASE postgres SET app.webhook_secret = '<SECRET>';"
```
> The `ALTER DATABASE ... SET` value applies to **new** sessions. pg_cron starts a
> fresh session per run, so cron jobs pick it up on their next tick. To confirm:
> open a new connection and `SHOW app.webhook_secret;`.

## Step 2 — apply the cron/trigger header migration
Adds the `x-sporeus-webhook-secret` header to the 7 hardened cron jobs + the
`on_training_log_embed` trigger. Safe to apply before the functions are deployed
(old functions ignore the extra header).
```bash
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  < supabase/migrations/20260601_webhook_secret_headers.sql

# record it
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase/access-token) \
  npx supabase db query --linked \
  "INSERT INTO supabase_migrations.schema_migrations (version,name,statements)
     VALUES ('20260601','webhook_secret_headers',NULL) ON CONFLICT (version) DO NOTHING;"
```
**Verify the patch took** (every job should show `t`):
```sql
SELECT jobname, command ILIKE '%x-sporeus-webhook-secret%' AS patched
FROM cron.job
WHERE jobname IN ('ai-batch-worker','enqueue-ai-batch','generate-report-weekly',
  'generate-report-monthly-squad','push-worker','strava-backfill-worker',
  'trigger-checkin-reminders')
ORDER BY 1;
```
The migration RAISEs a WARNING for any job it could not pattern-match — if you
see one, patch that job's `cron.schedule(...)` header by hand before continuing.

## Step 3 — deploy the hardened functions
```bash
supabase functions deploy ai-batch-worker enqueue-ai-batch push-worker \
  trigger-checkin-reminders strava-backfill-worker adjust-coach-plan \
  analyse-session embed-session send-push generate-report comment-notification
```

## Step 4 — verify (within a few minutes)
- `push-worker` runs every minute and `strava-backfill-worker` every 2 min — the
  fastest canaries. Check they return 200, not 401:
  ```sql
  SELECT j.jobname, r.status, r.return_message, r.start_time
  FROM cron.job_run_details r JOIN cron.job j USING (jobid)
  WHERE j.jobname IN ('push-worker','strava-backfill-worker')
  ORDER BY r.start_time DESC LIMIT 6;
  ```
- Edge function logs (dashboard) for those functions should show no
  `isVerifiedServiceCall` rejections.
- Log a training session as a normal user → `on_training_log_embed` fires
  `embed-session`; confirm it 200s.
- adjust-coach-plan / analyse-session are exercised by normal in-app use
  (user-JWT path) — confirm a coach plan adjust + a session analysis still work.

## Rollback
If background jobs 401 after deploy: the secrets don't match. Re-check Step 1
(edge `WEBHOOK_SECRET` === DB `app.webhook_secret`, no stray whitespace). As a
fast revert, redeploy the previous function versions from git
(`git show <prev>:supabase/functions/<fn>/index.ts`). The cron migration is
harmless to leave in place (the extra header is ignored by un-hardened functions).

---

## ⚠️ Related finding discovered during prep (separate from H1)
Several SQL callers embed a **hardcoded `service_role` JWT** in their headers
(e.g. `20260424_add_push_worker_cron.sql`, `on_training_log_embed`). That key is
in the git history. Recommend, as a follow-up: **rotate the service_role key**,
move all SQL callers to `current_setting('app.service_role_key')`, and scrub the
literal from future migrations. Not required for H1, but it's a real exposure.
