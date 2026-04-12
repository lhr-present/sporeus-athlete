# Changelog

All notable changes. Each entry notes what it DEPENDS ON (do not remove).

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
