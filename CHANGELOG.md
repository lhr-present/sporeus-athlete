# Changelog

All notable changes. Each entry notes what it DEPENDS ON (do not remove).

## v5.18.0 (2026-04-12)
Athlete comparison, Banister chart, Zone Distributor — 426 tests (25 new):

**Athlete Comparison Overlay (CoachSquadView)**
- Checkbox column (desktop table + mobile card) to select 2–5 athletes
- Comparison panel auto-appears when ≥ 2 selected: 4 metric rows (CTL, ACWR, Wellness%, TSB)
- Horizontal bars normalized to max within each metric; 5 distinct athlete colours
- "× CLEAR" button resets selection; max 5 enforced (disabled state on extra checkboxes)

**Banister Impulse-Response Chart (Dashboard)**
- Uses existing `fitBanister(log, testResults)` + `predictBanister(log, fit, [], 60)` from trainingLoad.js
- Shows when testResults.length ≥ 3 and fit is non-null
- SVG: historical test dots (orange) + 60-day projected performance curve + today divider line
- Stats badge: R², k₁ (fitness gain coefficient), k₂ (fatigue cost coefficient)

**Zone Distributor (Dashboard)**
- `src/lib/zoneDistrib.js`: `rpeToZone` (Borg 1–10 → Z1–5), `zoneDistribution` (duration-weighted from filteredLog), `trainingModel` (polarized/pyramidal/threshold/recovery/mixed)
- Card uses date-range filtered sessions; stacked colour bar with per-zone % breakdown
- Model badge: POLARIZED (green) / PYRAMIDAL (blue) / THRESHOLD-HEAVY (yellow) / etc.
- Training tip per model from MODEL_META; bilingual
- 25 new tests in `src/lib/zoneDistrib.test.js`

- DEPENDS ON: filteredLog + rangeLabel already in Dashboard; testResults from useData(); compareIds in CoachSquadView

## v5.17.0 (2026-04-12)
Tier 2 recovery tools: OSTRC, RTP, CycleTracker — 401 tests (36 new):

**OSTRC-Q2 Weekly Injury Surveillance (OSTRCQuestionnaire.jsx)**
- IOC OSTRC-Q2 (Clarsen et al. 2020): 4 questions × 0–25 scale = 0–100 total
- Weekly gate via ISO week key (isoWeekKey) — prevents double submission
- Risk tiers: none / minor / moderate / substantial; red coach-flag banner at score > 50
- 8-week bar chart history; update form shown for corrections
- `sporeus-ostrc` localStorage key; bilingual EN/TR
- `src/lib/ostrc.js`: 3 pure functions — `ostrcScore`, `ostrcRisk`, `isoWeekKey`
- 18 tests in `src/lib/ostrc.test.js`

**Return-to-Play Protocol (RTPProtocol.jsx)**
- 5-stage ladder (Rest → Light Aerobic → Sport-Specific → Non-Contact → Full Practice)
- Per-zone protocol tracking: zone selection from 10 body-zone list
- Manual stage advance/back with date reset; stage progress bar; days-at-stage counter
- Complete protocol → archived in completed list; delete anytime
- `sporeus-rtp` localStorage; bilingual EN/TR

**Menstrual Cycle Tracker (CycleTracker.jsx)**
- localStorage-only (`sporeus_cycle` — already reserved); zero DB exposure
- 4 phases auto-calculated from last period start + cycle length (21–45 days)
- Training tips per phase (based on estrogen/progesterone physiology)
- Days-to-ovulation and days-to-next-period countdown
- HRV 28-day sparkline with phase colour bands as background overlay
- `src/lib/cycleUtils.js`: `cycleDay`, `currentCyclePhase`, `daysUntilPhase`, `PHASE_INFO`
- 18 tests in `src/lib/cycleUtils.test.js`

