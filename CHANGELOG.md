# Changelog

All notable changes. Each entry notes what it DEPENDS ON (do not remove).

---

## v11.39.0 — 2026-04-25
E35: InjuryPatternCard — mineInjuryPatterns() wired (only patterns.js fn not yet in Dashboard); vulnerable zone chips, trigger tags, protective factors, confidence badge (Gabbett 2016); src/lib/athlete/injuryPatterns.js + 10 tests.

---

## v11.38.0 — 2026-04-25
E34: LoadProjectorCard — 4-week CTL/TSB forward projection at current + +10% load (EWMA PMC, Banister 1991, Coggan PMC); dual SVG line chart, TSB zone coloring; src/lib/athlete/loadProjector.js + 12 tests.

---

## v11.37.0 — 2026-04-25
E33: PRTimelineCard — scans full log for PR events using detectPRs(), recent-5 timeline with improvement %, total PR count, days-since-last; src/lib/athlete/prTimeline.js + 12 tests.

---

## v11.36.0 — 2026-04-25
E32: PlanAdherenceCard — week-by-week planned vs actual TSS compliance (80–115% on-track), 8-bar SVG with baseline, stats row; src/lib/athlete/planAdherence.js + 10 tests.

---

## v11.35.0 — 2026-04-25
E31: CyclePlannerCard — menstrual cycle training guide (currentCyclePhase/PHASE_INFO, cycleUtils.js); phase badge, intensity rec, 4-phase timeline, days-until-next; female-gated via profile.gender; src/lib/athlete/cyclePlanner.js + 10 tests.

---

## v11.34.0 — 2026-04-25
E30: RuleAlertsCard — wires getAthleteInsights() (5 rule checks: readiness/load/monotony/fatigue/rest) to dashboard; computeRuleAlerts helper derives ACWR+wellness+loads; src/lib/athlete/ruleAlerts.js + 12 tests.

---

## v11.33.0 — 2026-04-25
E29: VO2maxProgressionCard — 8-week VO2max trend from running sessions with HR data (estimateVO2maxTrend, Daniels 2013, Lucia 2002); OLS trend slope, R² confidence, 8-bar SVG; src/lib/athlete/vo2maxProgression.js + 12 tests.

---

## v11.32.0 — 2026-04-25
E28: HRVSummaryCard — 28-day lnRMSSD baseline, current deviation, suppression alert, 14-dot SVG chart (Plews 2012, Kiviniemi 2007); src/lib/athlete/hrvSummary.js + 12 tests.

---

## v11.31.0 — 2026-04-25
E27: OSTRCMonitorCard — 8-entry injury monitoring trend from localStorage (Clarsen 2013), risk badge (none/minor/moderate/substantial), worsening/improving trend, timeline dots; src/lib/athlete/ostrcSummary.js + 10 tests.

---

## v11.30.0 — 2026-04-25
E26: RecoveryProtocolCard — wires getRecommendedProtocols() with wellness score from recovery entries; shows top 3 evidence-based protocols with step preview; src/lib/athlete/recoveryRecommender.js + 10 tests.

---

## v11.29.0 — 2026-04-25
E25: InsightFeedCard — wires generateInsightCards() (milestone/fitness/consistency/workload) to dashboard; computeCTLDelta + buildMonotonyHistory helpers; src/lib/athlete/insightFeed.js + 10 tests.

---

## v11.28.0 — 2026-04-25
E24: ConsistencyTrendCard — 8-week rolling consistency score history (calculateConsistency, Bangsbo 2006), OLS trend slope, tier classification (excellent/good/fair/poor), streak counter, 8-bar SVG with trend overlay; src/lib/athlete/consistencyTrend.js + 12 tests.

---

## v11.27.0 — 2026-04-25
E23: StrainHistoryCard — 8-week rolling monotony+strain history (Foster 1998), dual SVG chart, high-monotony warning badge; src/lib/athlete/strainHistory.js + 12 tests.

---

## v11.26.0 — 2026-04-25
E22: InjuryForecastCard — 8-week rolling injury risk history + 4-week projection (Malone 2017, Gabbett 2016, Hulin 2016); 12-bar SVG (solid/opacity distinction), top risk factor callout; src/lib/athlete/injuryForecast.js + 12 tests.

---

## v11.25.0 — 2026-04-25
E21: RESTQTrendCard — stress/recovery ratio trend from localStorage history (Kellmann & Kallus 2001, Nederhof 2008); srRatio status bands (danger/warning/ok/good), trend classification, timeline dot SVG; src/lib/athlete/restqTrend.js + 10 tests.

---

## v11.24.0 — 2026-04-25
E20: AerobicEfficiencyCard — weekly EF history (computeEF Coggan 2003), OLS trend classification (improving/stable/declining), 8-bar SVG chart; src/lib/science/aerobicEfficiency.js + 12 tests.

---

## [v11.23.0] — 2026-04-25

**E19 — Critical Power Decay Index**

- `src/lib/science/cpDecay.js` — extractCPHistory: filters cp_test/cp/critical_power entries; computeCPDecayIndex: OLS slope (W/week), 12-week peak, decayPct, building/maintaining/detraining classification (slope >0.5/≥−0.5/<−0.5), W' expanding/stable/contracting status, bilingual recommendations. cpTrendSparkline. Sources: Poole et al. (2016) Med Sci Sports Exerc; Vanhatalo et al. (2011) IJSPP.
- `src/components/dashboard/CPDecayCard.jsx` — current CP, slope badge (±W/wk), classification, W' status, 200×40 SVG sparkline, bilingual recommendation; null if < 2 CP tests
- Dashboard.jsx: CPDecayCard lazy-loaded after SeasonStatsCard
- LangCtx: 9 EN+TR keys (cpDecay, cpBuilding/Maintaining/Detraining, cpWPrimeStatus, cpExpanding/Stable/Contracting, cpRecommendation)
- **Tests: 3038 (+29), 198 files**

---

## [v11.22.0] — 2026-04-25

**E18 — Season Statistics Card**

- `src/lib/athlete/seasonStats.js` — computeSeasonStats: year-filtered totals (sessions/distance/hours/TSS), sport breakdown with pct, bestWeek by TSS, longestSession, currentStreak, maxStreak, activeWeeks, avgSessionsPerWeek. topSportByVolume utility.
- `src/components/dashboard/SeasonStatsCard.jsx` — year selector (current/prior), 4 headline stats, segmented sport bar with legend, best week callout, streak row; null if no sessions
- Dashboard.jsx: SeasonStatsCard lazy-loaded before RowingMetricsCard
- LangCtx: 9 EN+TR keys (seasonStats, seasonSessions/Distance/Hours/TSS/BestWeek/Streak/SportBreakdown/Year)
- **Tests: 3009 (+22), 197 files**

---

## [v11.21.0] — 2026-04-25

**E17 — VDOT Trend & PB Predictor**

- `src/lib/race/vdotTrend.js` — extractVdotHistory (race log + test results, dedup by ISO week, keep highest/week); fitVdotTrend (OLS linear regression, R², weeklyGain); projectPBs (5K/10K/HM/M current + 12-week projected times, delta). Source: Daniels & Gilbert (1979).
- `src/components/race/VdotTrendCard.jsx` — current VDOT badge, improving/plateau label, weekly gain, R² reliability warning, SVG line chart with OLS fit, 4-row PB projection table with color-coded delta
- RaceReadiness.jsx: VdotTrendCard lazy-loaded between TaperSimulator and RaceDayBriefing
- LangCtx: 7 EN+TR keys (vdotTrend, vdotImproving, vdotPlateau, vdotWeeklyGain, vdotProjection, vdotFitQuality, vdotUnlock)
- **Tests: 2987 (+24), 196 files**

---

## [v11.20.0] — 2026-04-25

**E16 — Week-by-Week Polarization Compliance**

- `src/lib/science/polarizationCompliance.js` — weeklyPolarizationScore: easyPct/hardPct/thresholdPct from zone data or RPE fallback; compliance score via weighted deviation from 80/20 Seiler target; model classification (polarized/pyramidal/threshold/unstructured). polarizationTrend (8-week array). overallPolarizationCompliance (mean + modelCounts). Source: Seiler & Kjerland (2006) Scand J Med Sci Sports; Stöggl & Sperlich (2014).
- `src/components/dashboard/PolarizationComplianceCard.jsx` — 8 stacked bars (easy/threshold/hard), per-week compliance badges, model labels; null if weeksAnalyzed < 3
- Dashboard.jsx: PolarizationComplianceCard lazy-loaded
- LangCtx: 10 EN+TR keys (polarizationCompliance, polComplianceScore, polEasy/Hard/Threshold, polPolarized/Pyramidal/ThresholdModel/Unstructured/Target)
- **Tests: 2963 (+27), 195 files**

---

## [v11.19.0] — 2026-04-25

**E15 — Neuromuscular Freshness Index**

- `src/lib/science/neuromuscularFreshness.js` — computeNMFatigue: Z4+Z5 density 7d vs 28d weekly mean, piecewise ratio→score; RPE≥8 fallback (+15 min); zero baseline→80; classification fresh/normal/accumulated/overreached. nmFatigueHistory: 8-week sparkline. Source: Cairns (2006) Sports Med; Seiler (2010) IJSPP.
- `src/components/dashboard/NMFreshnessCard.jsx` — large colored score, classification badge, last-hard-session line, SVG sparkline; null if log < 14
- Dashboard.jsx: NMFreshnessCard lazy-loaded
- LangCtx: 7 EN+TR keys (nmFreshness, nmFresh, nmNormal, nmAccumulated, nmOverreached, nmLastHard, nmFreshnessScore)
- **Tests: 2936 (+22), 194 files**

---

## [v11.18.0] — 2026-04-25

**E14 — Race Readiness + Pace Strategy + Taper Simulator**

- `src/lib/race/readinessScore.js` — composite 0–100 score: form (Coggan PMC), TSB zone (Mujika 2010), HRV z-score (Plews 2012), sleep piecewise (Fullagar 2015), subjective (Hooper 1995); weight re-normalisation on missing data; null on CTL/TSB absent or missingWeight > 0.50
- `src/lib/race/paceStrategy.js` — VDOT or target-time per-km splits with grade adjustment (+7.5s/km/1% uphill, −5s/km/1% downhill capped at −2%; Daniels 2013)
- `src/lib/race/taperSimulator.js` — CTL/ATL/TSB projection via EWMA taper; `compareTapers` for 1–3 week side-by-side; optimal/under/over classification (Mujika & Padilla 2003)
- `src/components/race/RaceReadinessCard.jsx` — SVG score dial, 5-component bars, top-drivers callout, null state
- `src/components/race/TaperSimulator.jsx` — sliders (weeks 1–4, volume 40–85%), SVG mini chart (CTL/TSB), comparison table
- `src/components/race/RaceDayBriefing.jsx` — shows only on race day; splits table, print button, bilingual checklist, weather link
- `RaceReadiness.jsx` — E14 cards injected below existing intelligence.js section (lazy + Suspense)
- `docs/science/citations.md` — 7 new citations appended
- `docs/science/race_readiness_algorithm.md` — new: algorithm rationale, rejection table, re-normalisation worked example, limitations
- `src/contexts/LangCtx.jsx` — 26 new EN+TR keys (raceReadiness*, racePace*, taper*, raceDayBriefing)
- Debt gate cleared: items 4+5 verified via SQL (comment-notification webhook 14 invocations; RLS isolation scenarios 6+7 CLEAN); logged in `docs/ops/realtime_runbook.md` and `docs/ops/session_log.md`
- **Tests: 2914 (+62), 193 files**

---

## [v11.17.0] — 2026-04-25

**E13 — Race Goal CTL Projection: projectCTLAtRace (Banister 1975), assessRaceReadiness, avgWeeklyTSSFromLog; Race Goal section in GoalTrackerCard; 6 tests.**

- `src/lib/sport/raceGoalProjection.js` (NEW) — `projectCTLAtRace(currentCTL, avgWeeklyTSS, daysUntilRace)` Banister exponential model (τ=42); `assessRaceReadiness(projectedCTL, targetCTL)` → on_track/at_risk/needs_attention; `avgWeeklyTSSFromLog(log, weeks)` 4-week TSS average
- `src/lib/__tests__/raceGoalProjection.test.js` (NEW) — 6 tests: no-time identity, decay with zero load, CTL builds from zero, on_track/at_risk/needs_attention status thresholds
- `src/components/dashboard/GoalTrackerCard.jsx` — Race Goal collapsible section (useLocalStorage key `sporeus-race-goal-open`, default true); form with race date + target CTL inputs; projection display with large monospace CTL value, progress bar colored by status (green/yellow/red), status badge, "Banister et al. (1975)" citation; empty state placeholder
- `src/contexts/LangCtx.jsx` — 10 new keys in en + tr: `raceGoal`, `raceGoalDate`, `raceGoalTargetCTL`, `raceGoalProjected`, `raceGoalOnTrack`, `raceGoalAtRisk`, `raceGoalNeedsAttention`, `raceGoalEmpty`, `raceGoalSave`, `raceGoalDaysLeft`
- DEPENDS ON: LangCtx (raceGoal* keys), raceGoalProjection.js, formulas.js (calcLoad), useLocalStorage

---

## [v11.16.0] — 2026-04-25

**E12 — Block Periodization Planner: Issurin (2008) three-phase model (Accumulation/Transmutation/Realization); mode toggle in PlanGenerator; generateBlockPlan; 6 tests.**

