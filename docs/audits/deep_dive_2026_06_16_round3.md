# Deep-Dive Round 3 — 2026-06-16 (v9.425)

Dimensions: TEST INTEGRITY (false-confidence tests) + PWA/offline/mobile robustness.

## Root-cause pattern (test integrity)
Libs/tests written against RAW-import field names that `sanitizeLogEntry` (validate.js)
renames or strips, so a card returns null for every real entry while its test passes by
injecting the raw field directly (bypassing the sanitizer). Plus contract tests that
re-implement producer logic ("pure replica") or assert client-side constants instead of
the real producer output. Both let real bugs ship green. (This session already hit two:
`athlete_name` vs `display_name`, and the `durationMin` injections.)

## FIXED in v9.425

### Dead dashboard cards (silently null for all real users; tests were green on phantom data)
- **hrForRpe** (CRITICAL): read `entry.heartRate`; sanitizer emits `avgHR`. Reader →
  `avgHR ?? heartRate ?? avg_hr`.
- **cyclingNpTrend**: reader was fine but `np` was STRIPPED by the sanitizer AND never
  written onto FIT-import entries. Added `np` to the sanitizeLogEntry whitelist
  (validated, clamped ≤2500) + made TrainingLog write `np` on FIT import.
- **7 `durationMin` volume cards** (calendarProgress, twoADays, weekendLongSessionShare,
  volumePerSessionTrend, weeklyVolumeIntensityRatio, trainingHourBudget,
  zoneThreeBlackHole): stored entries use `duration`, not `durationMin`. Readers now
  `duration ?? durationMin ?? duration_min`.
- **Structural fix:** every fixed card's test now builds entries THROUGH `sanitizeLogEntry`
  (instead of injecting raw fields), so this regression class is now caught.

### PWA
- **First-ever SW install triggered a spurious full-page reload** (HIGH): the
  `controllerchange` listener reloaded on any controller change, including the first
  install's `clients.claim()` → every brand-new visitor got a reload mid-interaction
  (losing in-memory form state). Now gated on `hadController` (only reload on a genuine
  waiting-SW activation, not first install). useAppState.js.

## DEFERRED (documented)
- **swimSwolfTrend — dead by design, NO capture path.** `swolf`/`strokes`/`poolLength`
  are produced by NOTHING (no importer, no manual entry), so the card is inert. NOT
  adding dead weight to the sanitizer. Code comment left. To make it live: add a
  swim-detail capture path (FIT length messages, or manual swim fields) then whitelist
  those fields. Needs a product decision + capture work.
- **search_everything dropped `athlete_session`/`athlete` kinds** (test-integrity find):
  a later `CREATE OR REPLACE` (20260484) silently dropped the coach "find athlete
  sessions" search arms; the regression-guard test only checks its own array so it never
  caught it. Needs a feature decision (was it intentional?) + migration reconciliation.
- **Capacitor native shell gaps** (mobile build, not the web PWA): web-push path
  (`pushNotify.js`) fails silently in the iOS WKWebView (no `@capacitor/push-notifications`
  bridging exists); Strava/Supabase OAuth `redirect_uri` is origin-derived and breaks in
  the `capacitor://` origin. Real, but native-build feature work — defer unless the native
  app is being shipped.
- **Contract-test drift backlog** (test quality; some reveal real gaps): dodo-webhook
  asserts amount/currency capture the producer never performs (billing_events.amount_cents
  is always NULL — a real billing-data gap) + a wrong idempotency model (UNIQUE on
  event_id only, not (provider,event_id)); ai-proxy RAG-context format replica drifts from
  the real edge fn; mvSquadReadiness/analyseSession JS replicas drift from the SQL;
  coachMessage.test + useAsync.test mock/reimplement the unit under test. Fix by importing
  the real producer / asserting against parsed SQL rather than copies.
- **Offline comment edit/delete temp-id relink** (LOW): create-then-edit-while-offline can
  silently drop the edit on replay (temp id never relinked to the server PK). Fix: stable
  client-UUID PK at insert, or block edit of an un-synced row.
- **Poison-write dead-letter** (LOW): after MAX_ATTEMPTS the queue keeps the indicator
  amber forever with no recovery path (already non-'synced', the v9.419 fix). Move to a
  dead-letter store + one-time toast.

## Confirmed clean
v9.418 SW update-toast flow correct; cache strategies (NetworkFirst on dynamic data)
correct; Strava code-flow callback correctly denylisted; IndexedDB v1/v2 race fixed;
iOS web-push gating (v9.176) correct & fails loud; most of the 702-file suite is genuine.
