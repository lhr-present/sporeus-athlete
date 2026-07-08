# Publish-Readiness Audit — Sporeus Athlete App
**Date:** 2026-07-09
**Scope:** Everything between "works for the founder" and "publishable to strangers" — first-run, PWA/offline, auth lifecycle, error surfaces, production hygiene, legal/meta.
**Method:** Read-only source + live-site inspection (https://app.sporeus.com). Findings appended as verified, each with file:line, new-user impact, severity (BLOCKER/HIGH/MED/LOW), suggested fix.

---

## Findings

### F1 — BLOCKER · Account deletion + data download UI is dead code; privacy policy promises both
- **Files:** `src/components/Profile.jsx:140` (`_handleGdprDownload`), `:153` (`_handleGdprDelete`) — defined, never referenced by any button (underscore-prefixed, lint-silenced). `confirmGdprDeleteOpen` (line 58) is never set to `true`, so the confirm modal at line 823 and `doGdprDelete` can never fire. Separately `src/pages/profile/DeleteAccount.jsx`, `ConsentCenter.jsx`, `DataExport.jsx` are imported by NOTHING (grep across src/ — only tests reference them).
- **New-user experience:** Privacy policy (`src/components/PrivacyPolicy.jsx:88-96`) explicitly promises "Profile → Privacy → 'Download my data'" and "Profile → Privacy → 'Delete my account'". Neither button exists anywhere in the UI. A stranger who wants out has no path except emailing the founder. GDPR Art. 17 / KVKK erasure is UI-unreachable while the policy claims it is in-app.
- **Fix:** Wire two buttons into the existing PRIVACY DASHBOARD block (Profile.jsx:550-615) calling the already-implemented handlers; or mount `pages/profile/DeleteAccount.jsx` (grace-period flow, backed by `deletion_requests` table in `supabase/migrations/20260458_privacy_lifecycle.sql`). Note: DeleteAccount.jsx's `cancelDeletion` does a client UPDATE but the migration RLS says only service role may UPDATE `deletion_requests` — verify before mounting.

### F2 — HIGH · No password-reset path at all
- **File:** `src/components/AuthGate.jsx` — modes are `login | signup | magic` only. Zero occurrences of `resetPasswordForEmail` or `updateUser({password})` in all of src/.
- **New-user experience:** Forgot password → "Invalid login credentials" error → stuck. The MAGIC tab is an accidental workaround, but nothing tells the user that, and there is no way to ever set a new password afterwards.
- **Fix:** Add "Forgot password?" link → `supabase.auth.resetPasswordForEmail(email, { redirectTo })` + a recovery-mode screen (listen for `PASSWORD_RECOVERY` in onAuthStateChange) calling `auth.updateUser({ password })`. Minimum viable: under the login error, hint "use MAGIC to sign in without a password".

### F3 — HIGH · og:image 404s — every social share of app.sporeus.com renders broken
- **File:** `index.html:21` → `https://sporeus.com/wp-content/uploads/sporeus-og.png` returns **HTTP 404** (verified live 2026-07-09).
- **New-user experience:** anyone sharing the app link on WhatsApp/X/Slack gets a card with title but broken/absent image — bad first impression at exactly the moment of viral referral.
- **Fix:** upload the OG image (1200×630) or point to an existing asset; consider serving it from app.sporeus.com itself (it's precache-eligible). Add `twitter:card`/`twitter:title`/`twitter:image` tags while there (currently none).

### F4 — MED · `<html lang="tr">` hardcoded while all static meta is English
- **File:** `index.html:2` (`lang="tr"`) vs English `<title>`, description, og tags; manifest `lang:"en"` (vite.config). App.jsx:711 corrects `document.documentElement.lang` after JS boots, but crawlers/screen-readers on first paint see TR-labeled English content, and search snippets may be classified TR.
- **Fix:** set `lang="en"` in index.html (matches meta), or localize meta; keep the runtime sync.

### F5 — MED · No terms of service; auth footer binds users only to the privacy policy
- **Files:** `src/components/AuthGate.jsx:339-357` ("By continuing you accept the privacy policy"); only `?privacy=1` route exists (`src/App.jsx:82,797`). No ToS/acceptable-use/liability disclaimer anywhere — notable for an app giving health/training guidance to strangers.
- **Fix:** add a short ToS (`?terms=1` route mirroring PrivacyPolicy.jsx) covering "not medical advice", liability limits, account termination; link it next to the privacy link.

### F6 — MED · robots.txt and sitemap absent (404 live)
- **URLs:** `https://app.sporeus.com/robots.txt` → 404, `/sitemap.xml` → 404 (verified). `public/` contains neither.
- **New-user impact:** crawlers get default-everything; the `?privacy=1`/`/science` deep routes aren't discoverable; 404 noise in logs. Low SEO stakes for an app shell, but robots.txt is table stakes.
- **Fix:** add `public/robots.txt` (allow /, point to canonical); sitemap optional for a SPA.
### F7 — MED · Privacy policy claims "no analytics / no third-party scripts" while the app ships Sentry + funnel telemetry
- **Files:** `src/components/PrivacyPolicy.jsx:114` ("We do not use advertising, analytics, or tracking cookies… do not deploy third-party scripts") and `:364`; vs `src/main.jsx:58` (`initSentry()` — crash reports to `o4511166567022592.ingest.de.sentry.io`, whitelisted in the CSP at `index.html:14`), `src/lib/telemetry.js` (event flush to a Supabase ingest edge path), `src/lib/attribution.js` (UTM first-touch + `landing`/`signup_completed` funnel events).
- **Mitigations already in code:** Sentry events are scrubbed (`beforeSend` at `src/lib/observability/sentry.js:66`) and user IDs are hashed (`:82-87`); telemetry is first-party. Still: Sentry is a third-party data processor and must be disclosed under GDPR Art. 13/28; "no analytics" is factually wrong given the funnel events.
- **Fix:** add a "Error reporting & product telemetry" section to the policy naming Sentry (EU ingest) and the first-party events; soften the absolute claims.

### F8 — MED · Health data reaches Supabase BEFORE the KVKK/GDPR consent gate is shown
- **Files:** `src/App.jsx:331` — consent overlay renders only when `onboarded && !hasCurrentConsent()`; `src/hooks/useAppState.js:513-525` — `finishOnboarding` persists the profile (weight, HR, health fields) via `setProfile`, which `useSyncedTable` pushes to Supabase immediately for authenticated users. So a signed-up stranger completes the wizard → health data is written to the cloud → THEN they are asked to consent (the gate itself says consent is "required … before health data is stored").
- **Fix:** show the consent card as the first wizard step (or before DataProvider enables cloud sync); guests are unaffected (localStorage only).

### F9 — MED · Privacy Dashboard is English-only for Turkish users
- **File:** `src/components/Profile.jsx:550-615` — "Data processing consent", "Withdraw consent", the 3-year retention notice, marketing-consent label, and "DATA CATEGORIES PROCESSED" list are all hardcoded EN (no `t()`/`isTR`). The most legally sensitive UI in the app is untranslated for its primary (TR) audience; the consent modal in App.jsx IS bilingual, so the inconsistency is visible.
- **Fix:** move these strings to LABELS in LangCtx.jsx like the rest of the app.

### F10 — MED · Service worker precaches 409 files / ~6.3 MB on first visit
- **Files:** `vite.config.js:96` (`globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`) → `dist/sw.js` manifest holds 409 precache entries; `dist/assets` = 6.3 MB (236 lazy dashboard-card chunks all precached). First visit on mobile data downloads everything in the background even though sport-gating means most chunks are never rendered.
- **New-user impact:** heavy silent bandwidth + slow "ready offline" on 3G; each deploy re-downloads changed chunks for every installed user.
- **Fix:** precache only the shell (index, vendor-*, main, fonts, icons) and let dashboard-card chunks be runtime-cached (StaleWhileRevalidate) — vite-plugin-pwa `globIgnores` or manual manifest filter.

### F11 — LOW · Blank white flash / blank page pre-JS; no <noscript>
- **File:** `index.html:42-45` — `<body>` has no background color and no static splash markup; the React `Splash` (App.jsx:90) only appears after the main bundle executes. Dark-theme users get a white flash; JS-disabled or bundle-fetch-failed users get a permanently blank page.
- **Fix:** inline `background:#0a0a0a` on `<body>` + a tiny static "SPOREUS — loading" div replaced by React, and a `<noscript>` message.

### F12 — LOW · Founder admin panels gated client-side by hardcoded personal emails
- **File:** `src/components/Profile.jsx:720-741` — `authUser?.email === 'huseyinakbulut71@gmail.com' || … 'huseyinakbulut@marun.edu.tr'` gates AdminCodeGenerator, MVHealth, QueueStats. The gate is cosmetic (client-side); both personal emails ship in the public JS bundle.
- **Fix (operator + code):** verify the underlying RPCs (MV health, queue stats, code generator) are role-protected server-side; move admin gating to `authProfile.role === 'admin'` from the DB.

### F13 — LOW · Dead direct-Strava-API code would be CSP-blocked if ever re-wired
- **File:** `src/lib/strava.js:106-128` (`importStravaActivities` fetches `www.strava.com/api/v3` directly) — no callers since v9.90 (`src/components/profile/StravaConnect.jsx:10` comment confirms removal; sync routes through the `strava-oauth` edge function). The CSP `connect-src` (index.html:14) does not include strava.com, so re-wiring it would fail silently in prod.
- **Fix:** delete the function or add a comment noting the CSP constraint.

### Verified-good (no action)
- **Guest entry:** one click from AuthGate ("Try without account", `AuthGate.jsx:332-336`) → onboarding wizard → logging; no email needed; persistent GUEST MODE banner + backup-download nudge (App.jsx:415-476). Fast time-to-first-value.
- **SW update flow:** no stale-trap — `main.jsx:25-31` checks for updates on every load; new SW waits until the user clicks RELOAD (`useAppState.js:357-384`, `sw.js:56-76`); `cleanupOutdatedCaches()` present.
- **Console hygiene:** the only `console.log` in shipped src is inside the DEV-gated logger (`src/lib/logger.js:16`); prod logging goes to Sentry.
- **Source maps:** none in `dist/` (verified).
- **iOS PWA:** `viewport-fit=cover` (index.html:9), safe-area insets consumed (`styles.js:21-22,45`, `MobileBottomBar.jsx:32-35`), apple-touch-icon + status-bar meta present; manifest complete (maskable icons, id, scope-correct on custom domain — CNAME in public/). Missing only `screenshots`/`categories` (cosmetic richer-install UI).
- **Auth redirects:** all `redirectTo`/`emailRedirectTo` derive from `window.location.origin` (AuthGate.jsx:94,110,155) — correct on app.sporeus.com. Signup has confirm-email + resend recovery + enumeration-guard hint (AuthGate.jsx:151-164,298-310).
- **Password quality:** HIBP weak/pwned-password rejection surfaced bilingually (AuthGate.jsx:127-141).
### F14 — HIGH · Supabase outage while the device is online is completely silent
- **Files:** `src/components/OfflineBanner.jsx:8` (triggers only on `navigator.onLine`); `src/components/StatusBanner.jsx:40-54` (polls `get_system_status` RPC — but if the RPC itself can't reach Supabase, the catch at `:51-53` swallows silently); `src/contexts/DataContext.jsx:33-53` (no error field consumed); `src/hooks/useSupabaseData.js:350` sets a `sporeus-offline-mode` localStorage flag on hydration failure that **no component reads** (grep-verified).
- **New-user experience:** Supabase down/misconfigured → reads silently fall back to empty localStorage, writes queue silently; a stranger's first session looks like "the app has no data / my saves work" with zero signal. The sync dot in the header helps only for queued writes.
- **Fix:** consume the existing `sporeus-offline-mode` flag (or a DataContext error state) in ConnectionBanner: "Can't reach the server — showing device data".

### F15 — LOW · Recovery tab has no zero-data empty state
- **File:** `src/components/Recovery.jsx:31,121` — always renders the wellness form pre-filled with defaults (all 3s); every chart self-gates to null below its data threshold (`:93,192,263,318`). New user sees a bare form with no "why/what" hero, unlike Dashboard/Today/Log/Program which all have bilingual GettingStarted heroes (verified: `Dashboard.jsx:706-708,868-869`, `TodayView.jsx:1048-1085`, `TrainingLog.jsx:851-860`, `ProgramView.jsx:84-90`, `CoachDashboard.jsx:100-108,293`).
- **Fix:** add a small explainer card above the form when `entries.length === 0`.

### F16 — LOW · ErrorBoundary fallback UI is English-only
- **File:** `src/components/ErrorBoundary.jsx:51-102` — "ERROR IN {TAB} — ISOLATED", "Retry", "Export Data", "Reload App", "Technical Details" hardcoded EN. Functionally good (retry + backup + reload affordances), but a TR athlete's first crash speaks English.
- **Fix:** static bilingual strings (boundary can't rely on context; use `localStorage.sporeus-lang`).

---

## Operator checklist (not code — must be verified in dashboards before public launch)
1. **Strava app athlete cap** — Strava API apps default to a 1-athlete (owner-only) capacity until Strava approves an increase. Public athletes connecting Strava will fail at OAuth until the cap is raised (Strava settings → app dashboard). Gate the public announcement on this.
2. **Supabase Auth email throughput** — built-in Supabase SMTP is rate-limited to a handful of mails/hour; public signups + confirmations + magic links need custom SMTP configured (Auth → SMTP). With email-confirm signup as the primary flow (AuthGate), this throttles onboarding hard.
3. **Supabase Auth redirect allowlist** — confirm `https://app.sporeus.com/*` (and nothing stale) in Auth → URL configuration; Google OAuth consent screen published (not "testing", which caps at 100 users and shows an unverified warning).
4. **Billing webhooks** — per the ops queue (de-risk sprint 2026-06-17), DODO/STRIPE webhook secrets were pending; if still unset, paid-tier checkout completes but entitlements never activate. Verify before strangers can pay.
5. **Deletion purge job** — `deletion_requests`/`purge_user` machinery exists in migrations (`2026042501_data_rights.sql`, `20260458_privacy_lifecycle.sql`, cron in `2026042403_fix_purge_cron_hardcode_jwt.sql`) — verify the pg_cron purge job is live in prod and pointed at the right function once F1 is wired.

---

## PUBLISH VERDICT

**Not yet publishable to strangers. 1 blocker + 3 highs; everything else is nice-to-have.**

**Ship-blockers (fix before announcing):**
- **F1** — GDPR/KVKK delete + export UI is dead code while the privacy policy promises both in-app (legal exposure, not just UX).
- **F2** — no password reset (stranded strangers; magic-link workaround is undiscoverable).
- **F3** — og:image 404 (every share of the link looks broken — fix is a 5-minute upload).
- **Operator 1-3** — Strava athlete cap, Supabase SMTP throughput, OAuth/redirect config: any one of these silently breaks the core new-user funnel at scale.

**Should-fix soon (HIGH/MED):** F14 (silent backend outage), F7 (Sentry/telemetry disclosure), F8 (consent-before-cloud-write ordering), F5 (no ToS / "not medical advice"), F4 (lang mismatch), F9 (EN-only privacy dashboard), F6 (robots.txt), F10 (6.3 MB precache).

**Nice-to-have:** F11-F13, F15-F16, manifest screenshots.

**Genuinely strong for public launch already:** one-click guest mode with backup nudge, bilingual empty-state heroes on every main tab, user-controlled SW updates (no stale-cache trap), clean prod console, no source maps, iOS safe-area/standalone handled, HIBP password screening, enumeration-guarded signup recovery.