- `src/lib/sport/blockPeriodization.js` (NEW) — `BLOCK_PHASES` constant (3 phases with tssMultiplier, zoneEmphasis, durationWeeks, bilingual name/focus); `generateBlockPlan({ weeklyHours, totalWeeks, baseTSS })` — distributes weeks ~40/35/25% across phases, returns per-week objects with phaseId, tssTarget, hoursTarget, zoneEmphasis
- `src/lib/__tests__/blockPeriodization.test.js` (NEW) — 6 tests: 3 phases count, ids in order, array length = totalWeeks, required fields on every week, week 1 = accumulation, last week = realization
- `src/components/PlanGenerator.jsx` — `blockMode` state; LINEAR/BLOCK toggle (orange when active); 3-phase summary cards shown when block mode on; `generate()` branches to `generateBlockPlan` when blockMode; block weeks mapped to plan shape `{ week, phase, tss, totalHours, sessions:[], zonePct, zoneEmphasis, focus }`; phaseColor maps extended with accumulation/transmutation/realization; focus+zone inline display in week detail panel
- `src/contexts/LangCtx.jsx` — 6 new keys in en + tr: `blockPeriodization`, `blockModeLinear`, `blockModeBlock`, `blockPhaseLabel`, `blockFocusLabel`, `blockZoneLabel`
- DEPENDS ON: LangCtx (block* keys), styles.js CSS variables, blockPeriodization.js

---

## [v11.15.0] — 2026-04-25

**E11 — Squad Monthly Challenge: localStorage-based coach-set challenges; SquadChallengeCard (coach); ChallengeWidget (athlete); computeAthleteProgress + rankAthletes; 5 tests.**

- `src/lib/squadChallenge.js` (NEW) — pure functions: `createChallenge`, `computeAthleteProgress` (distance/duration/sessions metrics, date-range filtered), `rankAthletes` (desc sort, 1-based rank)
- `src/components/coach/SquadChallengeCard.jsx` (NEW) — coach card with inline create form; reads/writes `sporeus-squad-challenge` + renders per-athlete progress bars from `sporeus-squad-challenge-entries`; End challenge button; bilingual
- `src/components/dashboard/ChallengeWidget.jsx` (NEW) — athlete widget; reads active challenge from localStorage; shows title, progress bar (orange→green at 100%), rank line; returns null if no challenge
- `src/components/CoachDashboard.jsx` — imports + renders `<SquadChallengeCard />` after `<SquadCompareStrip />`
- `src/components/Dashboard.jsx` — lazy imports + renders `<ChallengeWidget log={log} />` after `<RowingMetricsCard />`
- `src/contexts/LangCtx.jsx` — 8 new keys in en + tr: `squadChallenge`, `squadChallengeNone`, `squadChallengeNew`, `squadChallengeEnd`, `squadChallengeTitle`, `squadChallengeMetric`, `squadChallengeTarget`, `squadChallengeRank`
- `src/lib/__tests__/squadChallenge.test.js` (NEW) — 5 tests: createChallenge uuid+fields; distance sum in range; sessions count in range; pct capped at 100; rankAthletes desc sort
- DEPENDS ON: LangCtx (squadChallenge* keys), styles.js CSS variables (--bg/--text/--muted/--card-bg/--border/--surface/--input-bg)

---

## [v11.14.0] — 2026-04-25

**E10 — Rowing Sport Module: splitPer500m, formatSplit, strokeEfficiency, classifyStrokeRate, rowingEfficiencyFactor (Nolte 2005, Coggan 2003); RowingMetricsCard renders for rowing sessions in last 30 days; 8 tests.**

- `src/lib/sport/rowing.js` — Extended with `splitPer500m`, `formatSplit`, `strokeEfficiency`, `classifyStrokeRate` (5 zones: recovery/steady/threshold/race/sprint), `rowingEfficiencyFactor`; existing Paul's Law, British Rowing zones, CP model, Concept2 VO2max untouched
- `src/lib/__tests__/rowing.test.js` — 8 tests covering split calculation, formatting, stroke efficiency, zone classification, efficiency factor
- `src/components/dashboard/RowingMetricsCard.jsx` (NEW) — shows last rowing session split, stroke efficiency, EF, stroke rate zone badge; returns null if no rowing sessions in last 30 days
- `src/components/Dashboard.jsx` — lazy imports RowingMetricsCard; renders with log prop inside Suspense
- `src/contexts/LangCtx.jsx` — 5 new keys (rowingMetrics, rowingSplit, rowingStrokeEff, rowingStrokeRate, rowingEF) in both en + tr

## [v11.13.0] — 2026-04-25

**E9 — Coach Onboarding Wizard: 3-step first-run modal for new coaches with zero athletes; localStorage-gated; bilingual; 4 tests.**

- `src/components/coach/CoachOnboardingWizard.jsx` (NEW) — modal overlay z-index 9000, dark bg, orange accents; step 1 invite code + copy, step 2 plan-push pointer, step 3 timezone-aware reminder; skip sets `sporeus-coach-onboarded` flag; bilingual via LangCtx
- `src/components/CoachDashboard.jsx` — imports wizard, adds `showWizard` state + useEffect (tier=coach AND roster empty AND sbAthleteIds empty AND flag unset), renders `<CoachOnboardingWizard>`
- `src/contexts/LangCtx.jsx` — 10 new keys (`coachWizardTitle`, `coachWizardStep1Title/Body`, `coachWizardStep2Title/Body`, `coachWizardStep3Title/Body`, `coachWizardSkip`, `coachWizardDone`) in both en + tr
- `src/components/__tests__/CoachOnboardingWizard.test.jsx` (NEW) — 4 tests: renders when empty/not-onboarded; hidden when flag set; hidden when open=false; skip sets flag + calls onClose
- DEPENDS ON: LangCtx (coachWizard* keys), useAuth (profile.invite_code, profile.timezone), styles.js (S object)

---

## [v11.12.0] — 2026-04-24

### FEAT: 8 enhancements — UI, observability, science, testing

**E1 — ReportsTab wired to generated_reports**
- `src/components/ReportsTab.jsx` now queries `generated_reports` table, groups by kind (weekly/monthly_squad/race_readiness), shows Download PDF button (createSignedUrl 1h TTL), empty state card
- `src/components/__tests__/ReportsTab.test.jsx` rewritten with storage mock + 2 new tests
- LangCtx: `reportsDownloadPdf`, `reportsEmptyHint`

**E2 — ObservabilityDashboard: Queue Health panel (6th panel)**
- `supabase/migrations/20260470_get_queue_metrics.sql` + `get_queue_metrics()` SECURITY DEFINER RPC
- New panel polls every 30s; shows depth/oldest-age/status badge (green <10, yellow 10–50, red >50) for all 9 pgmq queues; graceful fallback if pgmq.metrics unavailable
- LangCtx: 6 keys (`queueHealthTitle`, column headers, unavailable)