- All three mounted in Recovery.jsx wrapped in `<ErrorBoundary inline>` (below injury risk widget)
- DEPENDS ON: useData().recovery for CycleTracker HRV overlay; useLocalStorage hook; S from styles.js

## v5.16.0 (2026-04-12)
Coach tools + training intelligence layer — 365 tests (36 new):

**Weekly Coach Digest (coachDigest.js + CoachSquadView)**
- New `src/lib/coachDigest.js`: 6 pure exported functions — `ctlTrend` (7-day log delta, TSB proxy fallback), `wellnessAvg` (HRV 4.5–9 scale + adherence blend), `trendLabel`, `acwrStatusLabel`, `generateAthleteDigestLine`, `generateSquadDigest`
- CoachSquadView: collapsible "◈ WEEKLY DIGEST ▼" panel above athlete table; generated on open from live sorted array; "COPY ALL" button flashes green "✓ COPIED" for 2s after clipboard write
- 36 new tests in `src/lib/coachDigest.test.js` (all 6 functions, log/TSB branches, HRV clamping, regex format checks)

**Dashboard — Date Range Filter + Trend Arrows**
- 4 filter buttons (7D / 28D / 90D / SEASON) in header; persisted to `sporeus-dash-range` localStorage
- filteredLog drives display stats; full log always used for PMC/ACWR EWMA accuracy
- CTL/ATL/TSB each show 7-day delta arrow (↑N green / ↓N red) when prev7 snapshot available
- CTLChart days prop scales with range (30/90/180/730 days)

**Missed Check-in Badge (CoachSquadView)**
- After 10:00 AM, athletes whose `last_session_date ≠ today` show amber "⚠ NO CHECK-IN" badge
- Desktop row left-border + mobile card left-border turn yellow on missed check-in

**Protocols — MDC + Test History + Goals**
- `MDC_PCT` map (9 test types, SEM 3.5–5.5%) applied to every comparison
- 4th stat box: ✓ REAL GAIN / ⚠ REAL DECLINE / ~ WITHIN NOISE with MDC footnote
- TestHistoryChart: SVG sparkline with goal line, date/value labels, progress bar Start→Current→Goal
- Per-test goal state (set/clear) with gap-to-goal % display
- 7 new MDC formula tests in formulas.test.js

**TodayView — Z-score Wellness Baseline**
- `wellnessBaseline` useMemo: 28-day rolling mean ± SD from athlete's own recovery history (min 7 records)
- Z-score badge after readiness: amber (z < −1.0) / red (z < −1.5); bilingual EN/TR

**ErrorBoundary — Inline Mode**
- `inline` prop: compact 1-line fallback for sub-components (vs full tab-level fallback)
- Wrapped: RaceReadinessCard + CTLChart (Dashboard), HRVDashboard + InjuryTracker + MentalTools (Recovery)

- DEPENDS ON: calcLoad from formulas.js (CTL EWMA), existing athlete shape from squad-sync/generateDemoSquad, `sporeus-dash-range` localStorage key (new)

## v5.15.0 (2026-04-12)
Remove all EŞİK/THRESHOLD book marketing — app is a standalone product:
- App.jsx footer: removed "· EŞİK / THRESHOLD 2026"
- AuthGate.jsx version tag: removed "· EŞİK / THRESHOLD 2026"
- Dashboard.jsx quick links: removed "EŞİK Kitabı" and "THRESHOLD Book" link entries
- PlanGenerator.jsx PDF footer: replaced "· EŞİK / THRESHOLD" with science authors (Seiler, Issurin, Bompa)
- Profile.jsx coach card: removed "EŞİK / THRESHOLD — Yazar / Author" subtitle line
- Profile.jsx about section: rewritten as standalone app description; EŞİK book link → sporeus.com
- Profile.jsx share-card PNG watermark: replaced book attribution with "sporeus.com — Science-based endurance training console"
- Protocols.jsx lactate protocol: replaced "Ref: EŞİK / THRESHOLD, Chapter 4" with Faude et al. (2009) journal citation
- Protocols.jsx W' balance note: replaced "Ref: EŞİK / THRESHOLD ch.5" with "J Strength Cond Res 26(8)" journal ref
- reportGenerator.js report header: removed "· EŞİK / THRESHOLD" from branding line
- reportGenerator.js report footer: replaced book attribution with "sporeus.com — Science-based endurance training console"
- PRESERVED: all science citations (Skiba 2012, Faude 2009, Hulin 2016, Seiler, Stöggl), sporeus.com links, threshold pace UI labels (those are running terms)
- sw.js: CACHE_VERSION bumped to sporeus-v5.15.0
- 322 tests unchanged and green
- DEPENDS ON: nothing removed that features depend on

