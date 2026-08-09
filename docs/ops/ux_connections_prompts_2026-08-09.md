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

## 1. 🔴 Highest leverage: surface a broken Strava connection app-wide, not just in Profile
> VERIFIED: `src/components/StravaConnect.jsx:174-210` already has a well-built error
> banner + one-click "↻ RECONNECT" button (calls `initiateStravaOAuth({force:true})`,
> no re-auth form needed) — but it only renders inside the Profile tab's "STRAVA SYNC"
> card. Profile is 1 of 15 tabs with no badge/indicator that something's wrong. A user
> who doesn't habitually open Profile has no way to know Strava silently stopped
> syncing — this is exactly what happened to the founder's own account this week
> (`strava_tokens.sync_status='error'`, unnoticed for ~11 days). Meanwhile
> `src/components/SetupBanner.jsx` already establishes the right pattern: a persistent,
> non-snoozable, top-of-app banner for critical unresolved state (currently only used
> for "no sport picked yet").
> **Task**: extend the `SetupBanner` pattern (or add a sibling banner component) to
> also fire when `classifyStravaSync()` (`src/lib/athlete/stravaSyncHealth.js`) returns
> an error/stale state for a connected user, rendered at the App shell level (visible
> from every tab, not just Profile) with a direct one-tap path into the same
> `initiateStravaOAuth({force:true})` reconnect action already in `StravaConnect.jsx` —
> don't rebuild the reconnect logic, just make the existing one reachable from
> anywhere. Add a test that a `sync_status='error'` profile renders the banner from a
> non-Profile tab.

## 2. Wire up the dead contextual Strava nudge (`StravaConnectInContext.jsx`)
> VERIFIED: `src/components/onboarding/StravaConnectInContext.jsx` is a fully-built
> component (a context-aware "connect Strava" prompt meant for users with sparse
> training data, <14 sessions) that is **not imported anywhere in the app** — dead
> code, confirmed via grep. This is a real, already-paid-for feature sitting unused.
> **Task**: find the right insertion points — likely `Dashboard.jsx` (when
> `log.length < 14` and Strava isn't connected) and/or `TrainingLog.jsx` empty/sparse
> states — and wire it in. Check first whether the component's props/expected data
> shape still match current `DataContext`/`profile` shape (it may have drifted since
> it was built) before wiring; fix drift if found, don't just import blindly. Add a
> render test confirming it shows for a sparse, not-connected profile and hides once
> either condition is no longer true.

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
