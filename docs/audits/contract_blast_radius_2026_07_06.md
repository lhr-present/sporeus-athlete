# Contract Blast-Radius Audit — 2026-07-06

Scope: app-wide consumers of this week's contract changes (excluding already-audited Strava files):
1. Honest-null `entry.rpe` (v9.469/472) — NaN arithmetic, `||`-dilution in aggregations, null-passing comparison gates, `.toFixed` on null. (Founder-approved `||5` zone-bucketing group NOT flagged: timeInZone, polarization, ZoneChart, trainingDistribution, staleZones, vo2GapDetector, intensityBalance.)
2. New entry keys `sessionTag`/`sessionTagReason` (v9.473) + `powerPeaks` (v9.480) — shape snapshots, deepEqual, export/import round-trips.
3. `rpe:0` vs `null` semantics (LOW-6) — consumers treating 0 as meaningful.
4. TSS no longer recomputed on notes-edit (v9.472) + unified LTHR-normalized TSS scale (v9.477) — cached TSS-per-duration assumptions.

Status: IN PROGRESS — findings appended as verified.

---

## Findings

### HIGH-1 — Calendar edit path wipes TSS to 0 on null-rpe entries (missed 2nd entry point of the v9.472 LOW fix)
- **Where**: `src/components/TrainingLog.jsx:843` (Calendar `onEdit` callback) → save path `TrainingLog.jsx:319-325` → `src/lib/formulas.js:91` (calcTSS) → `src/lib/validate.js:77` (clamp).
- **Scenario**: v9.472 fixed `startEdit` (line 378: `rpe: entry.rpe == null ? '' : String(entry.rpe)`), but the Calendar view's onEdit at line 843 still does `rpe: String(ses.rpe)` → `String(null)` = the string `'null'`. Chain on save (even a NOTES-ONLY edit): (1) `formRpe = parseInt('null') = NaN` (the `'' || null` guard at :319 doesn't catch the string `'null'`); (2) `inputsChanged` at :323 compares `String(orig.rpe ?? '')` = `''` vs `String(form.rpe ?? '')` = `'null'` → **true**, so TSS is recomputed despite v9.472's notes-edit protection; (3) `formRpe != null` is true for NaN → `calcTSS(duration, NaN)` = NaN; (4) sanitizer `clamp(NaN,0,2000)` → **0**. Result: editing a null-rpe (imported/signal-less) entry from the Calendar — including fixing a notes typo — silently sets its measured/duration-estimated TSS to 0, locally and in the DB via diff-by-id sync. Also the RPE select renders with value `'null'` (no matching option; the `form.rpe === ''` '—' option at :685 doesn't fire).
- **Severity**: HIGH (silent data loss; same class as v9.472 HIGH-2; null-rpe entries are now common post-v9.469).
- **Fix**: at TrainingLog.jsx:843 mirror startEdit: `rpe: ses.rpe == null ? '' : String(ses.rpe)`. Defense-in-depth: make :319 treat NaN parseInt as null, and :323 compare normalized values.

### MED-1 — sessionExecution: Number(null)=0 → null-rpe logged session reports "RPE 0 vs plan" and can flip status to 'under'
- **Where**: `src/lib/athlete/sessionExecution.js:35-38` (`num()` returns 0 for null since `Number(null)=0` is finite) + `:135` (`loggedRpe = num(logEntry.rpe)`); surfaced at `src/components/TodayView.jsx:3410-3417`.
- **Scenario**: athlete's planned session (rpe 6) matched by a signal-less import (rpe null). `loggedRpe = 0` → `rpeAvail = true` → `rpeDelta = -6` → with duration on-target, status becomes **'under'** ("dialed back") and the execution panel renders "RPE **0** vs plan 6 (-6)" — a fabricated 0 the athlete never entered. Pre-v9.469 hydration made this 5 (inert); now it fires on every null-rpe import matched to a plan day.
- **Severity**: MED (wrong athlete-facing verdict + fabricated RPE 0 display, daily surface).
- **Fix**: in `computeSessionExecution`, gate rpe on presence: `const loggedRpe = logEntry.rpe == null ? null : num(logEntry.rpe)` (same for plannedRpe for symmetry).

