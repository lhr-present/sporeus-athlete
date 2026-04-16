# Sporeus Athlete App — Full-Stack Audit Report v7.19
**Date:** 2026-04-16  
**Audited Commit:** 39b6807 (v7.19: AI Coach Insights dashboard card)  
**Auditor:** Claude Sonnet 4.6 (automated, 7-phase)  
**Test baseline:** 1370 / 1370 passing across 105 test files

---

## Executive Summary

The worst finding is a **payment webhook bypass**: `dodo-webhook/index.ts` reads `DODO_WEBHOOK_SECRET` with a `?? ""` fallback, so if the env var is not set the HMAC check succeeds for any attacker request signed with an empty key — allowing an adversary to grant themselves `club` tier for free. Second, the `referral_codes` UPDATE policy is `USING (true)`, meaning any authenticated user can overwrite another coach's `uses_count` or reset it to zero. Third, the `ai-proxy` daily-usage counter uses a SELECT-then-INSERT pattern (TOCTOU) that allows a race-condition double-spend of the per-day AI quota. Beyond these three, the audit found a broken ISO-week formula in the public API CSV export, 63 ESLint warnings failing CI's `--max-warnings 0` gate, and a version string mismatch (footer still shows v7.14.0). Positive findings are significant: all other RLS policies are correct, auth is properly JWT-gated on every edge function, no secrets are committed to git, the build is clean, and 1370 tests are green.

---

## CRITICAL Findings

### C-1 — Payment Webhook Bypass: Empty-Secret HMAC Fallthrough
**File:** `supabase/functions/dodo-webhook/index.ts`  
**Evidence:**
```typescript
// Line 12
const DODO_SECRET   = Deno.env.get("DODO_WEBHOOK_SECRET") ?? ""
const STRIPE_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""

// Line 129
const valid = await verifyHMAC(body, sig, DODO_SECRET)
// No guard: if DODO_SECRET === "" the HMAC always verifies against whatever
// the caller sends as an "empty-key HMAC" — a trivially computable value.
```
**Impact:** If `DODO_WEBHOOK_SECRET` is absent from Supabase edge-function secrets (e.g. after a new environment provisioning, CI/CD secret rotation lag, or accidental deletion), any external caller can:
1. Compute `HMAC-SHA256("", payload)` locally.
2. POST `{ "type": "payment.succeeded", "metadata": { "user_id": "victim-uuid", "tier": "club" } }` to the webhook URL.
3. Receive an immediate `club` tier upgrade in the `profiles` table — with no payment.

The same applies to `STRIPE_WEBHOOK_SECRET`.

**Proposed Fix:**
```diff
// dodo-webhook/index.ts — after line 12
+ if (!DODO_SECRET)   throw new Error("DODO_WEBHOOK_SECRET not configured")
+ if (!STRIPE_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not configured")
```
Add this guard immediately after the constants (before `serve()`), so the function fails at cold start rather than silently accepting unauthenticated requests.

---

### C-2 — AI Daily-Quota TOCTOU Race Condition
**File:** `supabase/functions/ai-proxy/index.ts`  
**Evidence:**
```typescript
// Lines 60-70: SELECT count, then INSERT — no transaction / no unique constraint guard
const { count } = await supabase
  .from('ai_insights')
  .select('*', { count: 'exact', head: true })
  .eq('athlete_id', user.id)
  .eq('date', today)

if ((count ?? 0) >= limit) {
  return err(`Daily AI limit reached...`, 429)
}

// ↑ Gap here — two concurrent requests both read count=0, both pass the check
// and both call Anthropic, burning two quota slots.
```
Additionally, the client-side `handleGenerate` in `AICoachInsights.jsx` inserts with `data_hash: \`on-demand-${Date.now()}\`` — a unique key per millisecond — which means repeated rapid clicks (even with the `generating` guard) can generate duplicate calls if the UI state resets (e.g. page refresh) before the INSERT completes.

**Impact:** For a `coach` tier user (50 calls/day) two concurrent tab opens or a network retry can double-spend. For `club` tier (500 calls/day) this is a direct cost runaway vector. No hard monthly cost cap exists anywhere in the codebase.

**Proposed Fix:**
Option A (DB constraint — recommended): Add a partial unique index on `ai_insights`:
```sql
CREATE UNIQUE INDEX ai_insights_one_per_day
  ON ai_insights (athlete_id, date)
  WHERE data_hash = 'on-demand';
```
Option B (Postgres advisory lock in the edge function):
```typescript
// Replace SELECT-count with an atomic INSERT-or-409:
const { error: insertErr } = await supabase.from('ai_insights').insert(
  { athlete_id: user.id, date: today, data_hash: 'lock', insight_json: null },
  { onConflict: 'athlete_id,date,data_hash' }  // unique constraint already exists
)
if (insertErr?.code === '23505') return err('Daily AI limit reached', 429)
```

