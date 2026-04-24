# Debt Session Log

## O1–O5 — UX completeness: session grade, source tags, protocol rationale, recap visual, readiness sparkline (2026-04-22)

**Changes:**
- `src/components/TrainingLog.jsx`: O1 `scoreSession` A–D grade badge in expanded session panel
- `src/components/TodayView.jsx`: O2 suggestion.source badge; O3 protocol when_to_use rationale; O4 weekly recap visual card (trend arrows, stat boxes, dismissable); O5 7-day readiness SVG sparkline in Card 2 (recovery.length≥3 + todayRec)

**Tests:** 2728 (unchanged) — all pass.
**Semver:** v10.3.0

**Status: ✅ O1–O5 COMPLETE**

---

## N1–N5 — Stored data visualised (2026-04-22)

**Changes:**
- `src/components/Recovery.jsx`: N1 dual mood+stress sparkline card (entries≥3); N2 lactate trend with 2.0 baseline line (isAdvanced + ≥2 readings)
- `src/components/TodayView.jsx`: N3 training pace badges (EASY/THRESH/INT in mm:ss/km) from `getTrainingPaces(vo2max)` — first UI use of vdot.js paces
- `src/components/Dashboard.jsx`: N4 cadence trend sparkline card (≥5 cadence entries); N5 FTP/MAXHR/VO₂max/WEIGHT/LT2 metrics row in header

**Tests:** 2728 (unchanged) — all pass.
**Semver:** v10.2.0

**Status: ✅ N1–N5 COMPLETE**

---

## M1–M5 — Unused function surfacing + data display (2026-04-22)

**Changes:**
- `src/components/TodayView.jsx`: M1 `isHRVSuppressed` red alert strip (above NextActionCard, gate recovery≥3); M2 RESTQ latest balance badge (between RESTQ nudge + Smart Suggestion, gate !restqDue); M5 yesterday session note quoted block in Morning Brief
- `src/components/TrainingLog.jsx`: M3 STR/FIT source badge before notes in session rows
- `src/components/Dashboard.jsx`: M4 SESSION NOTES card (last 3 entries with notes, after RecentSessionsCard)

**Tests:** 2728 (unchanged) — all pass.
**Semver:** v10.1.0

**Status: ✅ M1–M5 COMPLETE**

---

## L1–L5 — New feature enhancements (2026-04-21)

Genuine UX additions: fitness trajectory forecast, race countdown, recovery baseline, goal context.

**Changes:**
- `src/components/TodayView.jsx`: L1 `predictFitness` strip (CTL now/4w/8w + arrow); L2 race countdown from `profile.raceDate` (days + BUILD/TAPER/RACE WEEK/RACE DAY badge); L5 goal-context line in Morning Brief (goal string + CTL phase label)
- `src/components/Dashboard.jsx`: L3 `predictFitness` 4w/8w projection row after J2/J3 CTL/TSB block; `predictFitness` imported
- `src/components/Recovery.jsx`: L4 THIS WEEK vs 4W AVG score comparison badge in readiness card; `recoveryBaseline` useMemo

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v10.0.0

**Status: ✅ L1–L5 COMPLETE**

---

## K1–K5 — Final unused function sweep (2026-04-21)

Exhausts remaining unused functions from `durabilityScore.js`, `trainingLoad.js`, `interpretations.js`.

**Changes:**
- `src/components/TrainingLog.jsx`: `interpretDecoupling(pct)` replaces static "coupled/mild/significant" label in expanded session rows; bilingual; `lang` available via existing `useLocalStorage`
- `src/components/dashboard/PerformanceMetrics.jsx`: `classifyTSB` replaces generic TSB tile — zone name + Coggan advice text, color from zone.color
- `src/components/TodayView.jsx`: `computeMonotony.dailyTSS` 7-bar week strip below Morning Brief — today in orange, zeros dimmed, week TSS + monotony value right of bars
- `src/components/Dashboard.jsx`: `computeMonotony.dailyTSS` 7-bar chart inside monotony index card (Foster 1998 color-coded)
- `src/components/Recovery.jsx`: `classifyTSB` TSB zone badge below sleep warning in readiness card (gated log.length ≥ 7)
- Fix: removed duplicate `lang` from LangCtx destructure in TrainingLog (was already declared via useLocalStorage)

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.9.0

**Status: ✅ K1–K5 COMPLETE**

---

## J1–J5 — Science interpretation library surfaced (2026-04-21)

Five enhancements wiring the `src/lib/science/interpretations.js` and `subThresholdTime.js` functions into existing UI cards.

