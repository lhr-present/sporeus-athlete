# Rotation + GUC checklist (operator)

> ⚠️ NEVER commit secret VALUES to this repo (it is public — that's how the
> service_role key leaked). Values live in: edge env (`WEBHOOK_SECRET`), the
> `cron.job` commands (DB), and the Supabase Dashboard. Retrieve them there.

## Current state (set 2026-06-16)
- Edge env `WEBHOOK_SECRET` is **set** (64-hex).
- The 7 hardened cron jobs + `on_training_log_embed()` send
  `x-sporeus-webhook-secret: <that value>` as a **literal** (not yet via GUC).
- Hardened workers verify it (200 with secret / 401 without). All green.
- The leaked **service_role** JWT is STILL the live key and is still hardcoded as the
  `Authorization: Bearer` in the cron commands (now redundant — auth is the secret).

---
## 1. 🔴 Rotate the leaked service_role key (top priority)
The leaked key is the legacy JWT-secret-derived `service_role` JWT (`anon` is also a
legacy JWT, baked into the client build).

1. **Dashboard → Settings → API → JWT Settings → "Generate new JWT secret"** (rotates
   the secret → regenerates `anon` + `service_role`).
   - ⚠️ This **invalidates every existing user session** (athletes/coaches get logged
     out) and the old `anon`/`service_role` JWTs. Do it in a low-traffic window.
2. **Client (turnkey anon-key swap) — see §1b below.** The new `anon` key is baked
   into the bundle at build time, so the client must be rebuilt + redeployed.
3. **Edge functions:** `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` envs are
   Supabase-managed and update automatically — but redeploy the functions afterward to
   be safe and confirm via a smoke test (the workers don't depend on the bearer JWT
   anymore; they auth on `WEBHOOK_SECRET`, so they'll keep working).
4. **Clean up the stale JWT in cron commands:** the old `Bearer <service_role JWT>` in
   each `cron.job.command` is now an invalid, leaked string. Replace it (see §2 GUC,
   or apply `20260603_service_role_key_from_guc.sql` which sources it from a GUC).
5. **Verify:** `select status_code, count(*) from net._http_response where created >
   now() - interval '10 min' group by 1;` → expect 200s, no 401.

### 1b. Turnkey anon-key swap (post-rotation)
⏱️ **Sequencing matters:** the moment you regenerate the JWT secret, the OLD anon key
is invalid → the live client (built with the old anon) **can't authenticate** until you
redeploy. Have the new key ready and do steps 1→3 back-to-back to minimize the window.

The prod anon key lives in **two** GitHub Actions repo secrets (the test project uses
separate `SUPABASE_TEST_*` secrets):
- `VITE_SUPABASE_ANON_KEY` — baked into the client build (deploy.yml) ← matters for prod
- `SUPABASE_ANON_KEY` — used by CI harnesses (lighthouse/bundle/e2e/rls)

**1. Copy the new anon key:** Dashboard → Settings → API → Project API keys → `anon` `public` (the `eyJ…` JWT).

**2. Update both secrets** (repo `lhr-present/sporeus-athlete`):
```bash
gh secret set VITE_SUPABASE_ANON_KEY --repo lhr-present/sporeus-athlete --body "<NEW_ANON_JWT>"
gh secret set SUPABASE_ANON_KEY      --repo lhr-present/sporeus-athlete --body "<NEW_ANON_JWT>"
```
(or UI: repo → Settings → Secrets and variables → Actions → update each.)

**3. Rebuild + redeploy** (no code change — the secret is read at build time):
```bash
gh workflow run deploy.yml --repo lhr-present/sporeus-athlete --ref main
gh run watch --repo lhr-present/sporeus-athlete    # or: gh run list --workflow=deploy.yml
```
(Equivalently, push any commit to `main`.) The job runs lint+test+version-sync+build+e2e and
publishes to Pages only if green (version-sync passes at v9.399). **Merge PR #4 first** if you
want the new client features in this same deploy.

**4. Verify:** workflow green → hard-refresh `https://lhr-present.github.io/sporeus-athlete/`,
sign in fresh (everyone was logged out by the rotation), confirm auth + a Supabase read work.
Browser 401s show in Dashboard → Logs → API (the `net._http_response` query covers cron/pg_net, not browser).

**service_role after rotation:** edge `SUPABASE_SERVICE_ROLE_KEY` is Supabase-managed and
auto-updates; the stale old service_role JWT in the cron `Bearer` headers is **ignored**
(workers auth on `WEBHOOK_SECRET`, `verify_jwt=false`) so crons keep working — clean those
headers per §1.4 / §2 at leisure.

## 2. (Optional, cleanliness) Move the webhook secret from literal → GUC
The literal-in-cron secret works and is no worse-exposed than the JWT was, but the
GUC form is cleaner and lets you rotate in one place.

1. Set the GUC to the **current** `WEBHOOK_SECRET` value (must match the edge env):
   - Dashboard SQL editor (runs as a higher-priv role than the API):
     `ALTER DATABASE postgres SET app.webhook_secret = '<WEBHOOK_SECRET value>';`
     (The MCP/API `postgres` role gets "permission denied" for this — use the
     Dashboard SQL editor or Database → Configuration custom params.)
2. Apply the GUC-form migration: `supabase/migrations/20260601_webhook_secret_headers.sql`
   (re-patches the crons + trigger to use `current_setting('app.webhook_secret', true)`
   instead of the literal). Idempotent.
3. Verify the same `net._http_response` query → 200s.

## 3. (After §2) Rotate the webhook secret itself
1. Generate a new value: `openssl rand -hex 32`.
2. `supabase secrets set WEBHOOK_SECRET=<new>` (edge env).
3. Update the GUC: `ALTER DATABASE postgres SET app.webhook_secret = '<new>';` (Dashboard).
   (If still on the literal form, re-patch the crons with the new value instead.)
4. Verify 200s.

## Smoke test for any of the above
```sql
select count(*) filter (where status_code=200) ok,
       count(*) filter (where status_code=401) unauthorized,
       count(*) filter (where status_code>=500) server_err
from net._http_response where created > now() - interval '10 minutes';
```
Expect `unauthorized=0, server_err=0`.