### MED-2 — afterBigWeekRpe: null-rpe entries counted as RPE 0 in the mean (aggregation dilution)
- **Where**: `src/lib/athlete/afterBigWeekRpe.js:210-214` — `const rpe = Number(e.rpe); if (Number.isFinite(rpe)) { rpeSum += rpe; rpeCount += 1 }`. `Number(null) = 0` **is** finite, so every null-rpe entry adds 0 to the sum and 1 to the count.
- **Scenario**: athlete with mixed manual + signal-less imported weeks: post-big-week mean RPE is dragged toward 0, corrupting the "elevated RPE after big week" comparison (can mask true fatigue elevation or fabricate a "recovered" signal). Exactly the v9.469 dilution class; the file's own doc comment (line 29) says "entries with finite rpe" — the code doesn't implement the null exclusion it intends.
- **Severity**: MED (silent aggregate skew in a fatigue-detection card).
- **Fix**: `if (e.rpe != null && Number.isFinite(rpe)) { ... }`.

### LOW-1 — swimSwolfTrend + runningCadence: Number(null)=0 passes the `< 3` recovery-exclusion gate → null-rpe sessions silently dropped
- **Where**: `src/lib/athlete/swimSwolfTrend.js:121-122` and `src/lib/athlete/runningCadence.js:55-56` — `const rpe = Number(e.rpe); if (Number.isFinite(rpe) && rpe < 3) continue/return true`. Null → 0 → finite → `0 < 3` → excluded as "recovery/very easy".
- **Scenario**: a null-rpe swim/run (imported, no effort signal) is treated as a known-recovery session and excluded from SWOLF trend / cadence analysis. Pre-v9.469 these were included (as fabricated 5). Cards can flip to "not enough data" for import-heavy athletes. Exclusion may even be acceptable, but it's an accidental semantics change, not a decision — and it mislabels "unknown effort" as "known recovery".
- **Severity**: LOW (data shrinkage, no wrong numbers).
- **Fix**: `if (e.rpe != null && Number.isFinite(rpe) && rpe < 3)` (include unknowns), or explicitly document exclusion.

### LOW-2 — sessionVariety: null-rpe short sessions classify as intent 'recovery'
- **Where**: `src/lib/athlete/sessionVariety.js:89-100` — `Number(entry?.rpe)` → null → 0, `Number.isFinite(0)` passes the guard, then rule 1 `rpe <= 3 && dur <= 60` → `'recovery'`.
- **Scenario**: a 45-min signal-less imported session counts as a recovery session in the variety distribution (pre-v9.469 it was 5 → steady/tempo path). Skews the variety verdict toward "recovery-heavy" for import-heavy athletes.
- **Severity**: LOW.
- **Fix**: early-return null when `entry.rpe == null` (comment at :83 already says "NaN RPE → null" — restore that intent, since Number(null) is 0, not NaN).

### LOW-3 — planRationale: fabricated "RPE 0" in athlete-facing copy
- **Where**: `src/lib/athlete/planRationale.js:113-115` — `Number(yEntry.rpe) || 0` then label templates `Yesterday: easy (RPE ${yRPE})`.
- **Scenario**: yesterday = null-rpe import → factor renders "Yesterday: easy (RPE 0)" — a value the athlete never gave. Gating itself is safe (0 is never ≥ HARD_RPE); only the display fabricates.
- **Severity**: LOW (copy honesty).
- **Fix**: omit the parenthetical when rpe is null, e.g. `Yesterday: easy`.