**Changes:**
- `src/components/dashboard/ACWRCard.jsx`: `interpretACWR(acwrVal)` appended below 8-week trend chart — bilingual text + citation (Gabbett 2016)
- `src/components/Dashboard.jsx`: `interpretCTL` + `interpretTSB` block below ReadinessCard (gated log.length ≥ 14, uses prev28CTL from `daily[−28]`)
- `src/components/Dashboard.jsx`: `interpretMonotony(mono, strain)` text appended inside monotony index card (Foster 1998)
- `src/components/Dashboard.jsx`: `subThresholdTrend` 8-week bar chart (Seiler 2010) — gated on profile.maxhr or profile.ftp; thresholdHR = 90% maxHR; shows bar for each week + this-week highlight in green

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.8.0

**Status: ✅ J1–J5 COMPLETE**

---

## I1–I5 — Intelligence surfacing II (2026-04-21)

Five enhancements wiring existing tested pure functions into new UI locations (second pass).

**Changes:**
- `src/components/QuickAddModal.jsx`: post-save shows `analyseSession` result (comparison + recovery_time); close delay 2.2s → 3.5s; `useData()` added for log access
- `src/components/Recovery.jsx`: `findRecoveryPatterns` card (best/worst day, optimal readiness/sleep, red flags — gated ≥7 entries + 6 pairs); `analyzeRecoveryCorrelation` card (avgRecAfterHard/Easy + insight — gated 3+ pairs)
- `src/components/Dashboard.jsx`: `EFTrendCard` (Coggan 2003, was in science/ but unmounted) lazy-loaded after InsightsPanel; efSessions useMemo transforms log to EF shape
- `src/components/TodayView.jsx`: `findSeasonalPatterns` PEAK/OFF-PEAK badge between NextActionCard and Morning Brief (gated: 3+ months data, current month in strong/weak list)
- `src/components/__tests__/QuickAddModal.test.jsx`: added `vi.mock('../../contexts/DataContext.jsx')` for new `useData()` call

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.7.0

**Status: ✅ I1–I5 COMPLETE**

---

## H1–H5 — Intelligence surfacing (2026-04-21)

Five enhancements that expose existing tested pure functions into new UI locations.

**Changes:**
- `src/components/MorningCheckIn.jsx`: sleep hours slider (4–10h, step 0.5) → saves `sleepHrs` to recovery store
- `src/lib/nextAction.js`: 2 new rules — `injury_risk_high` (priority 3, `predictInjuryRisk` HIGH, Hulin 2016) + `sleep_debt` (priority 5, avg < 7h, Mah 2011). Priority chain renumbered 0–11.
- `src/components/RaceReadiness.jsx`: `predictRacePerformance` section — 5K/10K/HM/Marathon times + VDOT (only when reliable)
- `src/components/TodayView.jsx`: HRV 7-day bar strip with `computeHRVTrend` (visible ≥3 HRV readings)
- `src/components/Profile.jsx`: `assessDataQuality` data quality card (grade/score/6 factors/tips — previously unused)
- `src/lib/__tests__/nextAction.test.js`: +8 tests (injury_risk_high × 4 + sleep_debt × 4)

**Tests:** 2728 (was 2720) — all pass. Build: clean.
**Semver:** v9.6.0

**Status: ✅ H1–H5 COMPLETE**

---

## G5 — Morning Readiness & HRV Integration (2026-04-21)

**Changes:**
- `src/lib/hrv.js`: `computeHRVTrend(entries)` + `isHRVSuppressed(entries)` — 7-day Plews 2013 CV method
- `src/lib/nextAction.js`: Rule 3 `hrv_drift` (priority 3) — easy session when HRV CV ≥10% + latest >5% below baseline
- `src/components/MorningCheckIn.jsx`: 30-second check-in modal — optional HRV RMSSD + sleep/energy/soreness sliders; saves to recovery store; shows HRV trend post-save
- `src/components/TodayView.jsx`: "Morning Readiness Check-In" button (visible when no today recovery entry); MorningCheckIn lazy-loaded
- `src/lib/__tests__/hrv.test.js`: 15 tests (NEW file)

**Tests:** 2720 (was 2705) — all pass.
**Semver:** v9.5.0

**Status: ✅ G5 COMPLETE**

---

## G4 — E14 Race Readiness Calculator (2026-04-21)