**E3 — CoachDashboard: Squad Comparison strip**
- `src/components/coach/SquadCompareStrip.jsx` (new) — Recharts BarChart, CTL (#0064ff) + ACWR (green/yellow/red by zone) bars per athlete; collapsible via `useLocalStorage('sporeus-squad-compare-open', true)`
- Data source: `mv_squad_readiness`; filters ctl > 0; renders null if no data
- LangCtx: `squadComparison`, `squadComparisonCTL`, `squadComparisonACWR`

**E4 — Paginated training log**
- `src/hooks/useTrainingLogQuery.js` — new `{ userId, pageSize=50 }` API; `.range()` pagination; `fetchNextPage`, `hasMore`, `isLoadingMore` exposed as named array properties
- `src/contexts/DataContext.jsx` — exposes pagination controls via `useData()`
- `src/components/TrainingLog.jsx` — replaced local `visibleCount` DOM-slice with server "Load more" button (shown when `hasMore`, disabled while loading)
- LangCtx: `loadMore`

**E5 — Lactate threshold drift detection**
- `src/lib/sport/lactate.js` — `computeLactateDrift(sessions)`: linear regression over last 6 LT2 tests; returns `{ trend, deltaPercent, confidence }`
- `src/components/Protocols.jsx` — drift badge rendered after LT2 result (hidden if confidence=low); ↑/→/↓ with %/mo and confidence qualifier
- `src/lib/__tests__/lactate.test.js` — 7 new tests covering edge cases
- LangCtx: 6 keys (`lactateTrendImproving/Stable/Declining`, 3 confidence labels)

**E6 — Science interpretations in TodayView**
- `src/components/TodayView.jsx` — "Training Insights" card; useMemo computes 3 insights via `interpretACWR`, `interpretCTL`, `interpretTSB` from `src/lib/science/interpretations.js`; bilingual via `insight[lang]`; card hidden if no insights
- All 3 functions return `{ en, tr, citation }` — automatically language-aware

**E7 — Visual regression Playwright snapshots**
- `e2e/visual-regression.spec.js` (new) — 4 snapshot tests: dashboard, today, log, profile views; guest mode via localStorage init script
- `playwright.config.js` — new `visual-regression` project; snapshots in `e2e/snapshots/visual-regression/`

**E8 — API key management UI (7th panel in ObservabilityDashboard)**
- `supabase/migrations/20260471_generate_api_key_fn.sql` + `generate_api_key(p_label, p_org_id)` SECURITY DEFINER; added `label` column to `api_keys`
- 7th panel: lists masked keys, inline generate form (key shown once + copy button), inline revoke confirm
- LangCtx: 11 keys (`apiKeysTitle`, columns, actions, warning)

**Test baseline after E1–E8: 2822 tests, 185 files, all green**

---

## [v11.11.0] — 2026-04-24

### PERF/SEC: RLS policy consolidation — 78 WARN advisors cleared

**`supabase/migrations/20260467_fix_multiple_permissive_policies.sql`**:
- 13 tables had a `FOR ALL` policy + a separate `SELECT`-only policy, causing duplicate permissive SELECT evaluation (Postgres `multiple_permissive_policies` WARN × 78 entries)
- Fix: split each `FOR ALL` into explicit `SELECT / INSERT / UPDATE / DELETE` policies, merging both SELECT conditions into one `OR` clause per table
- Tables fixed: `ai_insights`, `coach_invites`, `coach_plans`, `coach_sessions`, `consents`, `injuries`, `profiles`, `race_results`, `recovery`, `session_attendance`, `team_announcements`, `test_results`, `training_log`
- `consents_service_read` dropped entirely — `service_role` bypasses RLS; policy was a no-op

**`supabase/migrations/20260468_profiles_language_first_touch.sql`**:
- `profiles.language TEXT NOT NULL DEFAULT 'tr' CHECK (language IN ('en','tr'))` — was in master reference but absent from live schema
- `profiles.first_touch JSONB` — attribution first-touch payload; written once, never overwritten

**`supabase/migrations/20260469_fix_generated_reports_rls_initplan.sql`**:
- `generated_reports: own rows` policy replaced with `(SELECT auth.uid())` subquery pattern to eliminate per-row re-evaluation (`auth_rls_initplan` WARN)

**Advisor state after**: 0 WARN performance · 0 WARN security (residual: extension_in_public + auth_leaked_password_protection — Dashboard-only, not fixable via migration)

---

## [v11.10.0] — 2026-04-24

### FEAT: 7 missing cron jobs + 3 DB functions

**`supabase/migrations/20260424_missing_crons_and_fns.sql`**:

**DB functions created**:
- `increment_upload_count(p_user_id uuid)` — increments `profiles.monthly_upload_count`; called by parse-activity (non-fatal)
- `reset_monthly_upload_count()` — zeroes upload counters on 1st of month
- `maybe_refresh_squad_mv()` — refreshes `mv_squad_readiness` CONCURRENTLY only if training_log was touched in last 2 min (debounced)

**Schema**: `profiles.monthly_upload_count INTEGER NOT NULL DEFAULT 0` added

**Cron jobs added (now 21 total)**:
| Job | Schedule | Target |
|---|---|---|
| `check-dependencies` | `*/5 * * * *` | check-dependencies edge fn |
| `alert-monitor` | `* * * * *` | alert-monitor edge fn |
| `operator-digest-weekly` | `0 5 * * 1` | operator-digest edge fn (Mon 08:00 Istanbul) |
| `maybe-refresh-squad-mv` | `* * * * *` | `maybe_refresh_squad_mv()` DB fn (debounced) |
| `reset-file-upload-month` | `0 0 1 * *` | `reset_monthly_upload_count()` DB fn |
| `generate-report-weekly` | `30 3 * * 1` | generate-report batch=weekly |
| `generate-report-monthly-squad` | `0 4 1 * *` | generate-report batch=monthly_squad |

---

## [v11.9.0] — 2026-04-24

### DEPLOY: final 5 edge functions — all 25/25 now active

**`supabase/migrations/20260424_pre_deploy_schema_fixes.sql`**:
- `operator_alerts.notified BOOLEAN DEFAULT false` — required by operator-digest email tracking
- `system_status.latency_ms INTEGER` — written by check-dependencies probe results
- `generated_reports` table (uuid PK, user_id, kind weekly|monthly_squad|race_readiness, storage_path, params, expires_at) + RLS own-rows policy + 2 indexes + `purge-generated-reports` cron (45 3 * * *)
- `reports` storage bucket (private) + deny-public storage policy
- `get_recent_client_errors(p_limit int)` RPC — aggregates client_events WHERE event_type='error' last 24h, used by operator-digest

**`supabase/functions/check-dependencies/index.ts`** (v1 deployed):
- Pings supabase_api, strava_api, anthropic_api, dodo_payments, stripe in parallel; upserts system_status; fires operator_alerts for any 'down' service

**`supabase/functions/operator-digest/index.ts`** (v1 deployed, with fix):
- Weekly email digest: MAU/DAU, tier counts, queue health, system status, top errors, alert summary
- FIX: `notified` update now uses `eq('id', digestRow.id)` instead of invalid `order+limit` on update

**`supabase/functions/public-api/index.ts`** (v1 deployed):
- GET /api/v1/squad, /api/v1/squad/export, /api/v1/athlete/:id/load
- Club-tier API key auth + 100 req/hour rate limit via request_counts

**`supabase/functions/adjust-coach-plan/index.ts`** (v1 deployed):
- DB webhook on injuries INSERT; reduces coach_plans week volume 20–40% based on severity; writes coach_notes

**`supabase/functions/generate-report/index.ts`** (v1 deployed):
- React PDF reports: weekly athlete summary, monthly squad overview, race readiness one-pager
- Uploads to reports storage bucket; inserts generated_reports row; returns 7-day signed URL
- Batch mode (pg_cron): weekly for all coach/club users; monthly_squad for coaches

---

## [v11.8.0] — 2026-04-24

### DEPLOY: ops tables + 5 edge functions (squad-sync, parse-activity, alert-monitor, ingest-telemetry, push-worker already done)

**`supabase/migrations/20260424_ops_tables.sql`**:
- `operator_alerts` (bigserial PK, kind, severity warning|critical, title, body, fired_at) — alert dedup table for alert-monitor; idx on (kind, fired_at DESC)
- `system_status` (service PK, status up|down|degraded|unknown, message, checked_at) — written by check-dependencies, read by alert-monitor
- `client_events` (bigserial PK, session_id, user_id_hash, event_type, category, action, label, value, page, app_version, created_at) — telemetry sink; idx on created_at DESC and session_id
- All tables: RLS enabled + deny-public policy (service_role BYPASSRLS only)
- Cron jobid=13: `purge-client-events` `30 3 * * *` — 30-day TTL for client_events

**`supabase/functions/squad-sync/index.ts`** (v1 deployed):
- Auth user → calls `get_squad_overview(p_coach_id)` RPC → returns squad data

**`supabase/functions/parse-activity/index.ts`** (v1 deployed):
- FIT and GPX file parsers; inserts into training_log; updates activity_upload_jobs
- Uses dynamic import of fit-file-parser@2.3.3 and fast-xml-parser@4

**`supabase/functions/alert-monitor/index.ts`** (v1 deployed):
- Checks: queue depth SLOs (ai_batch 100, strava_backfill 500, push_fanout 200), DLQ non-empty, system_status service=down, push failure spike >20/10min, stale system_status >10min
- 15-minute dedup window via operator_alerts table; fired via pg_cron

**`supabase/functions/ingest-telemetry/index.ts`** (v1 deployed, with fix):
- Receives batched client events (up to 50/batch); validates event_type whitelist; inserts into client_events
- FIX: removed erroneous `ts` field from insert rows — column is `created_at` with DEFAULT now()

---

## [v11.7.0] — 2026-04-24

### DEPLOY: push-worker edge function (v1)

**`supabase/functions/push-worker/index.ts`** (first deploy, was missing):
- Drains `push_fanout` pgmq queue; processes up to 50 messages per minute in 10-msg parallel batches
- Calls `send-push` with `Bearer ${serviceKey}` per message; treats 404 (no subscriptions) as success
- Uses `read_push_fanout` + `delete_push_fanout_msg` RPCs; VT=30s for at-least-once delivery

**Effect**: Cron jobid=12 (`push-worker` `* * * * *`) now has a real function to invoke. Checkin reminder push notifications from `trigger-checkin-reminders` will be delivered end-to-end.

---

## [v11.6.0] — 2026-04-24

### FIX: comment-notification auth + add missing push-worker cron

**`supabase/functions/comment-notification/index.ts`** (v3):
- `webhookAuth = req.headers.get('Authorization') || Bearer ${serviceKey}` — DB trigger delivers a hardcoded service_role JWT in the Authorization header; forward it directly to send-push instead of constructing from `SUPABASE_SERVICE_ROLE_KEY` env var. Eliminates the send-push 401 that occurred when the env var was not available.
- `authHeader = webhookAuth` — no other logic changed

**`supabase/migrations/20260424_add_push_worker_cron.sql`**:
- Cron jobid=12: `push-worker` `* * * * *` — drains `push_fanout` pgmq queue; was missing (trigger-checkin-reminders enqueues to this queue but no worker was consuming it)

**Effect**: Comment push notifications will succeed for real users. Checkin reminder push notifications from the fanout queue will now be delivered.

---

## [v11.5.0] — 2026-04-24

### FEAT: AI pipeline activation — embed trigger + backfill + MV security

**`supabase/migrations/20260424_enhancements_embed_trigger_mv_revoke.sql`**:

**MV security**: REVOKE SELECT on `mv_ctl_atl_daily`, `mv_weekly_load_summary`, `mv_squad_readiness` from `anon`, `authenticated` — MVs have no RLS; all rows were readable by any authenticated user. Only `generate-report` (service_role, BYPASSRLS) uses them.

**Auto-embed trigger** (`on_training_log_embed`, SECURITY DEFINER):
- `trg_training_log_embed_insert` — AFTER INSERT on training_log → calls embed-session via net.http_post with service_role JWT
- `trg_training_log_embed_update` — AFTER UPDATE WHEN (`notes`, `type`, `tss`, `rpe`, or `duration_min` changed) → same call
- embed-session content_hash dedup handles idempotency

**Backfill**:
- `embed_backfill_batch(batch_size int)` — finds up to N sessions with no session_embeddings row, calls embed-session per session
- Cron jobid=11: `embed-backfill` `*/10 * * * *` — processes 50 unembedded sessions every 10 min; self-terminating (no-op when all embedded)

**Effect**: SemanticSearch and SquadPatternSearch now produce real results once EMBEDDING_API_KEY sessions begin populating.

---

## [v11.4.2] — 2026-04-24

### FIX: Security + performance hardening round 2 (advisor sweep)

**`supabase/migrations/20260424_security_perf_hardening_round2.sql`**:
- `touch_updated_at` + `update_training_plan_timestamp`: added `SET search_path = ''` (trigger fns, SECURITY INVOKER)
- `consents_service_read` policy: `auth.role()` → `(SELECT auth.role())` — initplan form prevents per-row re-evaluation
- Dropped `ai_insights: service write` INSERT policy — `WITH CHECK (true)` let any authed user insert; service_role bypasses RLS, policy was only an exploit surface
- Added FK indexes: `athlete_devices(user_id)`, `messages(athlete_id)`, `profiles(coach_id)`, `request_counts(api_key)`

**Residual (acknowledged, not fixed):**
- `pg_net`, `pgtap`, `vector` extensions in public schema — Supabase-managed, cannot relocate without breaking dependencies
- 3 MVs (`mv_weekly_load_summary`, `mv_ctl_atl_daily`, `mv_squad_readiness`) accessible to authenticated — MVs don't support RLS; fix requires SECURITY DEFINER wrappers + client changes (Phase 4 candidate)
- `multiple_permissive_policies` alerts — all are intentional own-row ALL + coach-read SELECT pairs
- Leaked password protection — manual toggle in Supabase Auth dashboard

---

## [v11.4.1] — 2026-04-24

### FIX: purge-deleted-accounts cron broken (current_setting GUC never set)

**`supabase/migrations/20260424_fix_purge_cron_hardcode_jwt.sql`**:
- `app.service_role_key` GUC was NULL — cron job failed every night with JSON parse error
- Unscheduled + rescheduled with hardcoded service_role JWT (same pattern as ai-batch-worker cron)
- New jobid=10, schedule `0 4 * * *`, active

---

## [v11.4.0] — 2026-04-24

### FEAT: Phase 3 UI — SemanticSearch + SquadPatternSearch + ChatPanel + WeeklyDigestCard

**`src/App.jsx`**:
- Lazy-import `SemanticSearch` from `./components/SemanticSearch.jsx`
- `showSemanticSearch` state + Ctrl+Shift+K keyboard shortcut (coach/club tier; free-tier shows upgrade modal)
- `⊞ AI` header button (coach/club only) toggles semantic search
- Controlled `<SemanticSearch>` render inside `<Suspense fallback={null}>`; `onJumpToSession` dispatches `sporeus:jump-to-session` CustomEvent
- Footer hint updated: `· Ctrl+Shift+K = AI search`

**`src/components/CoachDashboard.jsx`**:
- Added `supabase` to import (was `isSupabaseReady` only)
- Added `sbAthleteIds` state + `useEffect` to fetch active athlete IDs from `coach_athletes` on mount
- Imports: `SquadPatternSearch`, `ChatPanel`, `WeeklyDigestCard`
- All three rendered inside `isSupabaseReady() && sbCoachId` block

**`src/components/coach/WeeklyDigestCard.jsx`** (new):
- Reads latest `weekly_digests` row for coach (`coach_id`, ordered by `week_start desc`)
- Renders: `headline`, `highlights[]`, `alerts[]`, `recommendation`, `citations[]`
- Bloomberg terminal aesthetic; "No digest yet — runs Sunday night" when empty
- Collapsible via toggle button

**Tests**: 2807/2807 ✓

---

## [v11.3.0] — 2026-04-24

### FEAT: Phase 2 AI Layer — pgvector embeddings + semantic search + AI proxy

**`supabase/migrations/20260426_ai_embeddings.sql`**:
- `CREATE EXTENSION IF NOT EXISTS vector` — pgvector installed
- `session_embeddings` table: `session_id` PK FK→training_log, `user_id` FK→profiles, `embedding vector(1536)`, `content_hash text`
- `insight_embeddings` table: `insight_id` PK FK→ai_insights, `user_id` FK→profiles, `embedding vector(1536)`, `content_hash text`
- ivfflat cosine indexes on both tables (lists=100)
- RLS: own-row ALL policy on both tables (`(SELECT auth.uid()) = user_id`)
- `match_sessions_for_user(p_embedding, k)` — SECURITY DEFINER, STABLE; `OPERATOR(public.<=>)` qualified cosine distance
- `match_sessions_for_coach(p_embedding, p_athlete_ids, k)` — SECURITY DEFINER, STABLE; filters by active coach_athletes link

**Edge functions deployed (withTelemetry stripped — shared module not bundleable via MCP)**:
- `embed-session` v1 (verify_jwt=false): embeds training sessions via OpenAI text-embedding-3-small; C2 guard (skip <20 chars); C1 closure (also embeds linked ai_insights); content_hash dedup; webhook + user JWT paths
- `embed-query` v1 (verify_jwt=true): embeds search queries; calls match_sessions_for_user or match_sessions_for_coach; squad mode requires coach/club tier
- `ai-batch-worker` v1 (verify_jwt=false): drains ai_batch pgmq queue (batch_size=20, VT=30s); calls Claude Haiku-4-5 for weekly squad digest; RAG context from session embeddings (optional); retry with backoff [30s/120s/480s]; DLQ after 3 failures
- `ai-proxy` v1 (verify_jwt=true): server-side Anthropic proxy; tier enforcement (free=0, coach=50/300, club=500/1500 daily/monthly); RAG mode (embed+match_sessions); model_alias haiku/sonnet

**Cron (jobid 9)**: `ai-batch-worker` — `* * * * *` (every minute, service_role JWT)

**Notes**:
- `EMBEDDING_API_KEY` not yet set → embed-session/embed-query return 500/501; ai-batch-worker + ai-proxy work without it (RAG skipped gracefully)
- `ANTHROPIC_API_KEY` already set as `sporeus-coach-key` → ai-proxy and ai-batch-worker functional

**Depends on**: v11.2.0, migration 20260426_security_hardening_*

---

## [v11.2.0] — 2026-04-23

### PERF/SEC: Security hardening — search_path + RLS initplan + index cleanup

**`supabase/migrations/20260426_security_hardening_functions.sql`**:
- 17 SECURITY DEFINER functions: `ALTER FUNCTION ... SET search_path = ''` (bodies already schema-qualified)
- 10 functions rewritten with `public.*` table references + `SET search_path = ''`: `get_my_tier`, `get_load_timeline`, `get_squad_readiness`, `get_weekly_summary`, `refresh_mv_load`, `handle_new_user`, `increment_referral_uses`, `apply_tier_change`, `search_everything`, `get_squad_overview`

**`supabase/migrations/20260426_security_hardening_rls.sql`**:
- 59 RLS policies: bare `auth.uid()` → `(SELECT auth.uid())` initplan form (evaluated once per query, not per row)
- `coach_notes`: 3 permissive policies → 1 (drop redundant `coach_notes_coach` + `coach_notes_athlete_read`)
- `coach_sessions`: 2 SELECT policies → 1 merged `coach_sessions_select`; drop redundant `coach_sessions_coach_read`
- `messages` INSERT: `msg_athlete_insert` + `msg_coach_insert` → `msg_insert` (OR-combined)
- `messages` SELECT: `msg_athlete_select` + `msg_coach_select` → `msg_select` (OR-combined)

**`supabase/migrations/20260426_security_hardening_indexes.sql`**:
- Drop 26 unused indexes (Supabase performance advisor)
- Add 3 missing FK indexes: `activity_upload_jobs(log_entry_id)`, `coach_invites(used_by)`, `coach_notes(athlete_id)`

**Docs**: `docs/ops/security-checklist.md` — leaked password toggle, MFA, key rotation cadence, accepted risks

**Tests**: `src/lib/security.test.js` (+18 RLS invariant tests). **2807 pass total.**

**`docs/releases/v11.1.0.md`**: Phase 1 complete release notes (all 3 blocks)

**Depends on**: v11.1.1, migrations 20260453–20260425

---

## [v11.1.1] — 2026-04-23

### FEAT: KVKK/GDPR — export-user-data + purge-deleted-accounts with 30-day grace

**`supabase/migrations/20260425_data_rights.sql`**:
- `data_rights_requests` unified table (kind: export | deletion, status machine, scheduled_purge_at, export_url + expiry)
- RLS: user inserts + reads own rows; user can cancel own pending deletion; service_role updates freely
- `build_user_export(p_user_id)` SECURITY DEFINER: collects all 20 user-scoped tables, excludes `athlete_devices.token_enc` + `insight_embeddings.embedding` vector
- `purge_user(p_user_id)` SECURITY DEFINER: cascade-safe — archives coach_sessions (null coach_id), soft-deletes comments, deletes all app tables in FK order, returns jsonb result
- `user-exports` storage bucket (private, 50 MB, service-role write, signed-URL read)
- pg_cron `purge-deleted-accounts` daily 04:00 UTC

**`supabase/functions/export-user-data/index.ts`** (rewritten, no withTelemetry):
- Auth via bearer JWT; calls `build_user_export` RPC; uploads to user-exports bucket; returns 7-day signed URL + request_id

**`supabase/functions/purge-deleted-accounts/index.ts`** (rewritten, no withTelemetry):
- Service-role cron worker; processes `data_rights_requests` past `scheduled_purge_at`; calls `purge_user` then `auth.admin.deleteUser`; error isolation (failed row marked, loop continues); sends confirmation email via Resend

**`src/components/profile/DataPrivacySettings.jsx`** (new):
- "Export my data" → calls export-user-data edge function, opens download URL
- "Delete my account" → two-step modal (30-day grace explained, coach/squad impact stated)
- Pending deletion banner with date + "Cancel deletion" button
- Cancel updates `data_rights_requests.status='canceled'` via user RLS policy

**`src/contexts/LangCtx.jsx`**: +14 privacy keys under `priv*` namespace (EN + TR)

**Legal**: `docs/legal/kvkk-notice-tr.md` (KVKK No.6698 Art.10 aydınlatma metni) + `docs/legal/privacy-notice-en.md` (GDPR controller notice)

**Ops**: `docs/ops/runbooks.md` — KVKK deletion inquiry runbook, immediate purge SQL, cron job monitoring, manual export

**Tests**: `src/lib/__tests__/privacy/dataRights.test.js` (+23 tests). 2777 pass total.

**Depends on**: v11.1.0, migration 20260458 (export_jobs, deletion_requests), migration 20260460 (session_comments)

---

## [v11.1.0] — 2026-04-23

### FEAT: Billing state machine — dodo-webhook + subscription lifecycle

**`supabase/functions/dodo-webhook/index.ts`** (rewritten, 125 lines):
- HMAC-SHA256 constant-time signature verification for both Dodo (`x-dodo-signature`) and Stripe (`stripe-signature`)
- All state transitions delegated to `apply_subscription_event()` SQL RPC — function is thin I/O only
- Email side-effects on `payment.failed` and `subscription.cancelled` kept in function
- No `withTelemetry` import (MCP deploy compatible); deployed ACTIVE v1

**`supabase/migrations/20260424_subscription_state.sql`**:
- Added to profiles: `subscription_provider TEXT`, `subscription_id TEXT`, `subscription_current_period_end TIMESTAMPTZ`
- Created `subscription_events` table with `UNIQUE(event_id)`, RLS enabled, service_role grants
- Created `apply_subscription_event(p_event jsonb)` SECURITY DEFINER RPC — unified state machine:
  - `payment.succeeded` / `payment_intent.succeeded` / `invoice.payment_succeeded` → calls `apply_tier_change()`, sets provider
  - `payment.failed` / `invoice.payment_failed` → `status=past_due`, `grace_period_ends_at=now()+3days`
  - `subscription.cancelled` / `customer.subscription.deleted` → `status=cancelled`, sets `subscription_end_date`
  - `subscription.created` / `subscription.trial_start` → `status=trialing`, sets `trial_ends_at`
  - `subscription.updated` → syncs `subscription_current_period_end`
  - Idempotent: duplicate `event_id` returns `{ ok: true, duplicate: true }` — safe for Dodo/Stripe retry

**`src/hooks/useSubscription.js`** (new):
- Subscribes to `profiles` postgres_changes for the authenticated user's row
- Calls `onUpdate` with `{ subscription_status, subscription_tier, trial_ends_at, grace_period_ends_at, subscription_end_date }` — extra profile fields stripped
- Cleans up channel on unmount; re-subscribes when `userId` changes

**`src/lib/subscription.js`**:
- Added `getEffectiveTier(tier, status)`: `past_due` retains tier access (grace window); `cancelled`/`expired`/`none` reverts to `free`
- Added status predicates: `isOnTrial`, `isPastDue`, `isCancelled`, `isExpired`, `daysUntilExpiry`

**Tests**: `src/lib/subscription.test.js` (+16 tests for predicates + `getEffectiveTier`), `src/hooks/__tests__/useSubscription.test.js` (5 tests). 2754 pass.

**`docs/ops/webhooks.md`** (new): Dodo + Stripe webhook config reference — endpoint, events, metadata shape, signature rotation runbook, local test curl.

**Depends on**: v11.0.10, migrations 052–054 (processed_webhooks, subscription_hardening, apply_tier_change)

---

## [v11.0.10] — 2026-04-23

### FIX: Three logic bugs in intelligence.js and formulas.js

- **`detectMilestones` daysSpan** (`intelligence.js:485`): was using `log[0]` and `log[n-1]` assuming insertion order = date order. Backfilled sessions break this. Now uses `Math.max/min` over all timestamp values for correct span regardless of array order.
- **`wingateStats` NaN** (`formulas.js:123`): fatigue index `(peak-low)/peak` produces `NaN` when `peak=0`. Returns `'0.0'` when peak is zero.
- **Dead `_maxRPE`** (`intelligence.js:484`): unused variable removed.

**Depends on**: v11.0.9

---

## [v11.0.9] — 2026-04-23

### FEAT: DurabilityCard surface + polarization ratio + video session URL

**DurabilityCard** (`src/components/dashboard/DurabilityCard.jsx` → `Dashboard.jsx`):
- New card rendered after BanisterModelCard; self-hides when athlete has no FIT-imported sessions ≥90 min with a power stream
- Shows durability % (last-hour 5min peak ÷ baseline MMP), tier label, threshold reference grid (≥95%/90%/85%/<85%), 8-session trend bars
- O(m) sliding-window `baselineMMP5()` over last 12 months; wrapped in `memo()`
- Reference: Maunder et al. (2021) Sports Med 51:1523–1550

**Polarization ratio** (J5 sub-threshold card in `Dashboard.jsx`):
- Header now shows `{pct}% ≥80%` next to weekly sub-threshold minutes
- Green when ≥80% (Seiler target), orange when below
- Computed as sub-threshold min / total week min for current week

**Video session URL** (`SessionManager.jsx`, `coachSessions.js`, migration `20260466`):
- Coach can enter optional `meeting_url` (https://…) when creating a session
- Stored via `meeting_url` column added to `coach_sessions` table (migration `20260466_coach_sessions_meeting_url.sql`)
- Rendered as clickable "▶ Video Link" in session detail panel

**Tests**: 2740 pass · **Build**: clean

**Depends on**: v11.0.8, durabilityScore.js, subThresholdTime.js, coachSessions.js

---

## [v11.0.6] — 2026-04-23

### FIX: All ESLint errors and warnings blocking GitHub Pages deployment

**3 errors** (would break React in production):
- `LoadTrendChart.jsx` — `useState`/`useMemo` were after an early `return null`, violating rules-of-hooks; moved before the guard
- `Profile.jsx:540` — `useState(false)` called inside an IIFE JSX expression (`() => {...}()`); hoisted `dqOpen` state to component level

**16 warnings** resolved (all blocked `--max-warnings 0` lint gate):
- `FuelGuidanceCard` / `PhaseAnalyticsCard` / `WeeklyRetroCard` — unused `t` / `useContext` / `LangCtx` removed (cards use inline `lang === 'tr'` ternaries)
- `useAdaptivePlan.js` — dead `weekKey()` function and unused `today` variable removed
- `RaceReadiness.jsx` — unused `t` removed from destructure; `BLUE` renamed `_BLUE`
- `QuickAddModal.test.jsx` — unused `render` / `waitFor` imports removed
- `SessionCommentThread.jsx` — unused `lang` removed from `useContext` destructure
- `useSessionComments.js` — added `eslint-disable` comment for intentionally stable `qKey`/`qc` refs
- `nextAction.test.js` — unused `vi`, `computeCTL`, `computeATL` imports removed
- `efficiencyFactor.test.js` — unused `i` parameter replaced with `_` in `Array.from` callback
- `subThresholdTime.test.js` — unused `WEEK_END` renamed `_WEEK_END`

**Note**: deploy was already failing before this session (same pre-existing warnings). This commit unblocks it.

**Changes**: 13 files

**Depends on**: v11.0.5

---

## [v11.0.5] — 2026-04-23

### FEAT: Dashboard memo optimization, weekly retrospective, phase analytics, fuel guidance

**Dashboard React.memo (6 components)**
Wrapped `InsightsPanel`, `WeekStoryCard`, `YourPatternsCard`, `DidYouKnowCard`, `RaceReadinessCard`, and `LoadTrendChart` in `React.memo`. These components now skip re-render when their props haven't changed. Prevents full cascade re-render when `profile`, `recovery`, or `injuries` update independently of `log`.

**WeeklyRetroCard**
New compact card at top of dashboard showing last week's structured summary: sessions count, total TSS, volume (h/m), top session, average readiness score, average HRV, and adaptive plan adherence % with color-coded status badge. Pulls from `useAdaptivePlan` for plan compliance message.

**PhaseAnalyticsCard**
New phase-aware metrics card. Reads current periodization plan + `MACRO_PHASES` to show: current phase name (Base/Build/Peak/Recovery/Taper/Race) with phase progress bar, CTL delta from phase start to now, phase compliance % (actual vs planned TSS across all completed weeks in this phase), and current week TSS progress against target.

**FuelGuidanceCard**
New CHO periodization card based on Burke et al. 2011 + Moore 2014. Shows: today's CHO target range (g/kg and absolute grams) derived from today's TSS, tomorrow's CHO target if plan has a session, daily protein range (1.6–2.2g/kg), and hydration estimate based on training volume. CHO zones: rest 3-5g/kg, easy 5-7, moderate 7-10, hard 10-12, very hard 12-14g/kg.

**Changes**:
- `src/components/dashboard/InsightsPanel.jsx` — `export default memo(InsightsPanel)`
- `src/components/dashboard/WeekStoryCard.jsx` — `export default memo(WeekStoryCard)`
- `src/components/dashboard/YourPatternsCard.jsx` — `export default memo(YourPatternsCard)`
- `src/components/dashboard/DidYouKnowCard.jsx` — `export default memo(DidYouKnowCard)`
- `src/components/dashboard/RaceReadinessCard.jsx` — `export default memo(RaceReadinessCard)`
- `src/components/dashboard/LoadTrendChart.jsx` — `export default memo(LoadTrendChart)`
- `src/components/dashboard/WeeklyRetroCard.jsx` — new component
- `src/components/dashboard/PhaseAnalyticsCard.jsx` — new component
- `src/components/dashboard/FuelGuidanceCard.jsx` — new component
- `src/components/Dashboard.jsx` — imports + renders WeeklyRetroCard, PhaseAnalyticsCard, FuelGuidanceCard

**Test count**: 2740 (unchanged — new UI components don't require pure-function tests)

**Depends on**: v11.0.4, useAdaptivePlan hook

---

## [v11.0.4] — 2026-04-23

### FEAT: App-wide improvements — HRV readiness weighting, workout templates, PMC timeline, adaptive plan, golden tests, i18n completeness, GDPR fix, AI per-tier caps

**Wave 1 — GDPR purge fix**
`purgeExpiredData` was referencing dead tables `wellness_logs` and `sessions`, silently no-oping on `recovery` and `injuries` data. Fixed `purgeTables` to target the correct tables. GDPR data retention now enforces deletion of recovery and injury records.

**Wave 2 — AI per-tier monthly cost caps**
Replaced flat `MONTHLY_CAP = 1500` in `ai-proxy` edge function with per-tier map: `free: 0, coach: 300, club: 1500`. Free-tier users now blocked (0 cap), Coach users capped at 300/month.

**Wave 3 — Protocols: DataContext save + zone auto-assignment**
`Protocols.jsx` was writing directly to `localStorage` via `saveBoth()` and `useFTP()`, bypassing React state and Supabase sync. Both now route through `setProfile` from `useData()`. `useFTP()` also auto-computes `powerZones(ftp)` and stores them on save.

**Wave 4 — HRV-weighted readiness score**
`TodayView.jsx` quick-save now multiplies wellness readiness score by an HRV factor: `unstable → 0.75`, `warning → 0.90`, `stable → 1.0`. Requires ≥3 days of HRV data to apply the factor; otherwise defaults to 1.0.

**Wave 5 — Workout templates**
New `useWorkoutTemplates.js` hook (localStorage, max 30 templates). `QuickAddModal` shows a 6-template picker that pre-fills type/duration/rpe/notes; has a "Save as template" button after logging. `TrainingLog` adds a ⊕ button on each session row to save it as a template.

**Wave 6 — PMC range selector + career peak CTL**
`LoadTrendChart.jsx` now has 90D/6M/1Y/ALL range buttons for the Performance Management Chart. Displays career peak CTL (highest CTL ever computed across all history) as a reference point.

**Wave 7 — Adaptive plan adherence**
New `useAdaptivePlan.js` hook compares actual vs planned weekly TSS, classifies adherence status (on_track/under/low/exceeded/overreach), and computes an adjusted next-week TSS. `Periodization.jsx` shows `AdaptivePlanCard` with bilingual EN/TR messaging, dismissable per week.

**Wave 8 — Scientific golden-file tests**
New `src/lib/__tests__/trainingLoad.golden.test.js` with 12 reference-value assertions: Banister K_CTL/K_ATL constants, ATL convergence rate, ACWR status classification (Hulin 2016), and Foster 2001 monotony/strain properties including the >2.0 flag threshold.

**Wave 9 — i18n completeness**
Added 16 missing EN+TR translation keys to `LangCtx.jsx`: `pmcTitle`, `pmcPeakCTL`, `periodizationTitle`, `noWeekData`, `raceAnchorHint`, `hideChart`, `showChart`, `loadingCoachPlans`, `alreadySubmitted`, `wprimePower*` (3 error keys), `cooperDistance`. Updated `LoadTrendChart`, `Protocols`, `TodayView`, `Periodization` to use `t()` for all previously hardcoded English strings.

**Changes**:
- `src/lib/gdprExport.js` — purgeTables now targets `recovery` + `injuries` (not dead `wellness_logs`/`sessions`)
- `supabase/functions/ai-proxy/index.ts` — per-tier monthly caps `{ free:0, coach:300, club:1500 }`
- `src/components/Protocols.jsx` — DataContext save + auto `powerZones()` on FTP set; `t()` for 4 hardcoded strings
- `src/components/TodayView.jsx` — HRV factor multiplier on quick-save readiness; `t('alreadySubmitted')`
- `src/hooks/useWorkoutTemplates.js` — new hook (localStorage CRUD, max 30 templates)
- `src/components/QuickAddModal.jsx` — template picker (6 visible) + save-as-template after log
- `src/components/TrainingLog.jsx` — ⊕ button to save any session as template
- `src/components/dashboard/LoadTrendChart.jsx` — PMC range selector (90D/6M/1Y/ALL) + career peak CTL + `t()` for title/badge
- `src/hooks/useAdaptivePlan.js` — new adaptive plan adherence hook
- `src/components/Periodization.jsx` — AdaptivePlanCard (bilingual, dismissable) + `t()` for 5 hardcoded strings
- `src/lib/__tests__/trainingLoad.golden.test.js` — 12 golden test assertions
- `src/contexts/LangCtx.jsx` — 16 new EN+TR keys

**Test count**: 2740 (was 2728 before golden tests)

**Depends on**: v11.0.3, migrations 064+065

---

## [v11.0.3] — 2026-04-23

### FIX: Recovery sleep quality field not persisted; MorningCheckIn semantic mismatch; debug console.log

**Bug 1 — recovery.sleep (1-5) never in DB**
Sleep quality slider was dropped by `recEntryToRow` (same root cause as the energy bug fixed
in v11.0.2). Calendar showed "Sleep undefined/5", WellnessSparkline plotted null for every
sleep point, pdfReport weekly wellness table showed "—" for all sleep cells even with data.

**Bug 2 — MorningCheckIn semantic mismatch**
`MorningCheckIn` saved `wellness.energy` into the `mood` column and dropped `wellness.sleep`
entirely. With the `sleep` and `energy` DB columns now available, the entry is saved correctly.
`mood` defaults to 3 (neutral) since the quick check-in form doesn't ask about mood separately.

**Bug 3 — stray console.log in LoadHeatmapCard**
Debug `console.log('heatmap day clicked: ...')` in dead-code fallback path removed.

**Other**
- `package.json` version bumped from 8.1.0 to 11.0.3 (was severely out of sync)

**Changes**:
- `supabase/migrations/20260465_recovery_sleep_quality_column.sql` — `ADD COLUMN sleep SMALLINT CHECK(1-5)`; applied to production
- `src/hooks/useSupabaseData.js` — `recRowToEntry` + `recEntryToRow` now include `sleep`
- `src/lib/dataMigration.js` — guest→auth migration now writes `sleep` and `energy`
- `src/components/MorningCheckIn.jsx` — saves `sleep: wellness.sleep, energy: wellness.energy, mood: 3`
- `src/components/dashboard/LoadHeatmapCard.jsx` — removed stray console.log
- `package.json` — version 8.1.0 → 11.0.3

**Depends on**: migrations 064 (energy), 065 (sleep quality)

---

## [v11.0.2] — 2026-04-23

### FIX: Recovery energy field not persisted to DB (V2 fatigue alert permanently silent)

**Root cause**: `recovery` table had no `energy` column — the `energy` slider (1–5) from the
wellness check-in form was dropped by `recEntryToRow`. After DB hydration, `e.energy` was
`undefined` on all entries, causing V2's `getFatigueAccumulation` to always use fallback value
3 (≥ 2.5 threshold) → fatigue alert never fired for any user with synced history.

**Changes**:
- `supabase/migrations/20260464_recovery_energy_column.sql` — `ALTER TABLE recovery ADD COLUMN IF NOT EXISTS energy SMALLINT CHECK (energy BETWEEN 1 AND 5)`; applied to production
- `src/hooks/useSupabaseData.js` — `recRowToEntry` now maps `row.energy`; `recEntryToRow` now writes `energy` column

**Depends on**: migration 001 (recovery table), migration 064 (energy column), V2 in Recovery.jsx (v11.0.0)

---

## [v11.0.1] — 2026-04-23

### HOTFIX: Google OAuth 500 — inject_tier_jwt_claim missing SET search_path

Root cause: `supabase_auth_admin` runs JWT hooks with `search_path = auth, pg_catalog` only.
`inject_tier_jwt_claim` had no `SET search_path`, so `SELECT subscription_tier FROM profiles`
threw "relation does not exist" → Supabase returned 500 to every sign-in attempt.

Fix: `SET search_path = public` added to function + `public.profiles` explicit table reference.
Outer `EXCEPTION WHEN OTHERS THEN RETURN event` safety net added as belt-and-suspenders.
Applied directly via `db query` (migration history diverged — `db push` blocked).
Verified: `proconfig = ["search_path=public"]` confirmed in production `pg_proc`.

DEPENDS ON: 20260416_fix_jwt_hook.sql (null-safety), 20260412_subscription.sql (subscription_tier column)

---

## [v11.0.0] — 2026-04-23

### V1–V5 — ruleInsights athlete-side: load spike, fatigue, rest, monotony, readiness label

All 5 items from `ruleInsights.js` — previously used only in the coach's `AthleteRow`. First-time exposure on the athlete side. `ruleInsights.js` extended with `.tr` and `.actionTr` fields on all returns.

- **V1 — TodayView: `getLoadTrendAlert` load spike bar**: When >10% week-on-week TSS increase in `weekLoad.dailyTSS`, shows amber alert bar below K3 strip with bilingual message + action.
- **V2 — Recovery: `getFatigueAccumulation` energy warning**: Maps last 3 recovery entries' `energy` (1–5) into `getFatigueAccumulation`. When avg < 2.5, shows red warning in the readiness card.
- **V3 — TodayView: `getMissedRestWarning` rest overdue bar**: Uses existing `consecutiveDays`. When ≥6, shows red "REST DAY OVERDUE" alert bar below K3.
- **V4 — TodayView K3: `getMonotonyWarning` action note**: When Foster 2001 monotony > 2.0, appends bilingual action text inside K3 below `M X.X`.
- **V5 — Recovery: `getReadinessLabel` coaching message**: ACWR + 7-day wellness avg composite, colour-coded level badge + message in readiness card (gated: ≥5 entries, ACWR available).

**Tests:** 2728 (unchanged). Build: clean.
**Semver:** v11.0.0

DEPENDS ON: v10.9.0, ruleInsights.js (all 5 functions), computeMonotony + calculateACWR in trainingLoad.js

---

## [v10.9.0] — 2026-04-23

### U1–U5 — NextAction metrics strip, fitness AVG TSS, monotony status badge, digest PMC strip, EF date range

- **U1 — NextActionCard: `action.metrics` dim strip**: Every `computeNextAction` rule returns `metrics: {ctl, atl, tsb, acwr}` but these were never rendered. Added a `CTL · ATL · TSB · ACWR` dim strip below the citation, styled `#2a2a2a` to avoid visual noise.
- **U2 — TodayView L1 fitness strip: `avgWeeklyTSS`**: `predictFitness` returns `avgWeeklyTSS` but it was not shown in TodayView's L1 compact forecast (Dashboard.jsx does show it). Added `AVG {N} TSS/WK` (TR: `ORT {N} TSS/HFT`) inline with the CTL NOW → 4W → 8W row.
- **U3 — Dashboard monotony card: `weekLoadDetail.status` badge**: `computeMonotony` returns `status` ('low'/'moderate'/'high') but Dashboard only used `weekTSS` and `dailyTSS` from that result. Added a colour-coded status badge (`VARIED`/`MODERATE`/`HIGH`) below the daily TSS bars.
- **U4 — TodayView morning brief: `digest.ctl/tsb/acwr`**: `generateDailyDigest` returns `ctl`, `tsb`, `acwr` alongside the prose text but only the prose was rendered. Added a dim PMC sub-row (`CTL {n} · TSB ±{n} · ACWR {n}`) inside the morning brief card.
- **U5 — EFTrendCard: `result.dates` range label**: `efTrend.dates` (array of date strings for each EF data point) was returned but never used. Added a `MM-DD → MM-DD` date range line below the sparkline using `dates[0].slice(5)` / `dates[last].slice(5)`.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.9.0

DEPENDS ON: v10.8.0, computeNextAction in nextAction.js, predictFitness in intelligence.js, computeMonotony in trainingLoad.js, generateDailyDigest in intelligence.js, efTrend in efficiencyFactor.js

---

## [v10.8.0] — 2026-04-23

### T1–T5 — Recovery corr threshold detail, WeekStory stats strip, HRV daysWithData+dropPct, Profile tips TR, patterns sampleSize

- **T1 — InsightsPanel: `recovCorr.highLoadThreshold + avgRecAfterHard/Easy` detail**: Recovery correlation insight row had `detail: null`. Now shows `≥{threshold} TSS = hard · after hard: {X} · after easy: {Y}` when open.
- **T2 — WeekStoryCard: `n + totalMin + totalTSS + avgRPE` stat strip**: `generateWeeklyNarrative` returns these 4 fields separately but only the prose text was rendered. Added a dim stats strip above the narrative.
- **T3 — TodayView HRV strip: `daysWithData + dropPct`**: These two fields were returned by `computeHRVTrend` but never shown. Now appended to the secondary info row: `5d · ↓3.2%`.
- **T4 — Profile.jsx DATA QUALITY tips TR**: Tips rendered `{tip.en}` hardcoded for all languages. Fixed to `{lang === 'tr' ? tip.tr : tip.en}` via `localStorage.getItem('sporeus-lang')`.
- **T5 — Recovery.jsx YOUR PATTERNS: `sampleSize` shown**: `findRecoveryPatterns.sampleSize` was never shown in the standalone Recovery tab pattern card. Now displayed as a dim `{N} pairs` badge in the card header.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.8.0

DEPENDS ON: v10.7.0, analyzeRecoveryCorrelation in intelligence.js, generateWeeklyNarrative, computeHRVTrend in hrv.js, findRecoveryPatterns in patterns.js

---

## [v10.7.0] — 2026-04-23

### S1–S5 — CTL/ATL in form tile, HRV strip with interpretation, EF mean, sub-threshold session counts, zone model tip TR fix

- **S1 — PerformanceMetrics: CTL·ATL sub-row in Form tile**: `getFormScore.ctl` and `.atl` were returned but only TSB was shown. Added `CTL {ctl} · ATL {atl}` dim sub-row below the TSB zone advice.
- **S2 — TodayView HRV strip: latestHRV + interpretation**: `computeHRVTrend.latestHRV` (today's value in ms) and `.interpretation` (bilingual) were computed but not surfaced. HRV strip now shows `{latestHRV}ms / {baseline}ms` and renders bilingual interpretation text below the bars.
- **S3 — EFTrendCard: mean EF in stats row**: `efTrend.mean` was returned but not shown. Added `{mean.toFixed(3)} mean/ort` to the stats row alongside latest, CV%, and n.
- **S4 — Dashboard sub-threshold bars: sessionsIncluded annotation**: `subThresholdTrend.sessionsIncluded` (per-week session count) was returned but never rendered. Now shows as a tiny number below each bar.
- **S5 — ZoneDistributorCard: zone model tip TR bug fix**: Both branches of `lang === 'tr' ? meta.tip : meta.tip` incorrectly rendered the English tip. Added `tipTr` to all 6 MODEL_META entries in `zoneDistrib.js` and fixed the render to `meta.tipTr` for TR users.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.7.0

DEPENDS ON: v10.6.0, getFormScore/computeHRVTrend/efTrend/subThresholdTrend in intelligence.js/science/, MODEL_META in zoneDistrib.js

---

## [v10.6.0] — 2026-04-23

### R1–R5 — Daniels paces, injury zone chips, week template table, SESSION ANALYSIS TR, recovery_time TR

- **R1 — RaceReadiness: Daniels training paces table**: `predictRacePerformance.trainingPaces` (easy/marathon/threshold/interval/rep) was computed but never shown. Now renders as a pace table when prediction is reliable.
- **R2 — ProactiveInjuryAlert: vulnerable zones + protective factors**: `mineInjuryPatterns.vulnerableZones` (zone chips) and `protectiveFactors` (strength training correlation) were returned but never rendered.
- **R3 — YourPatternsCard: optimal week day schedule**: `findOptimalWeekStructure.bestPattern` (array of day/type/duration) was returned but only prose summary shown. Now renders as a mini day-by-day table when open and reliable.
- **R4 — TrainingLog SESSION ANALYSIS TR**: SEANS ANALİZİ / KARŞILAŞTIRMA / ZON TAHMİNİ / TOPARLANMA / NOTLAR labels + `zone_estimate` lookup map for Turkish users.
- **R5 — `analyseSession.recovery_time` TR**: finite set of "Allow Xh…" strings now localized in TrainingLog SESSION ANALYSIS and QuickAddModal confirmation screen.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.6.0

DEPENDS ON: v10.5.0, mineInjuryPatterns/findOptimalWeekStructure/predictRacePerformance in intelligence.js/patterns.js

---

## [v10.5.0] — 2026-04-23

### Q1–Q5 — Numeric intelligence surfacing: load numbers, zone splits, injury score, fitness projection, TR localization

- **Q1 — InsightsPanel load trend numeric row**: `analyzeLoadTrend.tss1/.tss2/.ctl/.atl` were returned but not rendered. When "MORE" is open, shows `W1: {tss1} TSS · W2: {tss2} TSS · CTL: {ctl} · ATL: {atl}` as a dim sub-row under the load trend advice.
- **Q2 — TodayView time-of-day advice TR localization**: `getTimeOfDayAdvice()` returns English-only strings. Added a TR lookup table in TodayView; TR users now see localized time advice in the Morning Brief.
- **Q3 — Injury risk numeric score in Recovery**: `predictInjuryRisk.score` (0–100) was computed but never shown. Added as a large numeric badge next to the RISK level label.
- **Q4 — InsightsPanel zone balance percentages**: `analyzeZoneBalance.z1z2Pct/.z3Pct/.z4z5Pct` were returned but not rendered. When "MORE" open, shows `Z1/Z2: X% · Z3: Y% · Z4/Z5: Z%` as numeric sub-row.
- **Q5 — InsightsPanel fitness TSB + 8-week projection**: `predictFitness.tsb` and `.in8w` were computed but not shown. When "MORE" open, shows `TSB: ±N · 4w: N CTL · 8w: N CTL` sub-row.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.5.0

DEPENDS ON: v10.4.0, analyzeLoadTrend/analyzeZoneBalance/predictFitness/predictInjuryRisk in intelligence.js

---

## [v10.4.0] — 2026-04-23

### P1–P5 — Data surfacing: raw metrics, baseline stat, extended history, ACWR tile, race nudge

- **P1 — Raw metrics strip in TrainingLog expanded panel**: avgPower / avgHR / avgCadence / distanceM shown as colored badges when present (FIT/Strava imports). Gate: at least one field > 0.
- **P2 — 28d wellness baseline stat in TodayView Card 2**: `wellnessBaseline.mean ± sd` shown below the score always when baseline exists, not just in z-score warning. Gate: `wellnessBaseline && todayRec`.
- **P3 — Extended Recovery history table**: HRV (ms), resting HR (bpm), bedtime columns added conditionally for advanced athletes who log them. Table gets `overflowX: auto` wrapper. Gate: `isAdvanced && any entry has data`.
- **P4 — ACWR ratio tile in TodayView Card 3 Quick Stats**: `acwrRatio` was computed but only used in share canvas. Now shown as a 4th tile with color coding (green 0.8–1.3, amber <0.8, red >1.3). Gate: `log.length >= 7`.
- **P5 — Race date nudge in TodayView**: when no `profile.raceDate` set and `log.length >= 10`, shows a compact prompt with Profile shortcut button to unlock L2 race countdown + taper guidance.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure). Build: clean.
**Semver:** v10.4.0

DEPENDS ON: v10.3.1, L2 race countdown in TodayView

---

## [v10.3.1] — 2026-04-23

### Auth bug fix — display_name overwrite on every Google sign-in

- **`useAuth.js`**: Removed `display_name` from `upsertProfile` upsert payload. The `handle_new_user` DB trigger already sets display_name from Google metadata on first sign-in; including it in the upsert was silently overwriting any user-customized name on every subsequent login.
- **`supabase/config.toml`**: Added `[auth.external.google]` section so Google OAuth works in local Supabase dev (requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars). Production remains configured via Supabase Dashboard.

**Tests:** 2728 (unchanged — 1 pre-existing nextAction failure unrelated to auth).

DEPENDS ON: v10.3.0, handle_new_user trigger in 20260416_fix_jwt_hook.sql

---

## [v10.3.0] — 2026-04-22

### O1–O5 — UX completeness: session grades, source tags, protocol rationale, recap visual, readiness sparkline

Five enhancements closing UX gaps where computed data had no display surface.

- **O1 — Session grade badge in `TrainingLog.jsx`**: expanded session detail panel shows A–D grade, score/100, and bilingual feedback from `scoreSession()`. Gate: entry in expanded state.
- **O2 — suggestion.source badge in `TodayView.jsx`**: tiny monospace badge above smart suggestion action text showing why the suggestion was triggered (e.g. ACWR_HIGH, HRV_SUPPRESSED). Gate: `suggestion.source` truthy.
- **O3 — Protocol `when_to_use` rationale in `TodayView.jsx`**: italic one-liner below each recovery protocol name from `p.when_to_use`. No gate — always shown when protocol renders.
- **O4 — Weekly recap visual upgrade in `TodayView.jsx`**: plain text strip replaced with card — trend arrow + colored TSS total vs 4-week avg, session count %, CTL delta, dominant type, avg RPE. Dismissable with week-keyed localStorage flag.
- **O5 — 7-day readiness sparkline in `TodayView.jsx`** Card 2: SVG polyline of last 7 recovery scores with a 50-point dashed baseline. Color-coded by today's score level. Gate: `recovery.length >= 3 && todayRec`.

**Tests:** 2728 (unchanged) — all pass (0 regressions). Build: clean.
**Semver:** v10.3.0

DEPENDS ON: v10.2.0 (N-series), scoreSession in intelligence.js, getRecommendedProtocols in recoveryProtocols.js, generateWeeklyRecap in trainingLoad.js

---

## [v10.2.0] — 2026-04-22

### N1–N5 — Stored data surfaced: mood/stress, lactate, VDOT paces, cadence, metrics row

Five enhancements displaying data that was collected but never visualised.

- **N1 — Mood + stress 7-day sparklines in `Recovery.jsx`**: dual SVG polyline (blue = mood, red = stress) below sleep trend. Shows 7-day averages. Alert when avgStress > 3.5 AND avgMood < 3. Gate: `entries.length >= 3`.
- **N2 — Lactate trend card in `Recovery.jsx`** (advanced/elite only): sparkline of last 10 lactate readings with a 2.0 mmol/L baseline reference line. Latest value shown; red border + "elevated" warning when latest > 2.0. Gate: `isAdvanced && ≥2 readings`.
- **N3 — Training pace reference in `TodayView.jsx`**: compact 3-badge strip (EASY / THRESH / INT in min:sec/km) from `getTrainingPaces(profile.vo2max)` (Daniels VDOT table). Gate: `profile.vo2max > 0`. First UI surfacing of the vdot.js paces output.
- **N4 — Cadence trend strip in `Dashboard.jsx`**: SVG sparkline of last 24 sessions with `avgCadence > 0`. Shows avg rpm + optimal range note (run 170–180, cycle 85–95). Gate: `≥5 cadence entries` in filtered log. Positioned before WEEKLY VOLUME card.
- **N5 — Key profile metrics row in `Dashboard.jsx` header**: FTP / MAX HR / VO₂max / WEIGHT / LT2 badges shown after sport/level/coach row in both beginner and advanced views. Gate: `≥2 metrics set`.

**Tests:** 2728 (unchanged) — all pass (0 regressions). Build: clean.
**Semver:** v10.2.0

DEPENDS ON: v10.1.0 (M-series), vdot.js Daniels table

---

## [v10.1.0] — 2026-04-22

### M1–M5 — Unused function surfacing + data field display

Five enhancements: one unused function wired, four stored-data fields surfaced.

- **M1 — `isHRVSuppressed` alert in `TodayView.jsx`**: Red alert strip ("HRV suppressed — easy session only. Plews 2013") shown above NextActionCard when `isHRVSuppressed(recovery)` is true (HRV CV ≥ 10% AND latest below mean). Gated `recovery.length >= 3`. Wires the only remaining unused hrv.js export.
- **M2 — Latest RESTQ result badge in `TodayView.jsx`**: Shows most recent RESTQ balance score and interpretation label (green/blue/amber/red) between RESTQ nudge card and Smart Suggestion. Gated: history exists AND `!restqDue` (complements the nudge, not duplicates it).
- **M3 — Source badge in `TrainingLog.jsx` session rows**: `STR` (orange, Strava) or `FIT` (blue) label before notes text when `entry.source === 'strava'` or `'fit'`. Manual entries show no badge (default assumption).
- **M4 — Recent session notes widget in `Dashboard.jsx`**: Compact card "SESSION NOTES" showing last 3 entries with non-empty notes (date · type · TSS + note text). Inserted after RecentSessionsCard. Gate: at least 1 entry with notes in filtered log.
- **M5 — Yesterday's session note in `TodayView.jsx` Morning Brief**: If `yesterdayEntry.notes` exists, shows it as an italicised quote below the "Yesterday: X TSS…" line with a left border accent.

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v10.1.0

DEPENDS ON: v10.0.0 (L-series, predictFitness, isHRVSuppressed now wired)

---

## [v10.0.0] — 2026-04-21

### L1–L5 — New feature enhancements (fitness forecast, race countdown, recovery baseline, goal context)

Five genuine feature additions beyond unused-function surfacing.

- **L1 — `predictFitness` compact forecast strip in `TodayView.jsx`**: CTL now/4w/8w trajectory bar (↑↓→) with label text from `predictFitness(log)`. Gated `log.length >= 14`. Positioned between K3 weekLoad strip and consecutive rest warning.
- **L2 — Race countdown card in `TodayView.jsx`**: Days-to-race badge from `profile.raceDate`. Shows phase label (BUILD / TAPER / RACE WEEK / RACE DAY), date, and color coding (blue/amber/orange). Gated on future date ≤ 120 days. Inserted before K3 weekLoad.
- **L3 — `predictFitness` detailed 4w/8w projection in `Dashboard.jsx`**: Full projection row (CTL now → 4W → 8W, avg TSS/wk, trajectory arrow + label) after J2/J3 CTL/TSB interpretation block. Gated `lc.showCTL && log.length >= 14`.
- **L4 — Recovery baseline weekly comparison in `Recovery.jsx`**: THIS WEEK avg vs 4W rolling avg score badge in readiness card. Green ≥ 4W avg, amber within 10%, red >10% below. Gated `week1.length >= 2 && week4.length >= 5`.
- **L5 — Goal-context line in `TodayView.jsx` Morning Brief**: If `profile.goal` is set, shows goal string + CTL phase label (strong base / building / base phase) in Morning Brief card. Gated `profile.goal && todayCtl > 0`.

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v10.0.0

DEPENDS ON: v9.9.0 (K-series, classifyTSB, computeMonotony)

---

## [v9.9.0] — 2026-04-21

### K1–K5 — Final unused function sweep (durabilityScore, trainingLoad, interpretations)

Five enhancements exhausting the remaining unused science library functions.

- **K1 — `interpretDecoupling` in TrainingLog expanded rows** (`TrainingLog.jsx`): replaces the static `"<5% coupled · 5–10% mild · >10% significant — Friel 2009"` line with the full bilingual interpretation from `interpretDecoupling(pct)` (Friel 2009). Fires only when `entry.decouplingPct` is set (FIT imports with HR streams).
- **K2 — `classifyTSB` in `PerformanceMetrics.jsx`** (`dashboard/PerformanceMetrics.jsx`): TSB tile now shows Coggan zone name (Fresh / Peak Form, Neutral, Optimal Training Stress, Overreaching Risk) and bilingual advice text from `classifyTSB(form.tsb)`. Border color updated to match zone color.
- **K3 — `computeMonotony.dailyTSS` 7-day bar chart in `TodayView.jsx`**: compact 7-day TSS mini bar strip (Mon–Sun) using `computeMonotony(log).dailyTSS`. Today highlighted in orange; zero-TSS days in dark. Monotony value and week total shown right of bars. Color-coded by monotony status (Foster 1998: low/moderate/high).
- **K4 — `computeMonotony.dailyTSS` bars in Dashboard monotony card**: 7-bar daily TSS sparkline added below the monotony interpretation text in the existing monotony index card. Color follows monoRed alert state.
- **K5 — `classifyTSB` zone badge in `Recovery.jsx`** readiness section: TSB zone badge (zone name + Coggan advice, `log.length >= 7` gate) inserted below the sleep warning in the readiness score card, providing training-load context alongside the wellness-based readiness score.

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.9.0

DEPENDS ON: v9.8.0 (J-series, interpretations.js, subThresholdTime.js)

---

## [v9.8.0] — 2026-04-21

### J1–J5 — Science interpretation library surfaced (interpretations.js + subThresholdTime.js)

Five enhancements wiring the previously unused science interpretation functions into existing UI cards.

- **J1 — `interpretACWR` in ACWRCard** (`dashboard/ACWRCard.jsx`): bilingual science interpretation (Gabbett 2016 / Hulin 2016) appended below the 8-week ACWR chart. Explains current ratio meaning and action guidance with citation.
- **J2 — `interpretCTL` in Dashboard**: CTL fitness-phase interpretation (Banister/Coggan) shown below ReadinessCard, gated `log.length >= 14`. Includes 4-week trend using `daily[−28].ctl`.
- **J3 — `interpretTSB` in Dashboard**: TSB zone interpretation (Coggan zones) shown alongside CTL interpretation, same gate.
- **J4 — `interpretMonotony` in Dashboard monotony section**: bilingual interpretation text (Foster 1998) added beneath the monotony index number in the zone distribution card.
- **J5 — `subThresholdTrend` 8-week bar chart in Dashboard** (`src/lib/science/subThresholdTime.js`, Seiler 2010): compact 8-bar sparkline of weekly Z1+Z2 minutes. Gated on `profile.maxhr` (uses 90% of max HR as threshold) or `profile.ftp` (uses FTP as power threshold). Only renders when at least one non-null week exists.

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.8.0

DEPENDS ON: v9.7.0 (I-series wiring)

---

## [v9.7.0] — 2026-04-21

### I1–I5 — Intelligence surfacing II: 5 more enhancements using existing pure functions

Five additional enhancements wiring already-tested pure functions into new UI locations.

- **I1 — analyseSession in QuickAddModal post-save** (`QuickAddModal.jsx`): post-save confirmation now calls `analyseSession(entry, log.slice(-28))` and displays comparison (above/below type average) + recovery_time estimate. Close delay extended 2.2s → 3.5s. `useData()` added for log access. Test mock updated.
- **I2 — findRecoveryPatterns card in Recovery.jsx**: data-driven patterns card (gated: `!patterns.needsMore` — requires 7+ recovery entries and 6+ session–recovery pairs). Shows best/worst training day badges, optimal readiness range, optimal sleep range, and up to 2 red flags.
- **I3 — EFTrendCard wired to Dashboard** (`Dashboard.jsx`): `EFTrendCard` (Coggan 2003, already in `src/components/science/` but unmounted) lazy-loaded after InsightsPanel. Transforms log to EF shape `{date, avgHR, np, avgPower, avgPaceMPerMin, sport}`. Gracefully shows "Need ≥8 sessions in 30d" for users without HR/power data.
- **I4 — analyzeRecoveryCorrelation card in Recovery.jsx**: load-recovery effect card (gated: `corr.correlation !== null` — requires 3+ session–recovery pairs). Shows avgRecAfterHard / avgRecAfterEasy scores + insight text.
- **I5 — findSeasonalPatterns badge in TodayView** (`TodayView.jsx`): compact PEAK MONTH / OFF-PEAK MONTH badge (gated: 3+ months of data, current month is strong or weak). Positioned between NextActionCard and Morning Brief.

**Tests:** 2728 (unchanged) — all pass. Build: clean.
**Semver:** v9.7.0

DEPENDS ON: v9.6.0 (H-series, nextAction chain, MorningCheckIn)

---

## [v9.6.0] — 2026-04-21

### H1–H5 — Intelligence surfacing: 5 enhancements using existing pure functions

Five targeted enhancements that surface already-tested pure analysis functions into new UI locations.

- **H1 — Sleep tracking in MorningCheckIn** (`MorningCheckIn.jsx`): added sleep hours slider (4–10h, step 0.5h) to 30-second check-in. `sleepHrs` now saved to recovery store as string (matches Recovery.jsx format).
- **H1 — `sleep_debt` rule in nextAction.js**: Rule 5 — fires when avg sleepHrs < 7h over last 7 days with ≥3 readings. Color: amber. Citation: Mah 2011 (SLEEP — sleep extension in athletes).
- **H2 — `injury_risk_high` rule in nextAction.js**: Rule 3 — calls `predictInjuryRisk(log, recovery)` (existing 5-factor model: ACWR, monotony, consecutive hard days, readiness, HRV); fires when level === 'HIGH'. Color: red. Citation: Hulin 2016 (Br J Sports Med). Priority chain fully renumbered: 0–11.
- **H3 — Race time predictions in RaceReadiness tab** (`RaceReadiness.jsx`): added `predictRacePerformance` section below 10-factor breakdown — shows 5K/10K/HM/Marathon predicted times (range: best–worst), method label, VDOT. Only renders when `reliable === true`.
- **H4 — HRV 7-day trend strip in TodayView** (`TodayView.jsx`): inline bar chart (7 bars, last 7 calendar days) with trend badge and baseline ms. Color-coded by `computeHRVTrend` result. Visible when ≥3 HRV readings in 7 days.
- **H5 — Data quality card in Profile tab** (`Profile.jsx`): collapsible card using `assessDataQuality` (previously unused anywhere). Shows grade A–F, 0–100 score, 6-factor badges (LOGGING/RPE/ZONES/RECOVERY/TESTS/PROFILE), top-3 actionable tips.
- **+8 tests** in `nextAction.test.js` (4 for `injury_risk_high`, 4 for `sleep_debt`)

DEPENDS ON: v9.5.0 (MorningCheckIn, nextAction rules, computeHRVTrend, predictInjuryRisk)

---

## [v9.5.0] — 2026-04-21

### G5 — Morning Readiness & HRV Integration (E17)

30-second daily check-in modal with Plews 2013 HRV trend analysis. Feeds into the G3 next-action direction card.

- **`src/lib/hrv.js`**: added `computeHRVTrend(entries)` — 7-day rolling CV (Plews 2013), thresholds: stable <7%, warning 7–10%, unstable ≥10%; and `isHRVSuppressed(entries)` — convenience predicate. Bilingual interpretation strings.
- **`src/lib/nextAction.js`**: Rule 3 `hrv_drift` inserted (priority 3, between `wellness_poor` and `acwr_high`) — fires when HRV CV ≥10% + latest >5% below baseline → recommends easy session (Plews 2013 citation)
- **`src/components/MorningCheckIn.jsx`**: modal with `useFocusTrap`, overlay/Escape dismiss, optional HRV RMSSD input (ms), three 1–5 wellness sliders (sleep/energy/soreness), saves to `recovery` store `{date, score, sleepHrs:null, soreness, stress:3, mood, hrv}`, post-save shows HRV trend card with color + bilingual interpretation
- **`src/components/TodayView.jsx`**: "Morning Readiness Check-In" button added above NextActionCard, visible when no recovery entry exists for today; `MorningCheckIn` lazy-loaded via `Suspense`
- **15 tests** in `src/lib/__tests__/hrv.test.js` (insufficient_data, stable, warning, unstable, dropPct, window filtering, null HRV, output shape, isHRVSuppressed)

DEPENDS ON: v9.4.0 (DataContext setRecovery, G3 nextAction.js hrv_drift rule)

---

## [v9.4.0] — 2026-04-21

### G4 — E14 Race Readiness Calculator

- **`RaceReadiness.jsx`**: new RACE READY tab — 0–100 readiness score, A+/A/B/C/D/F grade, traffic-light indicator (green ≥75, amber 55–74, red <55), 10-factor breakdown with progress bars (FITNESS, FRESHNESS, TAPER, CONSISTENCY, RECOVERY, SLEEP, INJURY, COMPLIANCE, ZONE BALANCE, LONG SESSION), top-3 improvement areas, race date + goal inputs with save-to-profile, citation footer (Banister 1991, Coggan 2003, Morton 1991, Mujika 2003)
- Uses existing `computeRaceReadiness()` from `intelligence.js` — no new computation added
- **LangCtx**: `t_race` label (EN: 'RACE READY', TR: 'YARIŞ HAZIRLIĞI'); `race` tab added to TABS
- **App.jsx**: lazy import + `tab === 'race'` render
- **15 tests** in `raceReadiness.test.js` (acceptance gate, boundary conditions, output shape, injury suppression)

DEPENDS ON: v9.3.0 (DataContext via useData, G3 rules card)

---

## [v9.3.0] — 2026-04-21

### G3 — Rules-based next-action card

First new user-visible feature since E12. Above-the-fold card on TodayView that tells the user what to do next — replacing passive data display with active guidance.

- **`src/lib/nextAction.js`** (pure): 9 priority-ordered rules — `no_sessions` (orientation), `acwr_spike` (Gabbett 2016 — ACWR > 1.5 → mandatory rest), `wellness_poor` (Meeusen 2013 — low wellbeing), `acwr_high` (ACWR 1.3–1.5 → caution), `tsb_deep` (Banister 1991 — TSB < −20 → rest), `race_taper` (Mujika 2003 — race ≤14d), `tsb_high` (Coggan 2003 — quality window), `tsb_low` (fatigue → easy), `acwr_low` (below base → build), `default` (Seiler 2010 — moderate session). Every rule bilingual (EN/TR) + citation.
- **`src/components/NextActionCard.jsx`**: color-coded card (red/amber/green/blue/muted), dismiss button suppresses rule for 24h via `sporeus-nac-dismissed-{ruleId}` localStorage key
- **`TodayView.jsx`**: `<NextActionCard />` renders above Morning Brief
- **29 tests** in `nextAction.test.js` (all 9 rules, output shape, dismissal)

DEPENDS ON: v9.2.8 (DataContext with TQ hooks)

---

## [v9.2.8] — 2026-04-21

### G2 — TanStack Query v5 for training log, profile, and session comments

- **`@tanstack/react-query` v5.99.2** added (13 KB gzip); `ReactQueryDevtools` lazy-loaded in dev only
- **`useTrainingLogQuery`**: replaces `useTrainingLog` in DataContext; `useQuery` with `initialData` from localStorage (zero flash), staleTime 30s, `refetchOnWindowFocus`, optimistic `setLog()` with TQ cache + localStorage update + Supabase background sync + `invalidateQueries`
- **`useProfileQuery`**: replaces `useProfileSync` in DataContext; same pattern; staleTime 60s; preserves new-user local→remote migration logic
- **`useSessionComments`**: TQ cache seeded after `fetchComments`; `invalidateQueries` after post/edit/delete mutations
- **`DataContext.jsx`**: imports new TQ hooks; recovery/injuries/testResults/raceResults unchanged
- **`App.jsx`**: `QueryClientProvider` wraps `DataProvider`; `TQDevtools` lazy via `import.meta.env.DEV`
- 12 new tests (query key, offline data, setLog/setProfile signatures); `useSessionComments.test.js` TQ mock added
- `docs/ops/tanstack_query_pattern.md`: pattern guide for new flows

DEPENDS ON: v9.2.7 (G1 onboarding, DataContext shape)

---

## [v9.2.7] — 2026-04-21

### G1 — Smart QuickAdd defaults, Valibot validation, first-session flow

- **QuickAddModal**: sport-based default session type (Running→Easy Run, Cycling→Easy Ride, Swimming→Easy Swim); duration defaults to 45 min; RPE effort labels (5 plain-language levels); Valibot `SessionSchema` validates before submit; post-save confirmation phase (2.2s checkmark + Training Load summary); "Training Load (TSS)" label replaces "Est. TSS"; Foster 2001 sRPE citation shown; `isFirst` prop triggers 🏆 first-step celebration
- **App.jsx**: passes `profile` and `isFirst={log.length === 0}` to QuickAddModal
- **useAppState.js**: `handleAddSession` detects first entry and auto-navigates to Today tab after 2.4s
- **18 new tests** in `QuickAddModal.test.jsx` (5 describe blocks: defaults, TSS label, RPE labels, validation, submission/close)
- `docs/ops/new_user_flow.md`: new-user journey documented

DEPENDS ON: v9.2.6 (AuthGate, profile shape)

---

## [v9.2.6] — 2026-04-21

### F1 — Auth flow audit & Google sign-in hardening

**Three production issues fixed:**
- **Security**: Removed stale `https://lhr-present.github.io/sporeus-athlete/` from Supabase allowed redirect URLs. If that GitHub Pages URL was ever compromised, it could have received real auth tokens. Fixed via Supabase Management API.
- **UX**: Removed `prompt:'consent'` + `access_type:'offline'` from Google OAuth params. These forced the Google consent screen on every login for returning users. Replaced with `prompt:'select_account'` (shows account picker, no forced consent).
- **Dev**: Fixed dev redirect URL in allowlist — was `/sporeus-athlete/` (wrong path for `base:'/'`), now `http://localhost:5173/`.
- 2 new assertions in `AuthGate.test.jsx` verifying OAuth params and redirect URL.
- `docs/ops/auth_flow_audit.md` committed with full findings.

DEPENDS ON: v9.2.5 (AuthGate, supabase.js implicit flow)

---

## [v9.2.5] — 2026-04-21

### Fixed
- P4 hook enforcement: `commit-msg` hook replaces broken `pre-commit` approach. `pre-commit` was reading stale `COMMIT_EDITMSG` (previous commit's message); `commit-msg` receives `$1` by git contract. Hook was non-functional between 10b271e–e36687c.
- Hook versioned in `.githooks/commit-msg` (tracked). `core.hooksPath` set in repo config. `postinstall` in `package.json` auto-wires new clones.

DEPENDS ON: v9.2.4 (P4 CHANGELOG + pre-commit hook — now superseded by this fix)

## [v9.2.4] — 2026-04-21

**Infrastructure hardening (P1 + P3 + P4). No feature additions.**

- **P1 route-smoke suite** (`tests/e2e/route-smoke.spec.ts`): 27 Playwright tests covering all 22 BOOK_MODE chapter routes + EMBED/SCIENCE/PRIVACY modes. No auth required. Catches white-screen and auth-gate regressions before tag.
- **P3 pre-deploy gate** (`deploy.yml`): `deploy` job now requires `route-smoke` job to pass. Uses `playwright.route-smoke.config.js` + stub Supabase env — no production secrets needed.
- **CHANGELOG.md backfill**: v9.x history added (this block + below).
- **Session log corrections**: debt session item 5 accurately scoped to RLS-isolation-only; behavioral scenarios A–D + F–G flagged as deferred.
- Caveat verification: `supabase_functions.hooks` confirms `comment-notification` is a managed webhook (visible in Dashboard), not a shadow pg_net trigger.

DEPENDS ON: v9.2.3, v9.2.2

---

## [v9.2.3] — 2026-04-21 (HOTFIX — E16 regression)

**Impact window:** ~6 days (E16 shipped ~2026-04-15, caught 2026-04-21 in debt session)
**Symptom:** All 22 book QR codes hit login screen. Silent — Sentry was dark, 2629 tests green.

- `App.jsx`: moved `if (BOOK_MODE)` from line 522 (after `if (!user) return <AuthGate>`) to line 479 (before auth gate). Unauthenticated visitors now reach `ChapterLanding` correctly.
- `docs/ops/session_log.md`: item 1 evidence committed.

DEPENDS ON: App.jsx BOOK_MODE, ChapterLanding, E16 chapter routes

---

## [v9.2.2] — 2026-04-21 (HOTFIX — build break)

**Symptom:** Dev server and prod build would crash on first render of coach/science components. Silent — never deployed with this bug in the bundle.

- 6 components imported non-existent `useLanguage` hook from `LangCtx.jsx`: `ExpandedRow`, `TeamAnnouncement`, `SquadPatternSearch`, `EFTrendCard`, `MetricExplainer`, `DecouplingChart`. Fixed to `useContext(LangCtx)`.
- `docs/ops/realtime_runbook.md`: added `coach_athletes` schema (debt session item 3).
- `supabase/migrations/20260460_realtime_comments.sql` applied: `session_comments` + `session_views` tables, RLS, Realtime publication.
- `supabase/migrations/20260461_fix_sv_rls.sql`: fixed `sv: read own or linked` — athletes can now see coach presence records for their sessions (CoachPresenceBadge was silently broken since E11).
- `VITE_SENTRY_DSN` GitHub secret set; CSP `connect-src` updated for Sentry ingest; `.env.test` blanks DSN for test isolation.

DEPENDS ON: LangCtx, E11 realtime, E15 Sentry, E16 book routes

---

## [v9.2.1] — 2026-04-19

- E12: aerobic decoupling (Pw:Hr Friel method), durability score (Maunder 2021), sub-threshold time tracker (Seiler 2010 polarized)
- E11 i18n and ConnectionBanner polish

DEPENDS ON: training_log, profiles, coach_athletes (E11 schema)

---

## [v9.1.0] — 2026-04-17

- E11: coach↔athlete real-time multiplayer — session comments threaded view, CoachPresenceBadge, offline queue, squad Realtime channel

DEPENDS ON: coach_athletes (active status), training_log, push_subscriptions

---

## [v9.0.0] — 2026-04-16

- E15: Sentry error monitoring, Web Vitals, bundle budgets, Lighthouse CI
- E16: EŞİK/THRESHOLD book QR chapter landings (ch1–ch22), UTM attribution, LocalStorage book_reader_attribution

DEPENDS ON: App.jsx routing, ChapterLanding, chapterBonuses.js, book_reader_attribution migration

---

## v7.0.0 (2026-04-16)
System enhancement sprint — Team Announcements, Quick-Add session, keyboard shortcuts, Sunday digest notification.

**Team Announcements** (Tier 4 complete)
- Migration `20260417_team_announcements.sql` already applied (BIGSERIAL id, message≤280, read_by UUID[])
- `src/lib/db/teamAnnouncements.js` — getAnnouncements, postAnnouncement, deleteAnnouncement, filterUnread, markLocalRead, markAllLocalRead
- `src/components/TeamAnnouncements.jsx` — coach compose/manage view + athlete read view with unread badges
- Wired into CoachDashboard (below SessionManager, only when sbCoachId set)
- Wired into TodayView (below upcoming sessions, only when athlete has connected coach)
- 8 new tests in `teamAnnouncements.test.js`

**Quick-Add Session** (`src/components/QuickAddModal.jsx`)
- Orange `+` button in header, or press `+` / `a` keyboard shortcut
- Session type dropdown (all SESSION_TYPES_BY_DISCIPLINE), duration input, RPE 1–10 slider
- Auto-shows estimated TSS via calcTSS(dur, rpe); adds sanitized entry to log on submit
- Fires a 'training' notification on save; Escape or click-outside to dismiss
- Bilingual (EN/TR via LangCtx)

**Sunday Weekly Digest Notification** (`src/App.jsx`)
- Every Sunday on first app load, computes 7-day session count + total TSS + ACWR
- Pushes `addNotification('analytics', 'Weekly Summary', ...)` once per Sunday (flag: `sporeus-weekly-digest-notif-{date}`)
- Requires ≥5 sessions in log to fire

**Keyboard Shortcuts** (`src/App.jsx`)
- `1`–`7` navigates to tabs (Today/Dashboard/Log/Recovery/Profile/Zones/Tests)
- `+` / `a` opens Quick-Add modal
- `?` opens shortcuts help overlay (table listing all shortcuts)
- `Ctrl+K` opens search palette (existing, now documented)
- `Escape` closes any overlay
- Hint in footer: `? = shortcuts · + = quick log · Ctrl+K = search`

## v6.9.3 (2026-04-16)
Remove Telegram dependency, replace with in-app notification center.

**NotificationBell** (`src/components/NotificationBell.jsx`)
- Bell icon in header nav with unread red badge (hidden at 0)
- Dropdown panel (320px, fixed position): type icon | title | body | time-ago
- Type icons: 🏃 training | 📊 analytics | ⚠️ warning | 🏆 achievement | 💬 coach
- Mark all read / Clear buttons; empty state; click → markRead + navigate to tab
- Reads from `sporeus-notifications` localStorage key; refreshes on storage event

**notificationCenter.js** (`src/lib/notificationCenter.js`)
- `addNotification(type, title, body, metadata)` — saves to localStorage, max 50 newest-first
- `getNotifications()`, `markRead(id)`, `markAllRead()`, `clearAll()`, `getUnreadCount()`
- 9 new tests in `notificationCenter.test.js`

**Telegram removal**
- Deleted `supabase/functions/telegram-notify/` edge function
- Deleted `src/lib/telegramHelpers.js` and its test file
- Removed Telegram section from `NotificationSettings.jsx` (no external service needed)
- Removed `telegram_chat_id` column from `push_subscriptions` (migration `20260417_telegram_cleanup.sql`)
- Removed `sendTelegramDigest()` and `telegram_chat_id` from `nightly-batch/index.ts`

**ACWR spike notification** (`src/App.jsx`)
- useEffect fires when log changes; if ACWR > 1.3, fires `addNotification('warning', 'High Load Warning', ...)` once per day (debounced via `sporeus-acwr-notif-date` localStorage key)

## v5.40.0 (2026-04-13)
Phase 3 scale features — 551 tests (28 files, +36 tests vs v5.30.0):

**Nightly AI batch** (`supabase/functions/nightly-batch/index.ts`)
- Deno edge function; `withSemaphore<T>` pool (limit=10 concurrent Haiku calls)
- Queries wellness_logs for today's check-ins; fetches profile+training_log per athlete
- Computes CTL/ATL/TSB, calls Anthropic Haiku, upserts to `ai_insights`
- Scheduled via pg_cron (see comment in file); logs processed/errors/ms

**Club tier subscription gates** (`src/lib/subscription.js`)
- `TIERS` constant; `canAddAthlete`, `canUseAI`, `getRemainingAICalls`, `isFeatureGated`, `getUpgradePrompt`
- Upgrade banners in CoachSquadView (multi_team gate + athlete limit gate)
- AI daily call counter via `sporeus-ai-calls` localStorage with date key
- 10 new tests in subscription.test.js

**Dodo Payments + Stripe webhook** (`supabase/functions/dodo-webhook/index.ts`)
- HMAC-SHA256 signature verification via Deno `crypto.subtle`
- Handles `payment.succeeded/failed`, `subscription.cancelled`
- Routes by `x-dodo-signature` vs `stripe-signature` header
- Failure emails via Resend API

**Public REST API** (`supabase/functions/public-api/index.ts`)
- Club-tier API key auth; rate limit 100 req/hr via `request_counts` table
- Routes: `GET /api/v1/squad`, `/api/v1/athlete/:id/load`, `/api/v1/squad/export` (CSV)
- CORS for Excel / Google Sheets

**PDF Season Report** (`src/lib/pdfReport.js`)
- Unicode sparklines (▁▂▃▄▅▆▇█), week-by-week CTL/ATL/TSB table
- Wellness 14-week avg, top 5 peak sessions, injury timeline
- Triggered from Profile → Season Report (gated on `export_pdf` club tier)
- 3 new tests in pdfReport.test.js

**White-label config** (`src/lib/whiteLabel.js`)
- `applyTheme`, `getTheme`, `isWhiteLabel`, `loadOrgBranding`, `initWhiteLabel`
- CSS custom properties `--brand-primary` / `--brand-name` applied at App.jsx level
- `org_branding` table (migration `20260412_org_branding.sql`) with owner RLS
- 4 new tests in whiteLabel.test.js

**Realtime coach dashboard** (CoachSquadView.jsx)
- Supabase Realtime channel: `wellness_logs` + `training_log` INSERT events
- Exponential backoff reconnect via `computeBackoff(attempt)` (1s×2^n, max 30s)
- `src/lib/realtimeBackoff.js` — pure function, 3 new tests
- Live status dot (●green/●yellow), `lastUpdated`, rtToast notifications

**Coach-athlete messaging** (`src/components/CoachMessage.jsx`)
- Sliding panel per athlete (desktop + mobile ✉ button in squad table/card)
- Supabase Realtime delivery; read receipts (✓ sent, ✓✓ read via `read_at`)
- Athlete unread badge in TodayView (reads from `sporeus-coach-messages` localStorage)
- `messages` table (migration `20260413_messages.sql`): RLS for coach insert/select + athlete select/update
- 4 new tests in coachMessage.test.js (buildChannelId, formatMsgTime, hasUnread, canSendMessage)

**DB migrations**
- `20260412_subscription.sql` — `subscription_tier` + `subscription_expires_at` on profiles
- `20260412_api_keys.sql` — `api_keys` + `request_counts` tables, RLS
- `20260412_org_branding.sql` — `org_branding` with owner RLS, `touch_updated_at` trigger
- `20260413_messages.sql` — `messages` table (sender_role CHECK, RLS policies for coach+athlete)

- DEPENDS ON: anthropic API key in BYOK localStorage, Supabase Realtime enabled, Resend API for failure emails, pg_cron for nightly batch

## v5.30.0 (2026-04-12)
Phase 2 growth features — 515 tests (26 files, +61 tests vs v5.20.0):

**Multi-team filtering** (CoachSquadView + squadUtils.js)
- `filterByTeam(athletes, team)` + `DEMO_TEAMS` + `getTeams()` in squadUtils.js
- Team selector pill buttons; `sporeus-active-team` localStorage; 5 filterByTeam tests

**Strava client-side import** (`src/lib/strava.js`)
- `importStravaActivities(accessToken, daysBack=30)` — 3-page pagination, safeFetch
- `deduplicateByStravaId(existing, incoming)` — Set-based dedup
- `SPORT_TYPE_MAP` + `stravaToEntry()` normalizer; 6 new tests

**Onboarding v2** (Onboarding.jsx, 5 steps)
- Steps: Welcome → Basic Info → Fitness Level (NEW) → Key Metrics → Goal+Plan Preview
- `getPlanPreview(data)` rule-based preview; progress bar replaces dot indicators

**Dashboard performance metrics** (intelligence.js + Dashboard.jsx)
- `getFormScore(log)` → `{ tsb, color, label }` (TSB-based form state)
- `getPeakWeekLoad(log)` → highest 7-day rolling TSS
- `getConsistencyScore(log, days=28)` → % days with sessions
- 3 new metric boxes before CTLChart; 7 new tests

**Wellness sparkline** (TodayView.jsx)
- Recharts `LineChart` (80px, no axes, `connectNulls`) for 14-day recovery trend
- Shown after "✓ saved today" message

**Digest email** (`src/lib/digestEmail.js`)
- `generateDigestHTML(squadData, weekStart)` → table-only HTML email (print-safe)
- `esc()` XSS helper; `getRuleBasedWeekSummary()`; 5 new tests

**Search palette v2** (SearchPalette.jsx)
- `/command` mode (COMMANDS: /export /dark /lang /sync)
- `#` prefix log-entry search; recent searches (localStorage `sporeus-recent-searches`, last 5)
- Shortcut hints in footer; badge chips per result type

**AI settings panel** (Profile.jsx)
- BYOK API key (show/hide, masked); tier selector; usage estimate; clear cache button
- Season Report button (gated on `export_pdf`)
- Strava import wired to client-side `importStravaActivities` first (edge-function fallback)

- DEPENDS ON: recharts, Strava access_token in Profile state, sporeus-anthropic-key localStorage

## v5.20.0 (2026-04-12)
NL daily digest, CTL phase shading, progress rings — 454 tests (12 new):

**Morning Brief (TodayView)**
- `generateDailyDigest(log, recovery, profile)` in intelligence.js — template NL summary
- Outputs CTL / TSB(±) / ACWR(label) · wellness score(label) · zone balance · load trend
- Returns `{ en, tr, empty, ctl, tsb, acwr }` following generateWeeklyNarrative pattern
- Renders as a collapsible card above Card 1 (Today's Session); hidden when log is empty
- 12 new tests in intelligence.test.js covering empty, ACWR OPTIMAL, wellness labels, zone threshold

**Block periodization phase shading (CTLChart)**
- `getPhaseBands(plan, days)` computes week→phase bands in MM-DD format from YearlyPlan
- Finds Monday on/after generatedAt; maps weeks to chart window; clamps to display range
- CTLChart now accepts `plan` prop (default null); ReferenceArea per phase with 10% opacity
- Phase colors: base=green, build=orange, peak=red, taper=blue, competition=purple, transition=gray
- Dashboard passes `plan` from localStorage to CTLChart

**Progress Rings (TodayView)**
- SVG donut rings card appears when log ≥ 3 sessions (between Quick Stats and Suggestion)
- Ring 1: Week TSS actual vs plan target (falls back to 'no target' if no plan)
- Ring 2: Sessions this week (7d) vs plan week non-rest count (or 5)
- Ring 3: Consecutive days with wellness logged vs 7-day target
- wellStreak + weekTSS computed via useMemo in TodayView

- DEPENDS ON: analyzeZoneBalance + analyzeLoadTrend (intelligence.js); calculatePMC (trainingLoad.js); plan from 'sporeus-plan' localStorage

## v5.19.0 (2026-04-12)
Share Card, cloudSync, coverage — 442 tests (16 new):

**Share Card (Dashboard)**
- `src/components/ShareCard.jsx` — SVG Bloomberg-Terminal training summary card
- Renders: athlete name + sport, CTL, TSB (+/−), ACWR, week TSS, zone model badge, date
- Share button: Web Share API (text) → clipboard copy fallback
- Appears in Dashboard above Quick Links; uses full log for PMC/ACWR, last 28d for zone model
- DEPENDS ON: calculatePMC (trainingLoad.js), zoneDistribution + trainingModel (zoneDistrib.js)

**cloudSync.js**
- `src/lib/cloudSync.js`: `pushTable`, `pullTable`, `deleteRow`, `syncLog` — explicit on-demand Supabase helpers
- Distinct from DataContext.useSyncedTable (reactive); cloudSync is imperative / one-shot
- 16 new tests in `src/lib/cloudSync.test.js` (vi.mock at Supabase boundary)

**Coverage**
- Installed `@vitest/coverage-v8`
- `vite.config.js` test block extended with `coverage: { provider: 'v8', reporter: ['text','json-summary'], include: ['src/lib/**/*.js'] }`
- Run: `npm test -- --coverage` to generate a line/branch report

- DEPENDS ON: supabase.js (implicit flow, settled); zoneDistrib.js (v5.18.0); trainingLoad.js

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
