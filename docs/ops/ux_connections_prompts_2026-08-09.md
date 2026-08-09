# Ease-of-use + "connect everything" prompts (2026-08-09)

Runnable prompts for a follow-up session. Each is self-contained — paste into a Claude
Code session in this repo. Grounded via a code-reading pass done 2026-08-09 (not
speculation) — see the "VERIFIED" line in each. Order is priority.

**Context that shaped this list:** onboarding and first-session-logging were both
checked and are already good (4-screen fast path with a "Start logging →" skip button,
FAB reachable from any tab, session `today` is the landing view) — don't spend budget
"simplifying" either of those, there's no real friction there right now. The actual gaps
are all on the *connections* side: Strava specifically has a well-built one-click
reconnect button that's invisible unless you already know to look for it — which is
exactly the failure mode that silently broke the founder's own Strava connection this
week (see [[project_sporeus_strava_golive]] / CHANGELOG v9.500.0 area).

---

## 1. ✅ DONE (2026-08-09, v9.501) — corrected after deeper investigation
> **The original premise below was WRONG** — my first research pass missed that
> `TodayView.jsx` (v9.132.0, pre-existing, NOT new) already has a well-built Strava
> sync health banner: it fires on the landing tab (`today`), shows for
> failing/stale/never-synced states, has an in-place sync button, and correctly reads
> `classifyStravaSync()`. Building the App-shell banner as originally scoped would have
> been a redundant duplicate system. Actual verified gap, found by asking "why didn't
> the existing banner catch this for the founder": the snooze mechanism
> (`bannerSnooze.js`) snoozed by a flat 7-day TTL with no awareness of the underlying
> condition — if dismissed while merely 'stale', it stayed suppressed for the full 7
> days even if the connection then degraded to 'failing — reconnect required'. Fixed by
> adding an optional condition fingerprint to `isBannerSnoozed`/`snoozeBanner`
> (backward-compatible — existing callers without a fingerprint are unaffected); the
> Strava banner now fingerprints on `state|lastError`, so an escalation re-fires it
> immediately instead of waiting out the old snooze. +5 tests, 16,163 green.
>
> <details><summary>Original (superseded) prompt text</summary>
>
> VERIFIED: `src/components/StravaConnect.jsx:174-210` already has a well-built error
> banner + one-click "↻ RECONNECT" button (calls `initiateStravaOAuth({force:true})`,
> no re-auth form needed) — but it only renders inside the Profile tab's "STRAVA SYNC"
> card. Profile is 1 of 15 tabs with no badge/indicator that something's wrong. A user
> who doesn't habitually open Profile has no way to know Strava silently stopped
> syncing. **Task**: extend the `SetupBanner` pattern to a new App-shell-level banner.
> </details>