**Changes:**
- `src/components/RaceReadiness.jsx`: new tab component — score (0–100), grade (A+–F), traffic-light, 10-factor breakdown with progress bars, top-3 improvement areas, race date + goal inputs, save to profile, citation footer
- `src/contexts/LangCtx.jsx`: `t_race` label (EN: 'RACE READY', TR: 'YARIŞ HAZIRLIĞI'); `{ id: 'race', icon: '▶', lk: 't_race' }` tab added
- `src/App.jsx`: lazy import `RaceReadiness` + `tab === 'race'` render
- `src/lib/__tests__/raceReadiness.test.js`: 15 tests (acceptance gate, boundary conditions, output shape, injury suppression)

**Tests:** 2705 (was 2690) — all pass.
**Semver:** v9.4.0

**Status: ✅ G4 COMPLETE**

---

## G3 — Rules-based next-action card (2026-04-21)

**Changes:**
- `src/lib/nextAction.js`: pure rules engine — 9 priority-ordered rules (no_sessions, acwr_spike, wellness_poor, acwr_high, tsb_deep, race_taper, tsb_high, tsb_low, acwr_low, default); bilingual; citations; `isDismissed`/`dismissRule` 24h suppress
- `src/components/NextActionCard.jsx`: card component — reads from `useData()`, computes action, dismissible per-rule; color-coded by severity
- `src/components/TodayView.jsx`: `<NextActionCard />` inserted above Morning Brief
- `src/lib/__tests__/nextAction.test.js`: 29 tests covering all 9 rules + dismissal + output shape

**Tests:** 2690 (was 2661) — all pass.
**Semver:** v9.3.0 — first new user-visible feature since E12.

**Status: ✅ G3 COMPLETE**

---

## G2 — TanStack Query for three core data flows (2026-04-21)

**Changes:**
- `@tanstack/react-query` v5.99.2 installed
- `useTrainingLogQuery.js`: TQ-powered training log hook (`useQuery` + optimistic `setLog`) — replaces `useTrainingLog` in DataContext
- `useProfileQuery.js`: TQ-powered profile hook — replaces `useProfileSync` in DataContext
- `useSessionComments.js`: TQ cache seeded on `fetchComments`; `invalidateQueries` after mutations
- `useSupabaseData.js`: `logRowToEntry` + `logEntryToRow` exported for reuse
- `DataContext.jsx`: imports `useTrainingLogQuery` + `useProfileQuery`
- `App.jsx`: `QueryClientProvider` wraps `DataProvider`; `ReactQueryDevtools` lazy-loaded (dev only)
- 12 new tests in `useTrainingLogQuery.test.js` + `useProfileQuery.test.js`
- `useSessionComments.test.js`: TQ mock added
- `docs/ops/tanstack_query_pattern.md`: pattern guide for adding new TQ flows

**Tests:** 2661 (was 2649) — all pass.

**Status: ✅ G2 COMPLETE**

---

## G1 — Smart QuickAdd defaults + first-session flow (2026-04-21)

**Changes:**
- `QuickAddModal.jsx`: sport-based default type, duration=45, RPE=6 defaults; Valibot SessionSchema; post-save confirmation phase (2.2s); "Training Load (TSS)" label; Foster 2001 citation; first-session 🏆 celebration; `isFirst` prop
- `App.jsx`: passes `profile` and `isFirst` props to QuickAddModal
- `useAppState.js`: `handleAddSession` auto-navigates to Today tab after first session (2.4s delay)
- `src/components/__tests__/QuickAddModal.test.jsx`: 18 new tests (NEW file)
- `docs/ops/new_user_flow.md`: flow documentation

**Tests:** 2649 (was 2631) — all pass.

**Status: ✅ G1 COMPLETE**

---

## F1 — Auth flow audit (2026-04-21)

**Gate:** F-series pre-flight passed (5 ✅ in log, Sentry DSN set, route-smoke 27/27).

**Findings:** 4 findings. 3 fixed. 1 documented.

| # | Finding | Status |
|---|---------|--------|
| 1 | Stale `lhr-present.github.io` in Supabase allowed redirect URLs | ✅ Fixed |
| 2 | `prompt:'consent'` forced Google consent screen on every returning login | ✅ Fixed |
| 3 | Dev redirect URL had wrong `/sporeus-athlete/` path suffix | ✅ Fixed |
| 4 | Sign-out does not clear user localStorage (shared-device privacy) | Documented — intentional design |
| 5 | `flowType:'implicit'` (not PKCE) | No action — protected invariant |

**Changes:**
- `AuthGate.jsx`: replaced `{ access_type:'offline', prompt:'consent' }` → `{ prompt:'select_account' }`
- Supabase `uri_allow_list`: removed stale GitHub Pages URL + wrong dev path, added `http://localhost:5173/`
- `AuthGate.test.jsx`: 2 new assertions (OAuth params, redirectTo construction)
- `docs/ops/auth_flow_audit.md`: full findings doc