## v5.14.0 (2026-04-12)
Today View — single-screen daily HQ replacing 4-tab daily workflow:
- intelligence.js: getTodayPlannedSession(plan, today) — returns today's session from saved plan (or null for rest/no-plan), with weekIdx/dayIdx/weekPhase
- intelligence.js: getSingleSuggestion(log, recovery, profile) — priority-ordered smart suggestion: fatigue debt → load spike → inactivity → low readiness → positive form → streak → default
- TodayView.jsx: 4-card layout (Today's Session, Readiness Quick-Check, Quick Stats, Smart Suggestion)
  - Card 1: planned session type/duration/RPE/phase, MARK DONE + LOG THIS buttons, PLAN tab CTA if no plan
  - Card 2: inline 3-field wellness (sleep/energy/soreness) saves to recovery; shows score if already logged today
  - Card 3: yesterday logged badge, 7-day session count, streak counter with 🔥 at 3+
  - Card 4: color-coded suggestion (red=warning, green=ok, blue=info)
- LangCtx.jsx: 16 new EN+TR keys (t_today, todaySession, todayRest, todayDone, todayMarkDone, todayLogThis, todayNoPlan, todayReadiness, todaySaveReadiness, todaySaved, todayQuickStats, todayYesterday, todayThisWeek, todayStreak, todaySuggestion, todayLogYesterday)
- LangCtx.jsx: TABS prepended with today tab (◉ TODAY / BUGÜN)
- App.jsx: TodayView wired as first/default tab (useState('today'))
- sw.js: CACHE_VERSION bumped sporeus-v5.13.0 → sporeus-v5.14.0
- 10 new tests (332 total — getTodayPlannedSession × 5, getSingleSuggestion × 5)
- DEPENDS ON: sporeus-plan + sporeus-plan-status localStorage, useData() recovery/setRecovery, intelligence.js helpers computeCTL/computeATL/daysAgoDate

## v5.13.1 (2026-04-12)
Full codebase audit — 4 bugs fixed:
- CRITICAL/validate.js: sanitizeLogEntry now preserves distanceM, durationSec, avgHR, distance, avgCadence — these were silently stripped, breaking VO2max trend estimation for FIT imports. 2 new tests added (312 total).
- HIGH/sw.js: CACHE_VERSION bumped sporeus-v5.12.0 → sporeus-v5.13.0; comment header updated. Stale caches from v5.12 now invalidated on next SW install.
- HIGH/Dashboard.jsx: loadSpikeP now uses date-filtered thisWeekTSS (not log.slice(-7)) for week-over-week comparison — fixes incorrect spike% when athlete logs ≠7 sessions per week.
- MEDIUM/ActivityHeatmap.jsx: default prop log=[] + Array.isArray guard prevents crash if null/undefined passed.
- LOW/WeekBuilder.jsx: duplicate borderRight key removed (build warning gone).
- DEPENDS ON: nothing new

## v5.13.0 (2026-04-12)
- ActivityHeatmap.jsx: GitHub-style 52-week training density heatmap (orange intensity scale by TSS), mounted in Profile tab
- Dashboard: sRPE load (RPE × duration, Foster 2001) added as 5th stat badge in the 7-day summary row
- Dashboard: standalone load spike alert — shows amber banner for ALL users when this week's TSS is ≥10% above last week (no injury history required)
- VO2maxCard: ACSM normative percentile badge (Poor/Fair/Good/Excellent/Superior) next to VDOT score, age + gender aware, 6 age bands × 2 genders (ACSM 11th ed.)
- 310 tests still green; main bundle +6 KB gzip (134 KB)
- DEPENDS ON: existing log TSS data, profile.age + profile.gender for normative lookup

## v5.12.2 (2026-04-12)
- src/lib/integration.test.js: 41 new end-to-end pipeline tests across 5 scenarios
  - Scenario 1: Endurance runner 6 months (PMC, ACWR, VO₂max trend, VDOT, race equivalents)
  - Scenario 2: Cyclist with power data (MMP, CP fit, interval detection, FTP estimate)
  - Scenario 3: HRV morning readiness (clean/detect ectopics, RMSSD, lnRMSSD, scoreReadiness)
  - Scenario 4: Yearly plan builder (52 weeks, race week phase, deloads, CSV export)
  - Scenario 5: Demo squad smoke test (6 athletes, determinism, training status, adherence)
- 310 tests total (was 269)
- vite.config.js: manualChunks split recharts → vendor-recharts (160 KB gz), supabase → vendor-supabase (51 KB gz), fit-file-parser → vendor-fit (40 KB gz)
  - Main app bundle: 385 KB gz → 132 KB gz (65% reduction in first-parse cost)
  - Vendor chunks are long-term cacheable (content-hashed, rarely change)
- PWA checklist: all 8 icon sizes present, sw.js + registerSW.js + manifest.webmanifest in dist, NetworkFirst Supabase routes, CACHE_VERSION cache buster, stale cache cleanup on activate
- DEPENDS ON: nothing new

## v5.12.1 (2026-04-12)
Audit fixes — 15 issues resolved across 4 priority groups.
- P1/TrainingLog.jsx: null guard on log.find() before spread in startEdit (crash on edit)
- P1/DeviceSync.jsx: null guard on results array before .filter() (crash on edge-fn failure)
- P1/PowerCurve.jsx: moved localStorage.getItem to useMemo (was re-parsing JSON every render)
- P2/sw.js: CACHE_VERSION updated from sporeus-v5.11.0 → sporeus-v5.12.0 (stale cache buster)
- P2/sw.js: comment header updated to v5.12.0
- P3/Dashboard.jsx: useMemo on analyzeLoadTrend, analyzeZoneBalance, predictFitness, analyzeRecoveryCorrelation in InsightsCard
- P3/charts/HRVChart.jsx: isAnimationActive={false} on both Line elements
- P3/charts/LoadChart.jsx: isAnimationActive={false} on Bar element
- P3/Periodization.jsx: isAnimationActive={false} on CTL/ATL/TSB Line elements
- P3/VO2maxCard.jsx: isAnimationActive={false} on VDOT trend Line
- P4: 11 new edge case tests in trainingLoad.test.js (null TSS, single entry, empty log, array immutability)
- P4: 6 new edge case tests in periodization.test.js (no-race plan, polarized zones, block model, negative TSS clamp)
- 269 tests total (was 258)
- DEPENDS ON: nothing new

## v5.12.0 (2026-04-12)
- SQL migration: supabase/migrations/20260415_device_sync.sql — athlete_devices table (provider, label, base_url, token_enc bytea), encrypt_device_token / decrypt_device_token plpgsql functions (pgcrypto), RLS
- Edge function: supabase/functions/device-sync/index.ts — JWT-verified, fetches devices, decrypts tokens via rpc, proxies open-wearables /api/v1/activities + /api/v1/recovery (8s AbortController timeout each), maps OW schema → training_log + recovery, updates last_sync_at, per-device try/catch (never throws)
- src/lib/deviceSync.js — mapOWActivity (type normalizer), getDevices (no token_enc col), addDevice (URL validation, server-side token encryption via rpc), removeDevice, triggerSync (invoke 'device-sync', returns {results,error} never throws)
- DeviceSync.jsx: device list + add form (provider picker, validated URL, optional token) + sync-now button + status banner
- docker/open-wearables/docker-compose.yml + README.md: self-hosted open-wearables setup for Garmin/Polar/Suunto/COROS/Wahoo/Oura/Whoop
- Profile.jsx: DeviceSync mounted after NotificationSettings (above AdminCodeGenerator)
- App.jsx: auto-trigger triggerSync if last sync > 4h ago (sporeus-last-device-sync localStorage)
- 12 new tests (258 total)
- DEPENDS ON: pgcrypto extension in Supabase, supabase.functions.invoke, open-wearables /api/v1/activities + /api/v1/recovery endpoints

## v5.11.0 (2026-04-12)
- PWA Hardening: src/sw.js — CACHE_VERSION constant, activate handler cleans stale sporeus-* caches, Supabase routes upgraded from NetworkOnly → NetworkFirst (3s timeout, 5min TTL, CacheableResponsePlugin), CacheableResponsePlugin import
- InstallPrompt.jsx: beforeinstallprompt capture, 30s delay, iOS share-sheet instructions fallback, standalone-mode guard, dismiss persisted to localStorage
- src/lib/pushNotifications.js — requestPermission, scheduleSessionReminder (setTimeout-based daily alarm, SW showNotification + plain fallback), cancelReminder, fmtSessionList, getReminderSettings/saveReminderSettings
- NotificationSettings.jsx: toggle switch, 24-hour picker, permission badge (ALLOWED/BLOCKED/NOT SET)
- OfflineBanner.jsx: online/offline event listeners, amber top banner
- useSupabaseData.js: added .catch() on hydration fetch; sets/clears sporeus-offline-mode localStorage flag
- scripts/generate-icons.js: generates 8 placeholder PNGs (72,96,128,144,152,192,384,512) in public/icons/
- vite.config.js manifest: 8 icons, background_color #0a0a0a
- App.jsx: mounts OfflineBanner + InstallPrompt, scheduleSessionReminder useEffect on load
- Profile.jsx: NotificationSettings mounted above AdminCodeGenerator
- 8 new tests (246 total)
- DEPENDS ON: workbox-cacheable-response (workbox-strategies bundle), existing sw.js precache setup, Notification API (browsers only)

## v5.10.0 (2026-04-12)
- Periodization Engine: src/lib/periodization.js — buildYearlyPlan (52-week, 3 models, phase assignment, EWMA CTL projection), validatePlan (4 warning types), updateWeekTSS (pure/immutable), exportPlanCSV
- YearlyPlan.jsx: 52-week scrollable calendar (phase band + TSS bars), CTL projection SVG overlay, today marker, week detail panel (TSS edit, zone bars, copy-forward), race manager (add/remove/priority), model switcher, Export CSV, Supabase upsert + localStorage
- WeekBuilder.jsx: full-screen overlay, session library (10 templates), 7-day drag-and-drop grid (HTML5 drag API), multi-session per day, TSS summary bar with over-target warning, save to sporeus-week-{weekStart}
- App.jsx: PLAN tab now routes to YearlyPlan (replaces PlanGenerator)
- supabase/migrations/20260414_training_plans.sql: training_plans table, RLS, updated_at trigger
- trainingLoad.test.js: fixed pre-existing ACWR timezone tolerance issue
- 33 new tests (238 total)
- DEPENDS ON: calculatePMC+calculateACWR in trainingLoad.js, useLocalStorage, useAuth, supabase.js, DataContext log

## v5.9.0 (2026-04-12)
- VO₂max + VDOT Engine: src/lib/vo2max.js — vdotFromRace (Daniels 1998 polynomial, 3.5–240 min), vdotFromPaceHR (Firstbeat-style), zonesFromVDOT (Newton iteration + 5 Daniels zones), raceEquivalents (binary search, 7 distances), estimateVO2maxTrend (ISO-week grouping, ≤52 entries), fmtPaceSec
- VO2maxCard.jsx: VDOT badge + Cooper comparison, 52-week Recharts trend (confidence-coded dots), race equivalents grid, collapsible Daniels training zones, manual race input (dist + HH:MM:SS → recalculate)
- VO2maxCard mounted in Protocols.jsx after PowerCurve
- 35 new tests (205 total) — vdotFromRace, vdotFromPaceHR, zonesFromVDOT, raceEquivalents, fmtPaceSec, estimateVO2maxTrend
- DEPENDS ON: recharts LineChart, cooperVO2 from formulas.js, useData() log from DataContext

## v5.8.0 (2026-04-12)
- SQL migration: supabase/migrations/20260413_squad_overview.sql — ALTER coach_notes ADD category, get_squad_overview() plpgsql function (EWMA CTL/ATL per athlete via date series CTE, ACWR, training_status, HRV, adherence)
- Edge function: supabase/functions/squad-sync/index.ts — JWT-verified, calls get_squad_overview(coach_id), empty array on no athletes
- src/lib/squadUtils.js — makeLCG (seeded RNG), generateDemoSquad (6 cycling legends, deterministic), deriveTrainingStatus, mapAcwrStatus
- src/components/CoachSquadView.jsx — squad table (desktop) / card stack (mobile), sortable columns, flagged rows (localStorage), row expand with CTLChart+sessions, note panel (slide-in, Supabase + demo fallback)
- CoachSquadView lazy-loaded first in coach section, above CoachOverview
- Demo mode amber banner + empty state invite code display
- 23 new tests (170 total)
- DEPENDS ON: calculatePMC+calculateACWR in trainingLoad.js, CTLChart, supabase.js, coach_athletes table (status=active), coach_notes table

## v5.7.0 (2026-04-12)
- Power Curve Engine: src/lib/powerAnalysis.js — calculateMMP (O(n) sliding window, KEY_DURATIONS), fitCriticalPower (OLS linear regression P=W′/t+CP), detectIntervals (≥0.85×CP for ≥20s, merge gaps <5s), estimateFTP (60m→20m×0.95→8m×0.90)
- calculateWPrimeBalance re-exports computeWPrime from formulas.js (Skiba model already exists)
- PowerCurve.jsx: log-scale X-axis ComposedChart, season-best MMP (orange), activity MMP (blue), CP model overlay (dashed), FTP estimate badge, CP reference line
- IntervalBreakdown.jsx: zone-colored interval cards sorted by avg power, Z1–Z6 with duration/NP/%CP
- PowerCurve mounted in Protocols tab (Tests) above progress comparison
- sanitizeLogEntry extended: wPrimeExhausted, source, hasPower passthrough (fixes existing stripping bug)
- TrainingLog.confirmImport: stores power stream to sporeus-power-{id} in localStorage (cap 10800s)
- 20 new tests (147 total)
- DEPENDS ON: recharts ComposedChart, existing computeWPrime+normalizedPower in formulas.js

## v5.6.0 (2026-04-12)
- HRV Engine: src/lib/hrv.js — cleanRRIntervals (±4-beat ectopic detection + linear interpolation), calculateRMSSD, calculateLnRMSSD, scoreReadiness (3-zone 1-10 scale), calculateDFAAlpha1 (Gronwald 2019, scale n=4–16), parsePolarHRM
- HRVDashboard.jsx: readiness score circle, 30-day lnRMSSD trend (Recharts + 7d baseline band), DFA-α1 badge with LT1 interpretation, .hrm file upload, manual RMSSD entry, ectopic% warning
- HRVDashboard integrated into Recovery tab above InjuryTracker
- Recovery entries extended: rmssd, lnRMSSD, dfaAlpha1, ectopicPct, source fields
- 26 new tests (127 total)
- DEPENDS ON: existing recovery entries in Supabase + localStorage, recharts

## v5.5.0 (2026-04-12)
- Training Load Engine: src/lib/trainingLoad.js (calculatePMC, calculateACWR, fitBanister, predictBanister)
- CTLChart upgraded to full PMC: TSS bars, sweet-spot zones, race markers, split TSB (green/red)
- ACWR · Monotony · Strain badges above PMC chart in Dashboard
- 17 new tests (101 total) covering PMC, ACWR, Banister model
- DEPENDS ON: recharts ComposedChart, raceResults from DataContext

## v5.4.1 (2026-04-12)
- Stabilization framework: .claude/rules.md (10 binding rules), ARCHITECTURE.md (7 invariants), CHANGELOG.md
- NO CODE CHANGED — documentation and tooling only
- DEPENDS ON: nothing new

## v5.4.0 (2026-04-12)
- 84 unit tests (vitest) — CI-gated, deploy blocked if failing
- scripts/healthcheck.sh — 7-check pre-push verification
- CLAUDE.md complete rewrite
- DEPENDS ON: vitest in devDependencies, test config in vite.config.js

## v5.3.0 (2026-04-12)
- W' exhaustion alert on FIT import (needs profile.cp + profile.wPrime)
- Strava diagnostics card in Profile
- safeFetch utility (src/lib/fetch.js)
- React.memo on CTLTimeline, WeeklyVolChart, ZoneDonut
- DEPENDS ON: computeWPrime in formulas.js, FIT parser in fileImport.js

## v5.2.0 (2026-04-11)
- Coach↔Athlete messaging (file-based JSON)
- Week-by-week plan notes + athlete responses
- ACWR load forecast (4-scenario)
- Guided W' setup flow
- Guest upgrade nudge (30d / 50 sessions)
- DEPENDS ON: coach_plans table in Supabase, sporeus-messages-* keys

## v5.1.0 (2026-04-11)
- Power TSS (NP/IF from FIT power series)
- CP Test protocol (Morton 1996 2-point model)
- Data quality indicator (6-factor A-F grade)
- Coach compliance dot-grid
- Coach level override
- DEPENDS ON: computeNormalizedPower + computePowerTSS in fileImport.js

## v5.0.0 (2026-04-11)
- Supabase phases 0-3 complete (auth, sync, Strava, push, plans)
- CoachPlansCard in Periodization
- DEPENDS ON: all Supabase infrastructure, edge functions, migrations 001-003

## v4.6.0 (2026-04-10)
- Race readiness 10-factor score
- Performance prediction (CTL-adjusted Riegel, VDOT, training pace)
- Race Week Mode + Post-Race Analysis
- DEPENDS ON: computeRaceReadiness, predictRacePerformance in intelligence.js

## v4.5.0 (2026-04-10)
- Pattern recognition engine (5 functions in patterns.js)
- Proactive injury alerts
- Optimal week recommendation in plan generator
- DEPENDS ON: patterns.js, minimum data thresholds

## v4.3-4.4 (2026-04-10)
- Intelligence engine (intelligence.js)
- 40+ science notes (scienceNotes.js)
- Weekly narrative, milestones, session scoring
- Training age context
- DEPENDS ON: intelligence.js, scienceNotes.js

## v4.1-4.2 (2026-04-10)
- Coach invite system (SHA-256 codes, 3-athlete free limit)
- Input validation (validate.js)
- Lazy loading (CoachDashboard, PlanGenerator, Glossary)
- DEPENDS ON: SPOREUS_SALT, MASTER_SALT in formulas.js (DO NOT CHANGE)

## v3.0-4.0 (2026-04-09 to 2026-04-10)
- Architecture split (24 components)
- Error boundaries, dark mode, onboarding
- Zone calculators, test protocols, training log
- Coach module, achievements, recovery
- DEPENDS ON: everything above — this is the foundation
