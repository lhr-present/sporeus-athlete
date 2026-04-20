# Auth Flow Audit — F1

**Date:** 2026-04-21  
**Version:** v9.2.5  
**Auditor:** F1 debt session

---

## Summary

Four findings. Two fixed in this session. One deferred. One documented as intentional.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Stale allowed redirect URL (old GitHub Pages) | HIGH | ✅ Fixed |
| 2 | `prompt: 'consent'` forces Google consent screen on every login | MEDIUM | ✅ Fixed |
| 3 | Dev redirect URL in allowlist had wrong path | LOW | ✅ Fixed |
| 4 | Sign-out does not clear user-specific localStorage | LOW | Documented — intentional design |
| 5 | `flowType: 'implicit'` — not PKCE | INFO | No action — protected invariant |

---

## Auth Stack

| Component | File | Notes |
|---|---|---|
| Supabase client | `src/lib/supabase.js` | Singleton, `flowType: 'implicit'`, `detectSessionInUrl: true` |
| Auth state | `src/hooks/useAuth.js` | `onAuthStateChange` only — no `getSession` (Web Locks) |
| Sign-in UI | `src/components/AuthGate.jsx` | Google OAuth + email/password + magic link |
| Supabase project | pvicqwapvvfempjdgwbm | `site_url: https://app.sporeus.com` |

---

## Finding 1 — Stale allowed redirect URL (HIGH) ✅ Fixed

**Before:** `uri_allow_list` contained `https://lhr-present.github.io/sporeus-athlete/` — the pre-CNAME URL from before `app.sporeus.com` was configured.

**Risk:** Anyone who gains access to `lhr-present.github.io/sporeus-athlete/` (e.g. if the repo becomes public, is transferred, or is temporarily misconfigured) could receive real auth tokens. Supabase validates the `redirect_to` param against the allowlist at OAuth initiation — a matching stale URL is exploitable.

**Fix:** Removed via Management API PATCH. `uri_allow_list` now contains only `http://localhost:5173/` (dev). Production (`https://app.sporeus.com`) is covered by `site_url`.

---

## Finding 2 — `prompt: 'consent'` on every Google login (MEDIUM) ✅ Fixed

**Before:** `AuthGate.jsx` passed `queryParams: { access_type: 'offline', prompt: 'consent' }` to `signInWithOAuth`.

**Effect:** Every returning user sees the Google consent screen ("Sporeus wants to see your name and email address") on every login. This is intentional behavior for first-time sign-ins, but `prompt: 'consent'` forces it even for users who have already consented. Degrades UX for all returning users.

**Why it was wrong:** `access_type: 'offline'` requests a Google refresh token. This is only needed if the app calls Google APIs directly (it doesn't — Strava OAuth is separate). Supabase manages its own session refresh internally. `prompt: 'consent'` is required to get `access_type: 'offline'` to work, so both params were paired, but neither is needed.

**Fix:** Replaced with `queryParams: { prompt: 'select_account' }`. This shows the Google account picker (useful for users with multiple accounts) without forcing the consent screen.

**Test added:** `AuthGate.test.jsx` — "Google OAuth called with select_account — not forced consent"

---

## Finding 3 — Dev redirect URL wrong path (LOW) ✅ Fixed

**Before:** `http://localhost:5173/sporeus-athlete/` in allowlist. App uses `base: '/'` in vite.config.js, so the actual dev `redirectTo` is `http://localhost:5173/`. Magic link / OTP flows in dev would produce a redirect URL mismatch.

**Fix:** Replaced with `http://localhost:5173/` in the same Management API update as Finding 1.

---

## Finding 4 — Sign-out does not clear user-specific localStorage (LOW, intentional)

**Behavior:** `supabase.auth.signOut()` clears the Supabase session token (`sb-pvicqwapvvfempjdgwbm-auth-token`). It does NOT clear `sporeus_log`, `sporeus-profile`, `sporeus-onboarded`, etc.

**Why intentional:** The app is localStorage-first and supports offline + guest modes. Guest users accumulate data in localStorage before signing in; that data is preserved through sign-in. Clearing localStorage on sign-out would destroy unsynced guest data.

**Actual risk:** On a shared device, User B signing in after User A sees User A's training log until Supabase sync replaces it. This is a real shared-device privacy issue but not a security issue (the data is the previous user's fitness log, not credentials).

**Mitigate if needed:** On `SIGNED_IN`, compare the new `user.id` against a stored `sporeus-last-user-id`. If different, clear user-specific localStorage keys before loading data. Track as a future P-priority issue, not F1 scope.

---

## Finding 5 — `flowType: 'implicit'` (INFO, no action)

**Current:** `createClient` uses `{ auth: { flowType: 'implicit' } }` (see `src/lib/supabase.js:15`).

**Supabase 2026 guidance:** PKCE is now recommended for all new apps (even SPAs) because it prevents token leakage via URL history and referrer headers.

**Why no change:** `flowType: 'implicit'` is an explicitly protected invariant in `CLAUDE.md`: "required for static hosting — NEVER change to PKCE." The app is deployed to GitHub Pages with no server component to handle the authorization code exchange. Implicit flow works correctly and has worked reliably since v1. Migration risk > security benefit for this deployment target.

**Token exposure:** With implicit flow, the access token appears in the URL hash (`#access_token=...`). The hash is never sent to servers (it's client-only), but it does appear in browser history. `detectSessionInUrl: true` picks it up and Supabase removes it from the URL immediately after parsing.

**Revisit:** If the app ever adds a server component (SSR, edge middleware), migrate to PKCE at that point.

---

## Redirect URL configuration (verified 2026-04-21)

| Setting | Value | Correct |
|---|---|---|
| `site_url` | `https://app.sporeus.com` | ✅ |
| `uri_allow_list` (prod) | *(implicit via site_url)* | ✅ |
| `uri_allow_list` (dev) | `http://localhost:5173/` | ✅ |
| `redirectTo` in app code | `window.location.origin + import.meta.env.BASE_URL` | ✅ |
| Google Cloud Console | Not directly verified — infer from working OAuth | ℹ️ |

**GCP manual verification checklist** (do once in GCP console):
- Authorized JavaScript origins: `https://app.sporeus.com`
- Authorized redirect URIs: `https://pvicqwapvvfempjdgwbm.supabase.co/auth/v1/callback`
- Remove any test/localhost entries that predate the production deploy

---

## First-login flow (verified)

1. Google OAuth → Supabase callback → `https://app.sporeus.com/#access_token=...`
2. `detectSessionInUrl: true` parses hash → `SIGNED_IN` event fires
3. `useAuth` sets `user`, triggers `upsertProfile` (creates profiles row with `display_name` from Google metadata)
4. `onboarded` localStorage key is `false` for truly fresh users → `OnboardingWizard` renders
5. User completes wizard → `setOnboarded(true)` → main dashboard

**Auto-onboard bypass:** If `localStorage['sporeus-onboarded']` is already `true` (guest user converting), the wizard is skipped. Intentional — preserves guest data through sign-in.

---

## Sign-out flow (verified)

1. `supabase.auth.signOut()` → `SIGNED_OUT` event → `useAuth` sets `user = null`
2. App renders `<AuthGate>` ✅
3. Supabase session token cleared from localStorage ✅
4. Training data (sporeus_log etc.) remains in localStorage — see Finding 4

---

## Tests added

- `AuthGate.test.jsx`: 2 new tests
  - "Google OAuth called with select_account — not forced consent"
  - "Google OAuth redirectTo is origin + base URL, not hardcoded"
- Full suite: 2631 tests passing (was 2629)