**Tests:** 2631 (was 2629) — all pass.

**Status: ✅ F1 COMPLETE**

## Item 1 — /b/ch7 chapter landing smoke (2026-04-20)

**Gate:** E16 prerequisite — ChapterLanding must render without auth, CTA must redirect with correct UTM params.

**Root bug fixed (v9.2.3):** `if (BOOK_MODE)` was positioned at line 522 in App.jsx, after `if (!user) return <AuthGate>` at line 486. Unauthenticated visitors (QR code scans) always hit the login wall instead of ChapterLanding. Fixed by moving BOOK_MODE early-return to line 479 — immediately after `const userId = ...`, before the auth gate block.

**Smoke results (localhost:5174):**

| # | Check | Result |
|---|-------|--------|
| 1 | Page renders (not white screen / 404) | ✅ "Chapter 7 — Training Stress & Recovery" |
| 2 | Ch7-specific content | ✅ TSS Estimator (Banister 1991), TRIMP calculator |
| 3 | Signup CTA present | ✅ "Create Free Sporeus Account →" |
| 4 | CTA → `/?utm_source=esik_book&utm_medium=qr&utm_content=ch7` | ✅ exact match |
| 5 | LocalStorage `spa_first_touch` contains /b/ch7 | ✅ present |

Console: CORS errors on `/attribution-log` endpoint — dev-only, not gate-blocking.

**Status: ✅ ITEM 1 COMPLETE**

## Item 2 — VITE_SENTRY_DSN (2026-04-21)

**Gate:** E15 prerequisite — Sentry must receive errors in production.

- `npm install @sentry/react` — installed
- `gh secret set VITE_SENTRY_DSN` — set (2026-04-20T22:06:50Z)
- `index.html` CSP `connect-src` — added `https://o4511166567022592.ingest.de.sentry.io`
- `.env.test` — added `VITE_SENTRY_DSN=` to preserve no-op test assertion
- Verified: Playwright smoke sent 4 envelopes to ingest endpoint; no "DSN not set" warning

**Status: ✅ ITEM 2 COMPLETE**

## Item 3 — coach_athletes schema in realtime_runbook.md (2026-04-21)

**Gate:** E11 prerequisite — `docs/ops/realtime_runbook.md` must document `coach_athletes` schema so realtime subscription setup is reproducible.

**Action:** `coach_athletes` schema (columns: `coach_id`, `athlete_id`, `status`, `coachLevelOverride`) added to `realtime_runbook.md` in v9.2.2 commit. Verified: `grep -c "coach_athletes" docs/ops/realtime_runbook.md` → 5 matches.

**Status: ✅ ITEM 3 COMPLETE**

## Item 4 — comment-notification webhook (2026-04-21)

**Gate:** E11 prerequisite — Supabase webhook must fire on `session_comments INSERT` → `comment-notification` edge function.

**Actions taken:**
1. Applied migration `20260460_realtime_comments.sql` — created `session_comments` + `session_views` tables, RLS policies, Realtime publication
2. Created webhook trigger via SQL on `public.session_comments AFTER INSERT`

**Verified trigger in DB:**
```
trigger_name:        comment-notification
event_manipulation:  INSERT
target:              https://pvicqwapvvfempjdgwbm.supabase.co/functions/v1/comment-notification
method:              POST
timeout_ms:          10000
```

**Status: ✅ ITEM 4 COMPLETE**

## Item 5 — Two-browser E11 RLS smoke (2026-04-21)

**Gate:** E11 RLS must isolate session_comments and session_views per participant.

**Method:** pgTAP + direct SQL checks via Supabase Management API against live DB.

**Bug found and fixed during test:**
- `sv: read own or linked` policy third branch checked `ca.coach_id = tl.user_id` (session owner is a coach) — never matches since sessions are athlete-owned.
- Fixed in migration `20260461_fix_sv_rls.sql`: added fourth branch — "viewer is my coach" (`ca.coach_id = session_views.user_id AND ca.athlete_id = tl.user_id AND tl.user_id = auth.uid()`).

**7-scenario results:**

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | Athlete reads own session comments | 1 | ✅ 1 |
| 2 | Coach reads linked athlete session | 1 | ✅ 1 |
| 3 | Unlinked user reads (isolation) | 0 | ✅ 0 |
| 4 | Unlinked user INSERT blocked | 42501 | ✅ 42501 |
| 5 | Spoofed author_id blocked | 42501 | ✅ 42501 |
| 6 | Athlete sees coach presence (session_views) | 1 | ✅ 1 |
| 7 | Unlinked user sees no presence | 0 | ✅ 0 |