### LOW-4 — calcPRs: "Hardest Session — RPE null" when no entry has an rpe
- **Where**: `src/lib/formulas.js:347,358` — `reduce((best,e)=>(!best||e.rpe>best.rpe)?e:best, null)` seeds with the first entry regardless of rpe; if ALL entries are null-rpe (fully import-driven athlete), `highRPE.rpe` is null and the PR renders the literal string `RPE null`.
- **Severity**: LOW (display; realistic post-v9.469 for signal-less-import athletes).
- **Fix**: filter to `e.rpe != null` first and drop the PR row when none qualify.

### LOW-5 — CoachDashboard share-code ingestion maps null rpe → 0 (re-fabricates the killed fabrication in the coach pipeline)
- **Where**: `src/components/CoachDashboard.jsx:180,189` — `sanitizeNum = v => typeof v === 'number' && isFinite(v) ? v : 0`, applied to `e.rpe`.
- **Scenario**: athlete's shared log arrives coach-side with rpe 0 instead of null. Current consumers (AthleteDetailPanel `s.rpe||'—'`) render it as '—' so today's impact is a stored-value lie, but any future coach-side analytics (e.g. running classifySession/sessionTagSummary over this log — whose v9.473 honesty fix requires null, and treats 0 as a REAL rpe → junk/recovery misclassification) is silently defeated. This is also the rpe:0-vs-null semantics hazard (item 3) in concrete form.
- **Severity**: LOW now, MED if any coach analytics consume this path.
- **Fix**: rpe-specific sanitizer preserving null: `typeof v === 'number' && isFinite(v) ? v : null`.

### LOW-6 — Fabricated-5 in per-session SCORING (unlisted, not the approved zone-bucketing group)
- **Where**: `src/lib/intelligence.js:383` (`scoreSession`: `parseFloat(entry.rpe) || 5`) and `src/lib/patterns.js:167` (`findRecoveryPatterns` quality scoring: `p.session.rpe || 5`).
- **Scenario**: scoreSession grades a just-logged null-rpe session as if the athlete said RPE 5 (feedback text/grade can be wrong for a hard import); findRecoveryPatterns scores null-rpe easy sessions as quality 80+ "good" pairs, biasing optimal-readiness buckets. Both are ||-defaults inside analysis, distinct from the founder-approved zone-bucketing list.
- **Severity**: LOW (scoreSession fires mostly on manual logs which carry rpe; patterns need 6+ recovery pairs).
- **Fix**: skip rpe-dependent scoring components when rpe is null.

### OBSERVATION (not flagged as bugs) — additional ||5 ZONE-BUCKETING sites of the founder-approved class, outside the approved list
Same self-defaulting "no-RPE → moderate zone" pattern as the approved group (timeInZone/polarization/ZoneChart/trainingDistribution/staleZones/vo2GapDetector/intensityBalance), at: `src/lib/patterns.js:23` (_zonePct), `src/lib/patterns.js:66` (isZ2 in correlateTrainingToResults), `src/lib/intelligence.js:165` (28d polarization fallback), `src/components/ui.jsx:215` (ZoneDonut), `src/components/dashboard/WeeklyReportCard.jsx:34`, `src/lib/onboarding/day0Insight.js:27` (dominantZone `||0` → z1 variant), `src/components/dashboard/WeeklyReviewCard.jsx:13` (estimateTSS rpe||5, only when tss==null). If the founder ever revisits the zone-bucketing decision, these sites must be included or they'll drift.

### COSMETIC — null rpe renders as blank/odd in a few read-only surfaces
- `src/components/Calendar.jsx:124` — "RPE " with empty value (JSX renders null as nothing).
- `src/components/Dashboard.jsx:753` + `src/components/dashboard/RecentSessionsCard.jsx:45` — blank RPE cell colored green (null fails both >=8 and >=6 → easy color).
- `src/components/dashboard/AICoachInsights.jsx:21` — prompt line "RPEnull" fed to insight text builder.
- `src/components/dashboard/FieldTestHistoryCard.jsx:152` — `Number.isFinite(Number(e.rpe))` is TRUE for null (Number(null)=0) → renders `{e.rpe}` = blank instead of the intended '—'.
Severity: cosmetic; batch-fix with `?? '—'`.

