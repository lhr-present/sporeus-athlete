# Strava Integration Audit — 2026-06-17 (v9.433)

Full audit of the Strava connection from zero (client OAuth flow + server edge/token/sync/
backfill), via 2 agents + live prod verification.

## Verdict
The **core path is sound and fully provisioned** — it was not broken in code; the blockers
were build-env wiring + (operator) Strava-app/secret config. Happy path (verified):

`StravaConnect` (Profile) → `initiateStravaOAuth()` builds the authorize URL (scope
`activity:read_all`, `redirect_uri`, `state=strava`) → Strava → browser returns to
`app.sporeus.com/?code=…&state=strava` → `useAppState.js` captures it, strips params →
`exchangeStravaCode(code)` → `supabase.functions.invoke('strava-oauth', {action:'connect', code,
redirectUri})` → edge fn verifies JWT, POSTs to Strava token endpoint with
`STRAVA_CLIENT_ID/SECRET`, upserts `strava_tokens`, enqueues 90-day backfill → immediate
`triggerStravaSync()` (action `sync`) pulls 30 days into `training_log` (`source='strava'`,
`onConflict user_id,external_id`) → UI re-reads.

## Live prod — all GOOD (verified 2026-06-17)
- `strava-oauth` (verify_jwt=true) + `strava-backfill-worker` (verify_jwt=false) deployed (401 no-auth).
- `strava_tokens` (10 cols) RLS-enabled, owner policy `auth.uid()=user_id`; service role bypasses for edge writes.
- `training_log` UNIQUE index `(user_id, external_id)` → dedup works; `source` enum includes `strava`.
- `strava_rate_state` row id=1; pgmq `strava_backfill` queue + `enqueue/read/delete_strava_backfill`
  RPCs (SECURITY DEFINER, EXECUTE service_role-only). Cron job `strava-backfill-worker` `*/2min`
  active, sends `x-sporeus-webhook-secret`. Edge secrets `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` set.
- Token refresh (`refreshIfExpired`, 5-min skew) implemented before sync/backfill page fetch.

## FIXED in v9.433 (code)
- **deploy.yml** now injects `VITE_STRAVA_REDIRECT_URI` at build (was omitted → prod used the
  dynamic origin; harmless on app.sporeus.com but now deterministic + must match the Strava
  callback domain). No regression if the secret is unset (falls back to live origin).
- **StravaConnectInContext.jsx** — the in-context connect button invoked `strava-oauth` with NO
  `code` and expected a `res.data.url` the edge fn never returns (did nothing). Now routes through
  `initiateStravaOAuth()` like the working Profile button. (Component is currently unmounted; trap removed.)
- **strava-backfill-worker** — `MAX_REQUESTS` 600 → 90 (Strava's documented app limit is 100/15min;
  600 risked 429s at scale). Deployed to prod.

## OPERATOR — to fully enable the connection (external / secret, can't be tooled)
1. **GitHub repo secret `VITE_STRAVA_REDIRECT_URI` = `https://app.sporeus.com/`** (trailing slash;
   must byte-match what Strava has registered + what the client sends). Also verify
   `VITE_STRAVA_CLIENT_ID` secret = the Strava app's Client ID.
2. **Strava developer app dashboard:** set **Authorization Callback Domain = `app.sporeus.com`**;
   ensure the app grants **`activity:read_all`** (plain `activity:read` hides most activities).
3. Edge secrets `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` (same Strava app) — already set.
4. **Local dev** (`.env.local`): add `VITE_STRAVA_CLIENT_ID=<id>` + `VITE_STRAVA_REDIRECT_URI=http://localhost:5173/`
   (and register that origin at Strava too if testing locally).

Once #1+#2 are in place, click Connect → Strava consent → return → activities sync. The code
needs no further change.

## DEFERRED / notes
- Static `state:'strava'` (no CSRF nonce) — LOW; `state` is only a callback router discriminator
  (`useAppState` checks `state==='strava'`), so a random nonce would need storing+validating; left as-is.
- No Strava push webhook — sync is pull-only (foreground sync + `*/2min` backfill drain). Near-real-time
  would be new work (webhook subscription + endpoint).
- `last_sync_at` not set by the backfill worker on success (only foreground sync sets it) — sync-health
  UI under-reports backfill progress; cosmetic. LOW.
- Dead client-import code (`importStravaActivities`/`stravaToEntry` in strava.js, disabled v9.90) retained
  + still unit-tested but never runs (live path is the edge fn). Not a bug.
- Service-role JWT embedded in the cron command (plaintext) — consistent w/ system; webhook-secret is the
  real auth boundary; flagged for the ongoing key-hygiene effort.