**Scope clarification:** What was tested above is RLS isolation (7 SQL-level assertions equivalent to scenario E of the debt checklist). Behavioral scenarios A–D and F–G — comment CRUD flow, edit/soft-delete, offline queue, reconnect, concurrent editing, stress — were **not** tested. CoachPresenceBadge rendering against the fixed policy was not browser-verified.

**CoachPresenceBadge data-layer analysis (without real auth):**
- SQL: `SELECT session_views WHERE user_id=coachId AND session_id=X` now returns 1 row for the athlete ✅ (verified above)
- Realtime: `postgres_changes` on `session_views` passes through RLS; REPLICA IDENTITY FULL set; component filter `row.user_id === coachId` guards correctly ✅
- Browser: full two-browser rendering test (real auth, real coach views real session, athlete sees badge) **deferred** — requires real credentials, cannot be automated without them

**Deferred:** Full behavioral smoke (scenarios A, B, C, D, F, G) deferred to a separate manual session. E14 proceeds on RLS-isolation-only evidence.

**Status: ✅ ITEM 5 RLS SMOKE COMPLETE — E14 UNBLOCKED (behavioral scenarios deferred)**

---

## Deferred from debt session (2026-04-21)

Two items explicitly deferred from the debt session. Not RLS-critical, not E14-blocking, but must be tracked with specific next actions rather than left in session notes.

### Deferred Item A — CoachPresenceBadge two-browser render

**Scope:** Verify that after the `20260461_fix_sv_rls.sql` policy fix, a real athlete session (authenticated, real JWT) shows the CoachPresenceBadge when the linked coach has a `session_views` row.

**Why deferred:** Requires two simultaneous real authenticated sessions (coach + athlete). Cannot be automated without real credentials in test env. Data-layer evidence confirmed (SQL scenario 6 passes; Realtime REPLICA IDENTITY FULL set; component filter correct), but browser rendering not verified.

**Next action:** Manual two-browser test in a real Supabase session. Open athlete session view as athlete; separately open the same session as coach to create a `session_views` row; confirm badge renders. Expected: badge appears within Realtime subscription latency (~500ms). File a passing test note in this document when done.

**Blocking:** Nothing in E14–E20. Pick up before E11 behavioral block.

---

### Deferred Item B — E11 behavioral scenarios A–D, F–G

**Scope:** Comment CRUD flow end-to-end (A), edit/soft-delete (B), offline queue behavior (C), reconnect recovery (D), concurrent editing (F), stress test / message ordering (G). These are behavioral Playwright/manual tests for the `useSessionComments` hook and `commentActions.js` flows.

**Why deferred:** Debt session item 5 verified RLS isolation only (SQL-level, 7 scenarios). Behavioral flows require either a running dev server with two auth sessions or purpose-built Playwright multi-user fixtures. Time constraint in debt session.

**Next action:** Create a dedicated E11-behavioral block. Recommend:
1. Playwright multi-context fixture (two `browser.newContext()` with different storage states, each authenticated as coach/athlete)
2. Cover scenarios A (post, read, reply), B (edit title shows edited-at, soft-delete hides body), C (queue survives offline), D (queue drains on reconnect), F (two editors, last-write-wins vs optimistic), G (50-message burst, ordering preserved)
3. Add to CI as a separate `e11-behavioral` job gated on `rls-harness` passing

**Blocking:** Nothing in E14–E20. Pick up as a standalone block after E14 closes.

---

## 2026-04-25 — Debt-only session: E14 gate cleared

All 5 deferred items confirmed closed:

| # | Item | Method | Result |
|---|------|--------|--------|
| 1 | /b/ch7 chapter landing smoke | Logged 2026-04-20 in this file | ✅ |
| 2 | VITE_SENTRY_DSN configured | `gh secret list` shows key set 2026-04-20 | ✅ |
| 3 | coach_athletes schema in runbook | `grep coach_athletes docs/ops/realtime_runbook.md` returns columns + indexes | ✅ |
| 4 | comment-notification webhook | SQL query against `supabase_functions.hooks` — 14 invocations since 2026-04-20 | ✅ |
| 5 | RLS isolation (scenarios 6+7) | SQL SET-based proof in realtime_runbook.md § "E14 Gate" | ✅ |

No RLS leaks. E14 is unblocked. Proceeding to E14: Race Readiness Score + Pace Strategy + Taper Simulator.