---

## 2. sessionTag / sessionTagReason (v9.473) + powerPeaks (v9.480) — CHECKED CLEAN

Verified no consumer chokes on or strips the new keys:
- **Sanitizer whitelist** (`src/lib/validate.js:158-163`): all three keys whitelisted (sessionTag ≤30 chars, sessionTagReason ≤200, powerPeaks via `sanitizePowerPeaks`). Any path that funnels entries through `sanitizeLogEntry` preserves them.
- **storage.js export/import** (`src/lib/storage.js:44-90`): raw JSON passthrough of every `sporeus*` localStorage key — new entry keys survive backup/restore untouched.
- **Mappers** (`src/hooks/useSupabaseData.js:102-107,156,164`): `logRowToEntry` hydrates all three; `logEntryToRow` writes `power_peaks` + classifies/stamps `session_tag(+reason)`. Round-trip intact. (The stale-pre-v9.480-cache edit nulling server peaks is the v9.481-DOCUMENTED residual, not re-flagged.)
- **deepEqual diff sites** (`useTrainingLogQuery.js:165`, `useSupabaseData.js:327,448`): order-independent value comparison — new keys produce a legitimate "changed" (sync trigger), never a crash.
- **setLog rebuild sites**: all are spread-merges/appends/filters (TrainingLog add() merges over orig per v9.472; `quickSetRpe` at :393-398 spreads `...rest`; bulk-tag/delete spread/filter; SportProgramBuilder appends). No fixed-key-list rebuild strips the new keys locally.
- **Projections that ignore extra keys (inherently safe)**: pdfReport, reportGenerator, CSV export (TrainingLog:648), ICS export, semantic-search body (TrainingLog:290), AthleteDetailPanel print. CSV export→import round-trip drops the keys by design (fixed columns); re-import re-classifies the tag at logEntryToRow — acceptable.
- **dataMigration**: upload-only (`migrateToSupabase` via logEntryToRow — carries the keys); no reverse/download path exists to strip them.
- Minor info-loss note: CoachDashboard share-code `toLog` (line 189) projects a fixed key set, so sessionTag doesn't reach the share-code coach view — display-only surface, coach ExpandedRow uses DB rows which DO carry the tag. Not a defect.

## 3. rpe:0 vs null semantics — mostly consistent, 2 notes

- Most aggregations/gates use `> 0` or `>= 1` filters → a real clamped 0 is EXCLUDED like null (Dashboard avg, monthlyProgress, recoveryAdherence, sessionRPEDrift, veryEasyShare, highRpeLowTss). pdfReport `if (e.rpe)` and AthleteDetailPanel `s.rpe||'—'` render 0 as absent.
- Two consumers deliberately treat 0 as data: `checkInQuality.isFieldPresent` (`checkInQuality.js:44-48`, commented "a logged 0 is still data") and `injuryForecast.js:171` (`!= null` includes 0 in the mean). Since `logEntryToRow` drops 0→null (documented LOW-6), a locally-clamped 0 flips from "data" to "absent" after a sync round-trip — cross-device inconsistency confined to the rare garbage-input-clamped-to-0 case. No action beyond the existing LOW-6 ticket; if LOW-6 is ever fixed, revisit these two.
- The active fabrication OF a 0 is coach-side ingestion (finding LOW-5 above).

## 4. TSS notes-edit persistence (v9.472) + unified LTHR scale (v9.477) — CHECKED CLEAN (2 informational notes)

