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

## Step 3 — deploy the hardened functions **plus the later-changed ones**
The H1-hardened set is the first line. The second line is functions that were
**fixed after H1 but never deployed** (CI deploys only the frontend, never edge
functions) — leave them off and those fixes stay stranded:
- v9.364 — `ai-proxy` (atomic AI-usage quota), `redeem-invite` (server-side athlete-limit)
- v9.366 — `public-api` (squad RPC), `alert-monitor` (sent_at column)
- v9.372 — `operator-digest` (distinct-user MAU/DAU + notified-by-id)

> Note: `operator-digest` is **not** H1-hardened (no webhook-secret gate), so it's
> safe to deploy in any order — it just needs to ship to pick up the v9.372 fix.

```bash
supabase functions deploy ai-batch-worker enqueue-ai-batch push-worker \
  trigger-checkin-reminders strava-backfill-worker adjust-coach-plan \
  analyse-session embed-session send-push generate-report comment-notification \
  ai-proxy redeem-invite public-api alert-monitor operator-digest
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

## 🔴 CRITICAL — committed `service_role` key (PUBLIC repo) — ROTATE NOW

Discovered during H1 prep, then confirmed: a **valid `service_role` JWT**
(`role: service_role`, `ref: pvicqwapvvfempjdgwbm`, `exp` ~2036) is hardcoded in
committed SQL — `20260424_add_push_worker_cron.sql`,
`20260424_enhancements_embed_trigger_mv_revoke.sql`,
`20260424_fix_purge_cron_hardcode_jwt.sql`, `20260424_missing_crons_and_fns.sql`
(and `supabase/tests/rls/pentest/personas.ts`). The GitHub repo is **public**, so
this key — which **bypasses all RLS** — is exposed to the world. This is more
urgent than H1 itself.

### Step A — ROTATE immediately (do this first, before anything else)
Supabase Dashboard → Project Settings → API → **roll/reset the `service_role`
key**. This instantly invalidates the leaked JWT. Scrubbing git history does NOT
substitute for rotation (the key is already public/clonable/indexed).

### Step B — expect these to recover differently
- **Edge functions** read `SUPABASE_SERVICE_ROLE_KEY` from env (Supabase
  auto-provides the new value) → recover automatically after redeploy/restart.
- **Cron jobs + `on_training_log_embed`** hardcode the OLD JWT in their headers →
  they will **401 after rotation** until updated. Fix by moving them to the GUC:
  ```sql
  ALTER DATABASE postgres SET app.service_role_key = '<NEW service_role key>';
  ```
  then re-author each affected cron/trigger header to
  `'Bearer ' || current_setting('app.service_role_key')` (no literal key). This
  is the same set of callers patched in `20260601`; do both in one window.

### Step C — prevent recurrence
- Never put a `service_role` key in SQL or any committed file. Source it from the
  GUC (DB) or `Deno.env` (edge) only.
- Consider making the repo private, and/or `git filter-repo` to purge the literal
  from history *after* rotation (defense-in-depth, not a substitute for Step A).