## 2. ✅ DONE (2026-08-10, v9.502) — wired in + fixed a related drift bug it surfaced
> Re-verified before wiring (per item #1's lesson): `StravaConnectInContext.jsx` really
> was dead code (only self-reference hits via grep). Wired into `Dashboard.jsx`'s
> sparse-log zone (`log.length > 0 && log.length < 14 && !stravaConnected`, both the
> simple- and advanced-view render paths), right after `FirstRunInsightCard`. Didn't
> also add it to `TrainingLog.jsx` — Dashboard already owns this narrative moment
> (`GettingStartedCard`/`FirstRunInsightCard` live there too) and a second copy on
> another tab risked showing two different "connect Strava" prompts at once.
>
> **Found real drift exactly as this prompt warned to check for**: `Dashboard.jsx` and
> `TodayView.jsx` both gated their existing `GettingStartedCard`'s `stravaConnected`
> prop on `!!localStorage.getItem('sporeus-strava-token')` — a flag NOTHING has written
> since v9.90.0 disabled the local-token sync fallback. It was always `false`
> regardless of a real connection, meaning "Connect Strava" nagged even already-connected
> users in the empty-log state. Fixed both to use the real server-side
> `strava_tokens` row (`getStravaConnection()` / `stravaConn?.strava_athlete_id`,
> matching `StravaConnect.jsx`'s own pattern) instead — same real signal now feeds
> the new nudge's "already connected → don't show" gate too. Dashboard didn't
> previously fetch this at all; added the same fetch-on-mount pattern TodayView
> already used, plumbed `authUser` down from App.jsx as a new prop.
>
> +5 tests (first test file for `StravaConnectInContext.jsx`, which had zero coverage).
> 16,168 green, lint clean, build clean.

## 3. Build one "Connections" screen — Strava, Garmin, FIT import currently live in 3 places
> VERIFIED: there is no unified integrations/connections hub anywhere in the app
> (confirmed via grep for Connections/Integrations/StatusPage-style components — zero
> hits). Strava connect lives in Profile (`StravaConnect.jsx`). Garmin's manual
> device/webhook config and the provider dropdown live in a separate
> `DeviceSync.jsx`. FIT/GPX file import is reachable from yet another spot
> (`UploadActivity`-style flow). A user trying to "connect everything" has to already
> know these three different places exist.
> **Task**: add one screen (new tab, or a dedicated section reachable from Profile's
> top) that lists every connection method as a card with live status: Strava
> (connected/error/stale via the existing `classifyStravaSync()`), Garmin (currently
> prototype-only — see item #5, show as "coming soon" if the founder decides not to
> build it yet), manual file import (always-available, no "status" needed — just a
> shortcut button). Reuse existing components/logic (`StravaConnect.jsx`'s connect
> button, `DeviceSync.jsx`'s form) rather than rewriting — this is a layout/aggregation
> task, not a new-integration task. Don't remove the existing per-feature entry points
> (Profile's Strava card, DeviceSync tab) — this is an additional fast path, not a
> replacement, so nothing that currently works breaks.

## 4. Add a visible "connecting…" state during the Strava OAuth round-trip
> VERIFIED: `initiateStravaOAuth()` does a full-page redirect to Strava and back via
> the `strava-oauth` edge function callback — `StravaConnect.jsx` shows zero loading/
> interstitial UI during that ~1-3s gap. To a user, clicking "Connect Strava" looks
> like nothing happened until the page reloads.
> **Task**: before the redirect fires, persist a short-lived flag (sessionStorage, e.g.
> `sporeus-strava-connecting`) and on the return leg (before the OAuth callback
> resolves), render a lightweight "Connecting to Strava…" state using that flag so the
> transition doesn't look broken. Clear the flag once `initiateStravaOAuth`'s callback
> handling completes (success or failure). Keep this additive/cosmetic — don't touch
> the actual OAuth exchange logic in `supabase/functions/strava-oauth/index.ts`.

## 5. Founder decision: Garmin — build the real integration, or keep it survey-only?
> VERIFIED: `supabase/functions/garmin-oauth/index.ts` is explicitly prototype-gated
> ("GARMIN_CLIENT_ID not set in production" per its own comment) and has never been a
> real connect path. `src/components/GarminSurvey.jsx` only captures interest, it
> doesn't connect anything. `DeviceSync.jsx` has a 'garmin' option in a provider
> dropdown that presumably goes nowhere real. This has been dormant a long time.
> **Decide**: (a) build it for real — requires a Garmin Connect Developer account +
> the OAuth/webhook work (medium effort, Strava's pattern is reusable per
> `docs/roadmap/v9_candidates.md`); or (b) keep survey-only and make that honest in the
> UI (rename "Connect Garmin" → "Notify me when Garmin support ships" wherever it
> currently implies a live connection) so users don't think it's broken when it's
> actually just not built yet. Tell me which and I'll implement — this is a scope/cost
> call, not a code question.

## 6. Un-bury the Strava self-test diagnostic
> VERIFIED: `StravaConnect.jsx:290-333` has a genuinely useful self-test block (checks
> clientId/redirectUri/auth/token) but it's inside a collapsed `<details>` element —
> low discoverability for the one moment it's actually useful (something's wrong and
> the user wants to know why before hitting reconnect).
> **Task**: auto-run the self-test check (cheap, local) whenever the Strava card is in
> an error/stale state and show its result inline above the RECONNECT button, instead
> of requiring the user to find and expand the `<details>` block themselves. Keep the
> collapsed manual version for the healthy-connection case (nothing to fix, no need to
> surface it unprompted).

---

Not included here (already good, verified, don't touch): onboarding step count/skip
path (`Onboarding.jsx`), first-session logging speed (`MobileFAB` + `QuickAddModal`,
1 tap from any tab), Strava's actual reconnect *mechanism* (already one-click — the
bug is visibility, not the mechanism itself).