---

## HIGH Findings

### H-1 — RLS: `referral_codes` UPDATE USING (true) — Any User Can Manipulate Counts
**File:** `supabase/migrations/20260413_referral.sql`  
**Evidence:**
```sql
-- Line 40-42
CREATE POLICY "authenticated updates referral code"
  ON referral_codes FOR UPDATE
  USING (true);   -- ← ANY authenticated user can UPDATE ANY row
```
Combined with the client-side read-modify-write in `src/lib/referral.js` (SELECT uses_count, then UPDATE with newCount), an attacker can:
- Zero out a competitor coach's `uses_count` (denial of reward).
- Increment their own count to trigger `reward_granted` milestones.
- Set `uses_count` to an arbitrary value.

**Impact:** Referral rewards (1 month free per 3 referrals) can be fabricated or stolen. This is a billing-integrity issue.

**Proposed Fix:**
```sql
-- Replace the permissive UPDATE policy with a column-level or RPC approach:
DROP POLICY "authenticated updates referral code" ON referral_codes;

-- Increment via server-side RPC instead (service-key in edge function):
CREATE OR REPLACE FUNCTION increment_referral_uses(p_code TEXT, p_applier_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE referral_codes
     SET uses_count = uses_count + 1
   WHERE code = p_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION increment_referral_uses FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION increment_referral_uses TO service_role;
```

### H-2 — SPUNLOCK Code Generator Gated on Mutable localStorage Name String
**File:** `src/components/Profile.jsx`  
**Evidence:**
```jsx
// Lines 507-510
{(local.name?.toLowerCase().includes('hüseyin') || 
  local.name?.toLowerCase().includes('huseyin') || 
  local.email === 'huseyinakbulut@marun.edu.tr') && (
  <AdminCodeGenerator/>
)}
```
`local` is the profile loaded from localStorage (`sporeus-profile`). Any user can open DevTools → Application → localStorage → set `sporeus-profile.name` to "huseyin" → reload → gain access to the `AdminCodeGenerator`.

**Impact:** SPUNLOCK codes are cryptographically valid (`generateUnlockCode` uses SHA-256 + a salt hardcoded in `formulas.js`). Because both the salt (`sporeus-master-2026`) and the algorithm are shipped in the public bundle, any user who reads `formulas.js` can generate their own SPUNLOCK codes without needing the UI at all. The salt being in public JS is the root issue; the admin gate makes it marginally worse.

**Proposed Fix (short term):** Gate on `authProfile.role === 'admin'` from the server-verified Supabase profile instead of localStorage name.  
**Proposed Fix (long term):** Move code generation to a service-role edge function with hard admin check; remove MASTER_SALT from the client bundle.

### H-3 — `team_announcements` RLS SELECT USING (true) — Any Authenticated User Reads All Announcements
**File:** `supabase/migrations/20260417_team_announcements.sql`  
**Evidence:**
```sql
-- Line 11
CREATE POLICY "ta_athlete_read" ON public.team_announcements FOR SELECT USING (true);
```
**Impact:** Every authenticated Sporeus user can query all coach announcements from all orgs. While announcement content is not highly sensitive (max 280 chars), it leaks coach/squad names, schedules, and internal notes from every club in the database.

**Proposed Fix:**
```sql
DROP POLICY "ta_athlete_read" ON public.team_announcements;

CREATE POLICY "ta_athlete_read" ON public.team_announcements
  FOR SELECT USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coach_athletes ca
      WHERE ca.coach_id = team_announcements.coach_id
        AND ca.athlete_id = auth.uid()
        AND ca.status = 'active'
    )
  );
```

### H-4 — Version String Stale in App Footer
**File:** `src/App.jsx`, line 311  
**Evidence:**
```jsx
SPOREUS ATHLETE CONSOLE v7.14.0 · SPOREUS.COM
```
Current git tag and package.json are at v7.14.0 but the latest commit is v7.19. The footer was not updated during the v7.15–v7.19 refactor/feature chain.  
**Impact:** User confusion; support tickets mismatch; build version diverges from displayed version.

