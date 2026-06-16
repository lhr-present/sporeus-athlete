# Deep-Dive Audit Round 2 — 2026-06-16 (v9.421)

Second 6-dimension multi-agent deep dive, on areas the first pass didn't cover:
edge-function logic, billing/tier integrity, i18n, the component fleet, the plan
generator, and full live-schema RLS coverage. Adversarially verified.

## FIXED in v9.421

### Client components
- **CRITICAL — TrainingLog edit hits the WRONG session under a filter**: `startEdit`
  reverse-mapped a list index instead of using the row; with the filter box active
  the index ≠ real index → editing a row loaded+overwrote a different session (silent
  corruption). Now uses the passed row directly. +tests.
- **HIGH — Recovery hydration clobbered today's wellness entry**: form-sync effect
  keyed on `[today]` only; on slow cold login the form stayed blank after async
  hydrate, and Save overwrote the real HRV/sleep/RHR entry with defaults. Effect now
  re-inits from `todayEntry` (guarded against clobbering in-progress edits). +tests.
- **HIGH — Calendar placed planned sessions by array index**, ignoring `ses.day`;
  adaptive/preset plans (compressed to N sessions) rendered on the wrong weekdays.
  Now placed by day-name→offset. +tests.
- **MED** — InjuryTracker `id:Date.now()` collision (delete removed two rows) → UUID.
- **MED** — ZoneCalc pace mode rendered bogus `0:00` zones on empty input → parse +
  `sec>0` guard. (Also localized one EN-only altitude string.)
- **MED** — SessionHistory (GYM) expand keyed by sorted index → keyed by session id.
- **MED** — SportProgramBuilder "compare plans" passed `minTSS/maxTSS` (optimizer
  wants `minWeeklyTSS/maxWeeklyTSS`) → Plan B ignored inputs (defaulted 30–600).
- **LOW** — ReportsTab null `expires_at` → always "expired" (download hidden); guard.
- **LOW** — SessionLogger (GYM) cue/rest-timer index not remapped on exercise delete.
- **LOW** — CoachSquadView compare set not pruned on team change.

### i18n
- **HIGH — PLAN tab (YearlyPlan + WeekBuilder) rendered entirely in English** regardless
  of language. Fully localized (inline EN/TR, real diacritics). Also relabeled the
  "Apply this TSS to N weeks" control to match its actual (incl-current) behavior.
- **LOW** — 3 EN-only strings localized (ZoneCalc, Protocols, Profile install hints).
- NOTE: the LABELS table itself is clean — 854/854 EN/TR parity, no mojibake.

### Server / prod (applied + verified via Management API)
- **HIGH — `teams` had no tier gate** (multi_team paid feature creatable by free coaches
  via direct REST insert). Migration `20260626`: `teams_owner_all` WITH CHECK now
  `org_id = auth.uid() AND get_my_tier() IN ('coach','club')` (USING stays ownership
  so downgraded coaches keep read/delete). Mirrors the v9.381 org_branding fix.
- **HIGH — `apply_subscription_event` `subscription.updated`** read `current_period_end`
  top-level only and matched only the Dodo event name → Stripe renewals
  (`customer.subscription.updated`, period-end nested under `data.object` as unix ts)
  never advanced the stored period end. Migration `20260627`: verbatim re-creation
  with that one branch handling both event names + payload shapes.

### Edge functions (code in repo — DEPLOY-GATED, take effect on next edge deploy)
- **MED — ai-proxy** read raw `profiles.subscription_tier` (only flips on the daily
  cron) → cancelled/expired coach kept AI access up to ~24h. Now uses the status-aware
  `tier_for_user` RPC (matches embed-query/generate-report).
- **MED — redeem-invite free roster limit** was `3`, contradicting the client/founder
  source of truth (`free = 1`, v9.378) → free coaches over-entitled via invite links.
  Aligned to `1`; stale comment corrected.
- **MED — nightly-batch** referenced an undefined `serviceKey` → ReferenceError on every
  03:00 cron. Declared it. (Fn is otherwise a delegating no-op.)

## DEFERRED — founder decision (plan-generator design; changes generated plans)

These are real but change user-facing plan output and/or are founder-owned sport-science
design. NOT safe drop-ins — flagged for an explicit decision + careful re-baselining.

- **HIGH — default `generatePlan` (formulas.js) ignores `goal`**: a 5K plan and a
  marathon plan come out byte-identical (sessions + weekly TSS). The distance/physiology-
  aware logic lives only in the adaptive generator behind the "Advanced" toggle, so the
  default athlete path doesn't honor target→physiology→plan. Fix = route the default
  through the adaptive generator (or branch DAY_PATTERNS on goal) — a behavior change
  for every user + many test baselines.
- **HIGH — adaptive deload week can carry MORE load than the prior week**: `weeklyTSS`
  computes its Build ramp window from plan-index math (`totalWeeks-6`) that diverges
  from the calendar-aware `raceAwarePhaseForWeek`, so a flagged deload can exceed the
  week before it. Fix = derive the ramp position from the same phase function.
- **MED — adaptive taper (no-raceDate index path) ramps UP / exceeds peak**: taper
  fracs anchor to raw `peakTSS` not the achieved peak; the validator even skips WoW
  checks on taper. Fix = anchor to the visible peak + enforce monotonic descent.
- **MED — legacy plan length ≠ requested weeks** for short horizons (returns 4 for
  inputs ≤4; coach panel accepts typed <4). Fix = clamp/validate `totalWeeks`.
- (`vo2max` dead-by-default is intentional/flag-gated — not a bug.)

## DEFERRED — other (documented, lower priority / deploy-gated)
- **redeem-invite uses_count/roster TOCTOU** (concurrent redemptions of one invite can
  overrun a single-use cap / roster limit) — needs an atomic `UPDATE … WHERE
  uses_count < max_uses RETURNING` or a constraint; edge-deploy-gated. Low probability.
- **send-push dedupe is check-then-act** (LOW; small window, ephemeral payload).
- **dodo-webhook lacks Stripe timestamp tolerance** (LOW; replay blocked by event_id
  idempotency).
- **pgtap test extension installed in prod `public`** — 1079 fns + 2 views anon-exec
  (schema introspection only, no user data). DROP risks the CI RLS harnesses (they may
  use pgtap) — needs to confirm CI usage / move to a `tap` schema first. LOW.

## Confirmed CLEAN (verified live, not re-reported)
RLS: 54/54 public tables enabled, 0 gaps; only `queue_metrics`/`strava_rate_state`/
`subscription_events` are always-true and all service_role-only; DEFINER lockdown (12
anon/auth-exec fns, all guarded); MVs not anon/auth-selectable; `insight_embeddings`
bigint matches. Tier helpers `get_my_tier`/`tier_for_user` status-aware. LABELS i18n
table complete. Many components/edge-fns reviewed clean (see agent reports).

## EDGE-FUNCTION DEPLOY NOTE
Pending operator `supabase functions deploy`: **comment-notification** (v9.419 auth
gate — webhook must send `x-sporeus-webhook-secret` FIRST), **ai-proxy**, **redeem-invite**,
**nightly-batch**. Code is in repo; prod behavior unchanged until deployed.