- **No consumer asserts tss = f(duration, rpe)**: `calcTSS` call sites are plan generation (formulas.js:409), new-entry creation (QuickAddModal:66), FIT-import fallback (TrainingLog:568), preview button (TrainingLog:721 — new-entry mode only, rpe always set), and the edit recompute (TrainingLog:325 — see HIGH-1). Nothing recomputes/validates stored TSS against duration/rpe on read, so a notes-edit that keeps measured TSS breaks nothing.
- **Monotony/variance/ACWR family** (trainingMonotonyStrain, weeklyTssVariance, monotonyTrend, strainHistory, intelligence ACWR/CTL): all relative statistics over stored daily TSS. The v9.477 scale change is a no-op for all 28 prod rows (no-HR fallback unchanged, live-verified byte-identical fingerprint). INFORMATIONAL: an athlete with PRE-v9.477 Strava HR-session imports (TRIMP×1.2 scale) who is not re-imported would carry a scale step at the deploy boundary inside 7d/28d windows → transient ACWR/monotony skew for ~a month. No such athlete exists in prod today; if one appears, the founder's 90-day re-import procedure unifies the history.
- **Absolute-threshold consumers** (tssBand 50/100/150 at TrainingLog:38-51; classifySession no-plan `tss >= 150` and plan-ratio bands at classifySession.js:84-105): the LTHR-normalized scale anchors 1h@LTHR ≈ 100, which these thresholds were already written against; unification moves imported HR sessions TOWARD the convention, not away. INFORMATIONAL: plan targets from generatePlan use the RPE-formula scale (calcTSS: 1h@RPE7 ≈ 54), so plan-ratio comparisons mix scales — but this predates v9.477 (parse-activity/fileImport were already LTHR-based) and is narrower after unification. Founder-domain calibration question, not a regression.

---

## Checked-clean groups (verified, no finding)

- **Guarded null-rpe consumers**: paceByRpe, hrForRpe, rpeStability, rowingSplitConsistency, decouplingTrend, intelligence.js:108/456/684/1056/1277, patterns.js:70/376, Dashboard.jsx:352, AthleteCard.jsx:14, classifySession (v9.473 fix), sessionTagSummary, polarizationCompliance, veryEasyShare, injuryForecast, sessionRPEDrift, recoveryAdherence, postHardSessionResponse, easyDayCompliance, hardDaySpacing, hardSessionTypePattern, zoneThreeBlackHole, sessionTargets, caffeineDose, highRpeLowTss, vdotTracker, weeklyEnduranceTime, swimSwolfTrend (window-inclusion issue only, LOW-1), checkInQuality, ragPrompts, reportGenerator (fmt null-safe), morningGlance (plan-side).
- **||0 in max/threshold contexts (numerically = exclusion)**: patterns.js:279/421, intelligence.js:276, ruleAlerts.js:59, scienceNotes.js:66/75, ProactiveInjuryAlert, workoutDensity, perfectWeek, highRpeBlock/HighRpeBlockCard, restDayDistribution (deliberate, commented null→easy-day), trainingLoad.js:370-371 (sum-0/count-truthy = correct present-only mean), Dashboard srpeLoad.
- **Founder-approved ||5 zone-bucketing group**: timeInZone, trainingPolarization, ZoneChart, trainingDistribution, staleZones, vo2GapDetector, intensityBalance — not flagged per instruction (same-class unlisted sites listed in OBSERVATION above).
- **Plan-side rpe reads (planned sessions always carry rpe)**: TodayView plannedSession/downgradeRec/tomorrowSession sites, morningGlance, weekRationale sessionBuckets, dailyPrescription todayRpe, PlanGenerator, QuickAddModal prefill; dailyPrescription sessionFlag `?? 5` is inert (5 passes neither ≥8 nor ≤3 gate); QuickAddModal:304 same-inert.
- **New-key round-trips** (section 2), **rpe:0 semantics** (section 3), **TSS scale/persistence consumers** (section 4).

Report complete — 2026-07-06.