**Proposed Fix:**
```diff
- SPOREUS ATHLETE CONSOLE v7.14.0 · SPOREUS.COM
+ SPOREUS ATHLETE CONSOLE v{APP_VERSION} · SPOREUS.COM
```
Where `APP_VERSION` is imported from `package.json` via `import pkg from '../../package.json'` (Vite supports this) or injected via `define` in `vite.config.js`.

---

## MEDIUM Findings

### M-1 — ISO Week Number Formula Bug in Public API CSV Export
**File:** `supabase/functions/public-api/index.ts`, line 160  
**Evidence:**
```typescript
const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, "0")}`
```
`d.getDate()` returns the day-of-month (1–31). `Math.ceil(1/7) = 1`, which resets to W01 at the start of every month. A date of 2026-02-01 (ISO week 05) is incorrectly labelled `2026-W01`. Sessions spanning a month boundary are split into different "weeks" than ISO standard.

**Demonstration:**
```
2026-01-31 → 2026-W05 (correct by coincidence)
2026-02-01 → 2026-W01 (wrong — ISO week 05)
2026-02-07 → 2026-W01 (wrong — ISO week 05)
2026-02-08 → 2026-W02 (wrong — ISO week 06)
```
**Impact:** CSV exports used by coaches in Excel/Sheets show fractured weekly data; load trends will appear artificially spiked/flat at month boundaries.

**Proposed Fix:**
```typescript
// Replace with proper ISO week calculation:
function getISOWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}
// Line 160:
- const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, "0")}`
+ const week = getISOWeek(d)
```

### M-2 — No Hard Monthly Cost Cap on AI Proxy
**File:** `supabase/functions/ai-proxy/index.ts`  
**Evidence:** No monthly or all-time spend cap exists. TIER_LIMITS only enforce per-day. A `club` user with 500 calls/day × 30 days = 15,000 Haiku calls/month per user is unbounded. With 100 club users, worst case = 1.5M Haiku calls/month (~$750/month at current pricing) with no circuit breaker.  
**Impact:** Cost runaway if a club grows or a user automation script hammers the endpoint.  
**Proposed Fix:** Add a monthly count query (same pattern as daily) or use Anthropic usage limits dashboard + set a project spend limit.

### M-3 — Prompt Injection Surface: `insight.summary` Passed Unsanitized Back to LLM
**File:** `src/components/dashboard/AICoachInsights.jsx`, line 110  
**Evidence:**
```javascript
user_msg: `Explain the reasoning behind: "${insight.summary}"`,
```
`insight.summary` is LLM-generated text that was stored in the database. If a previous LLM call was manipulated (e.g. via a prompt-injected training note — `notes` field is not included in the current prompt, so risk is low), the summary could contain injection text that is then passed back to the LLM in the "Why?" call.

**Impact:** Low-moderate. The system prompt is short and constrained; the output goes only to the current user. No data exfiltration path exists. However, it's a best-practice violation.  
**Proposed Fix:** Truncate `insight.summary` to 300 chars and strip newlines before embedding in the follow-up prompt.

### M-4 — Referral Counter Read-Modify-Write TOCTOU (Client-Side)
**File:** `src/lib/referral.js`, lines 34–44  
**Evidence:**
```javascript
const { data } = await supabase.from('referral_codes').select('coach_id, uses_count').eq('code', code).maybeSingle()
const newCount = (data.uses_count ?? 0) + 1
await supabase.from('referral_codes').update({ uses_count: newCount }).eq('code', code)
```
Two simultaneous sign-ups with the same referral code will both read `uses_count=N`, compute `N+1`, and both write `N+1` — the second write wins and the count ends up as N+1 instead of N+2.  
**Impact:** Reward milestones (every 3 uses) may never trigger if concurrent sign-ups are common. Tied to H-1; the RPC fix there resolves this as well.

### M-5 — ESLint CI Gate Broken: 63 Warnings With `--max-warnings 0`
**Files:** Multiple `src/lib/sport/` files  
**Evidence:**
```
✖ 63 problems (0 errors, 63 warnings)
ESLint found too many warnings (maximum: 0).
```
Key warnings:
- `src/lib/sport/runningTemplates.js`: `predictRaceTime`, `vdotFromRace` defined but never used
- `src/lib/sport/simulation.js`: `DEFAULT_K1`, `DEFAULT_K2`, `BIKERUN_TYPES` assigned but never used
- `src/lib/sport/triathlon.js`: `powerTSS` defined but never used
- `src/lib/vdot.js`: `secToMinSec` defined but never used  

**Impact:** CI lint step will fail if it runs `npm run lint` (or `npx eslint src/ --max-warnings 0`). Dead exports also inflate the bundle slightly.  
**Proposed Fix:** Either prefix unused vars with `_` to match the ESLint allow pattern, or remove dead exports.

### M-6 — No `.nvmrc` / `engines` Field — Node Version Unspecified
**File:** `package.json`  
**Evidence:** `engines: {}`, no `.nvmrc` present. Current system node is v18.19.1; `eslint-visitor-keys@5.0.1` (pulled by madge) emits an EBADENGINE warning requiring `^20.19.0 || ^22.13.0 || >=24`.  
**Impact:** CI/CD or new contributor environments may silently use Node 16/18 and hit subtle compatibility issues with newer tooling.  
**Proposed Fix:** Add `.nvmrc` with `20` and add `"engines": { "node": ">=20" }` to `package.json`.

---

## LOW Findings

### L-1 — `src/App.jsx` Uses Raw `localStorage.getItem` Outside `useLocalStorage`
**File:** `src/App.jsx`, multiple lines  
**Evidence:**
```javascript
// Lines 117, 157, 168, 356, 376 — direct localStorage calls bypassing the
// QuotaExceededError-safe useLocalStorage hook
localStorage.getItem('sporeus-consent-v1')
localStorage.getItem('sporeus-guest-mode')
localStorage.removeItem('sporeus-guest-mode')
```
**Impact:** Crashes on storage-full (Safari Private Browsing). Low risk given typical data volumes, but inconsistent with the project's own convention.

### L-2 — `useRealtimeSquad` Reads Tier From localStorage for Feature Gate
**File:** `src/hooks/useRealtimeSquad.js`, line 27  
**Evidence:**
```javascript
const tier = (() => { try { return localStorage.getItem('sporeus-tier') || 'free' } catch { return 'free' } })()
```
This is a client-side feature gate that a user could bypass by editing localStorage (e.g. set `sporeus-tier` to `club`). The actual Supabase realtime channel subscription would then activate, but data returned through RLS would still be correct for the user's actual tier. Impact is cosmetic (UI shows realtime panel) but it's a gate-bypass pattern to avoid.

### L-3 — `nightly-batch` Has No Auth on the HTTP Endpoint
**File:** `supabase/functions/nightly-batch/index.ts`  
**Evidence:** The `serve(async (req) => {...})` handler has no JWT/auth check. The function is designed to be called by pg_cron with the service_role Bearer token, but there is no code that verifies the incoming Authorization header.  
**Impact:** Anyone who knows the function URL can trigger a full nightly batch run (burning Anthropic quota for all athletes). The pg_cron setup uses the service role key, but the function itself does not enforce this. Add a check: `if (req.headers.get('Authorization') !== \`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}\`) return 403`.

### L-4 — CLAUDE.md Test Count Stale (Says 860, Reality Is 1370)
**File:** `CLAUDE.md`  
**Evidence:** `Target: keep all 860 tests green before every commit.` — actual run: `Tests 1370 passed (1370)`.  
**Impact:** Documentation only; no runtime effect. Update CLAUDE.md baseline.

### L-5 — `jsQR` Library in Main Bundle (47 kB gzip, QR Scanning Not Core)
**File:** Build output  
**Evidence:**
```
dist/assets/jsQR-C-ArDfkf.js    130.72 kB │ gzip: 47.28 kB
```
jsQR is loaded eagerly. If QR check-in is only used by coaches in the Club tier, it should be lazy-loaded like `Glossary` and `PlanGenerator`.  
**Impact:** ~47 kB added to initial parse for all users. Medium performance cost, especially on mobile.

### L-6 — `manifest.webmanifest` Missing `screenshots` and `categories` Fields
**File:** `public/manifest.webmanifest`  
**Evidence:** Manifest has `icons`, `name`, `theme_color`, etc. but lacks `screenshots` (required for "Add to Home Screen" enhanced install prompt in Chrome 119+) and `categories` (used for app store discovery).  
**Impact:** Reduced PWA installability UX. Not a crash, but misses a chance for better store-like prompts.

### L-7 — Token Usage Not Logged
**File:** `supabase/functions/ai-proxy/index.ts`  
**Evidence:** `anthData.usage` (containing `input_tokens` and `output_tokens`) is returned by Anthropic but never stored or logged. The `ai_insights` table has no token columns.  
**Impact:** No cost attribution per user, no ability to detect unusually expensive prompts, no audit trail for Anthropic billing reconciliation.

---

## Already Good

- **All edge functions are JWT-gated.** Every function (ai-proxy, squad-sync, strava-oauth, send-push, device-sync, redeem-invite) validates the Bearer JWT via `supabase.auth.getUser()` before proceeding. The pattern is consistent.
- **Tier gating is server-side.** `ai-proxy` reads `subscription_tier` from the `profiles` DB table, not from the JWT claim. Free users correctly receive 403.
- **RLS is comprehensive.** All 18+ user-data tables have RLS enabled. All PII tables (training_log, recovery, injuries, test_results, race_results, strava_tokens, push_subscriptions, athlete_devices, consents) have correct `auth.uid() = user_id` policies with both `USING` and `WITH CHECK` clauses. No `USING (true)` on PII tables.
- **No secrets committed.** `grep -rnE "sk-ant-|AKIA..."` found only the anon key in `.env.local` (gitignored, never committed). Git history scan shows no leaked API keys.
- **VITE_ vars are not secrets.** All VITE_ env vars are public-safe (Supabase anon key, VAPID public key, Strava client ID). No secret keys are exposed browser-side.
- **Build is clean.** 0 build errors, no warnings. All 32 chunks are within reasonable size; largest gzip chunk is vendor-recharts at 114 kB.
- **Test coverage is strong.** 1370 tests across 105 files, all passing in 8.9 s. No circular dependencies found.
- **CORS wildcards are justified.** The public-api `USING (*)` is intentional (Excel/Sheets integration) and documented; all other CORS wildcard headers are restricted to the anon key + content-type headers only.
- **Webhook HMAC verification is correct in logic.** The constant-time comparison in `verifyHMAC` is properly implemented. The only flaw is the empty-secret fallthrough (C-1 above).
- **AsyncBoundary wraps all tabs.** Every lazy-loaded tab is wrapped in `AsyncBoundary` (ErrorBoundary + Suspense). New-user empty states are handled in Dashboard (TSS chart, InsightsPanel guards on log.length).
- **GDPR compliance infrastructure is in place.** `consents` table, `audit_log`, `gdprExport.js` all exist and have correct RLS.
- **No circular dependencies.** `npx madge --circular src/` reports clean.

---

## Appendix: Key Command Outputs

### A-1: Test Run Summary
```
Test Files  105 passed (105)
      Tests  1370 passed (1370)
   Start at  11:59:11
   Duration  8.94s
```

### A-2: Build Chunk Summary (gzip > 40 kB)
```
vendor-recharts    390 kB │ gzip: 114 kB
index              380 kB │ gzip: 118 kB
vendor-supabase    197 kB │ gzip:  52 kB
vendor-fit         164 kB │ gzip:  40 kB
vendor-react       143 kB │ gzip:  46 kB
jsQR               131 kB │ gzip:  47 kB  ← candidate for lazy load
Dashboard          128 kB │ gzip:  38 kB
CoachDashboard     119 kB │ gzip:  33 kB
Profile             93 kB │ gzip:  27 kB
Protocols           78 kB │ gzip:  23 kB
```

### A-3: Secrets Scan
```
grep -rnE "sk-ant-|sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .

./.env.local:2:VITE_SUPABASE_ANON_KEY=eyJhbG...  ← in .gitignore, NOT committed

git log -p --all | grep -E "sk-ant-|sk-proj-"
# output: only placeholder strings like  placeholder="sk-ant-…"
# No real keys in history.
```

### A-4: RLS USING(true) Violations
```
supabase/migrations/20260417_team_announcements.sql:11:
  CREATE POLICY "ta_athlete_read" ON public.team_announcements FOR SELECT USING (true);

supabase/migrations/20260413_referral.sql:41:
  CREATE POLICY "authenticated updates referral code" ON referral_codes FOR UPDATE USING (true);
```

### A-5: ESLint Summary
```
63 warnings (0 errors) — CI gate set at --max-warnings 0 → FAIL
Key unused vars: predictRaceTime, vdotFromRace, DEFAULT_K1, DEFAULT_K2, 
                 BIKERUN_TYPES, powerTSS, secToMinSec
```

### A-6: ISO Week Bug Demonstration
```javascript
// Formula: Math.ceil(d.getDate() / 7) resets at month boundary
2026-01-31 → 2026-W05 (ISO: W05 — correct by coincidence)
2026-02-01 → 2026-W01 (ISO: W05 — WRONG, 5-week gap appears)
2026-02-07 → 2026-W01 (ISO: W05 — WRONG)
2026-02-08 → 2026-W02 (ISO: W06 — WRONG)
```

---

*Generated by Claude Sonnet 4.6 automated audit — 7 phases, 2026-04-16*
