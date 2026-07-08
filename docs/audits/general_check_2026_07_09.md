# General Health Check — 2026-07-09

Fresh-eyes regression sweep of v9.482–v9.491 (~35 fixes shipped 2026-07-06 → 2026-07-08),
plus cross-version integration and critical-path smoke (read-only).

Scope (from changelog + diffs): ProgramView/NextTrainingCard build-from-input,
FieldTestModal non-destructive persist, _logSport rowing class ripple,
TodayProgrammedSessionCard substantial fallback, recentBest rowing, cyclePhaseGate
dual-shape, rowingTemplates TSS, eliteProgramStaleness, RowingMetricsCard effort gate,
concept2VO2max signature, SeasonBestsCard, sanitizeLogEntry, useSupabaseData mappers,
Dashboard EF, PowerCurve UUID, triLoad.

Findings appended below as verified. Severity: CRITICAL / HIGH / MED / LOW.

---
## F1 — HIGH — FieldTestModal legacy-store persist destroys the program it tried to protect
**File**: src/components/FieldTestModal.jsx:186 (v9.490 F4 non-destructive persist)
**Verified**: buildEliteProgram's return object (eliteProgram.js:1571-1619) has NO `.input` key.
**Scenario**: When `persistedProgram` lacks `.input` (legacy built-shape store — exactly what
FieldTestModal ITSELF wrote pre-v9.490, or an imported old backup) the fallback branch writes
`{ input: program?.input /* always undefined */, form: persistedProgram?.form /* undefined on
legacy */, reAnchored, reAnchoredAt }`. The legacy built program (weeks/phases/feasibility) is
gone. Every reader (ProgramView.jsx:35, NextTrainingCard.jsx:67, EliteProgramCard) then takes the
legacy-passthrough branch on this garbage blob — truthy, so `hasPlan=true` — and the ProgramView
legacy branch has NO feasibility check, so the user gets the exact F7 symptom v9.490 fixed:
"No quality session scheduled in the next 14 days" forever + dead calendar. Undo restores only if
pressed before Close; otherwise permanent data loss.
**Fix**: preserve the blob instead of reshaping it:
`setPersistedProgram(persistedProgram?.input ? { ...persistedProgram, reAnchored, reAnchoredAt }
: { ...(persistedProgram || program), reAnchored, reAnchoredAt })` (legacy readers pass through
unknown extra keys fine).

## F2 — HIGH (latent, cycle-opted athletes) — v9.489 cycle-gate fix is incomplete: object weeks still zero out four number-consuming readers
**Files**: src/lib/athlete/cyclePhaseGate.js:205-220 (dual-shape producer) vs:
- src/lib/athlete/planAdherence.js:331 — `Number(weeklyTSS[wi]) || 0` → `Number({tss:…})`=NaN → plannedTSS=0 for every gated week → adherence engine meaningless.
- src/lib/athlete/eliteProgramToYearly.js:146 — `Number(tss[i]) || 0` → targetTSS=0 for all gated weeks → planLifecycle.js:123 `isApplied=weeks.some(targetTSS>0)`=false → program stuck in 'draft' state; :181 `(tss[last]||0)*0.5` → object*0.5=**NaN** race-week targetTSS; :206 same NaN for Recovery filler weeks.
- src/components/dashboard/EliteProgramCard.jsx:858-904 WeeklyTSSChart — `Math.max(...objects,1)`=NaN → broken SVG coordinates.
- src/lib/athlete/eliteProgramRecovery.js:106 — `.filter(Number.isFinite)` drops every gated week → peakTSS=0 → minimum sleep targets.
**Context**: buildEliteProgram (eliteProgram.js:1486-1489) requests `weeks: weeklyTSS.length`
(clamped to 20 in buildCyclePhaseGate:162), so for programs ≤20 weeks EVERY week becomes an
object for a female athlete with lastPeriodStart set. These readers were equally broken pre-v9.489
(weeks were `{}`), so this is fix-incompleteness, not a fresh regression — but the v9.489 claim
"female programs zeroed — fixed" only holds for `.tss`-aware readers (FieldTestModal sumTSS).
Latency: CYCLE_FEATURE_PUBLISHED=false hides the profile inputs today, but profiles that opted in
while the feature was live still trip it, and ProgramView/EliteProgramCard actively re-inject
live cycle fields into every build.
**Fix**: stop reshaping weeklyTSS — the gate result is already returned as `program.cycleGate`;
keep weeks numeric and let UI read cycleGate.weeks. Or make all four readers `Number(w?.tss ?? w)`.

## F3 — MED — NextTrainingCard fallback build omits the live cycle re-injection its siblings do
**File**: src/components/dashboard/NextTrainingCard.jsx:65-73 vs ProgramView.jsx:37-44 and
EliteProgramCard.jsx:1746-1752.
**Scenario**: the prop-less TodayView mount builds `buildEliteProgram(persisted.input)` without
merging live gender/lastPeriodStart/cycleLength, while the ProgramView mount injects them → the
two mounts can compute different programs (different TSS annotations / gate horizon) for a
cycle-opted athlete. Also a third redundant full build per view (cost — memoized, acceptable).
**Fix**: share one normalization helper (buildFromStored(persisted, profile)) across all three.

## F4 — MED — v9.491 F2 substantial-session fallback: a 95-min session counts LESS than a 50-min one, and the ±1-day window lets today's easy session erase yesterday's miss
**File**: src/components/dashboard/TodayProgrammedSessionCard.jsx:207-214 + logIntentKey:44
**Verified logic**: the fallback fires only when `logIntentKey(e) == null`. But logIntentKey now
returns 'long' for ANY entry with duration ≥ 90 (line 44). So after a missed THRESHOLD day:
- a 50-min unclassifiable row → intent null → substantial (≥45) → miss suppressed ✓
- a 95-min unclassifiable row → intent 'long' ≠ 'threshold' → first check fails AND fallback
  skipped (intent not null) → athlete still accused. The bigger the make-up effort, the more
  likely the accusation.
**Second scenario (missing real misses)**: match window is ±1 day of the missed day (line 198,
pre-existing), and the fallback accepts any ≥45min/≥50TSS unclassified session in that window —
so TODAY'S own logged easy 50-min session suppresses yesterday's genuinely skipped threshold.
45min/50TSS is below a normal easy day, so nearly any adjacent training suppresses the nudge.
**Fix**: fallback condition should be `(logIntentKey(e) == null || logIntentKey(e) === 'long')`
for long-prescription days — or better, drop the null-guard and compare load to the PRESCRIBED
session (e.g. dur ≥ 0.7×dayPlan.durationMin), and restrict the fallback to the target date only.

## F5 — MED — F2's fix was applied to only ONE of two duplicated intent matchers: planAdherence still accuses imported-session athletes ("Behind 0%")
**File**: src/lib/athlete/planAdherence.js:213-221 (adhLogIntent) vs the fixed
TodayProgrammedSessionCard.jsx:33-46 (logIntentKey)
**Verified**: adhLogIntent still reads the phantom `entry.session` (never produced; the real key
is sessionTag), has no duration≥90 'long' inference, and missedKeySessions matching
(planAdherence.js:408-414) has no substantial-session fallback. Same English-jargon-only regexes.
**Scenario**: Strava-import athlete with 100% TSS compliance: every prescribed key session lands
in missedKeySessions → trajectory check at :428 (`>=90 && missed===0`) fails → trajectory
'behind' → message at :434-439 renders literally "Behind 0% — consider easing this week or
extending race date". The exact accusation class v9.491 F2 fixed, still live in the adherence
section / coach share payload.
**Fix**: extract the card's logIntentKey into _logIntent.js (like _logSport) and use it in both
sites, including the substantial fallback for missedKeySessions.

## F6 — MED — Same-tab storage staleness now user-visible: generating a program doesn't light up the new v9.490 surfaces until remount
**Files**: src/hooks/useLocalStorage.js:30-43 (cross-TAB sync only — the `storage` event never
fires in the writing tab), ProgramView.jsx:22, NextTrainingCard.jsx:59,
TodayProgrammedSessionCard.jsx:130, EliteProgramCard.jsx:1686/1837.
**Scenario**: user generates their first program in EliteProgramCard (child) → setPersisted
writes localStorage + local hook state, but ProgramView's independent hook instance never
updates → RaceCountdownBanner/NextTrainingCard/ProgramCalendar stay on "generate a plan first"
while the card right below them shows the built program — until the user switches tabs and back.
Same for FieldTestModal's persist (mounted EliteProgramCard won't see .reAnchored) and for
"GENERATE NEXT CYCLE" (TodayProgrammedSessionCard resets input:null — ProgramView keeps showing
the old plan). Pre-existing hook behavior, but v9.490 made these sibling readers live, so the
inconsistency is now visible.
**Fix**: dispatch a same-tab CustomEvent in useLocalStorage.set (mirroring the quota event) and
adopt it in the hook, or lift the program state to ProgramView and pass setters down.

## F7 — LOW — Rowing missing from todayProgrammedSession SPORT_LABEL: rower's easy day reads "easy run"
**File**: src/lib/athlete/todayProgrammedSession.js:18-23 + :69 (`SPORT_LABEL[sport] ||
SPORT_LABEL.run`). A rowing program's easy day headline is "Today: 60 min easy run" (TR "kolay
koşu"). Also pickIntentKey has no UT1/UT2/TR/AN vocabulary → rowing sessions mostly badge as
'other'/TRAINING (cosmetic). Same gap: NextTrainingCard.intensityChip (UT2/AT/TR unmatched).
**Fix**: add `rowing: { en: 'row', tr: 'kürek' }` + UT/AT/TR/AN patterns to pickIntentKey.

## F8 — LOW/MED — Classification vocabulary drift between the three sport classifiers shipped this block
**Files**: src/lib/athlete/recentBest.js:23 (`/row|erg|kayak|canoe/`) vs
src/lib/athlete/_logSport.js:21 (`/row|erg/`) vs goalActivityMismatch (v9.487 'row' bucket).
**Verified divergences**: (1) kayak/canoe sessions count as rowing for USE MY RECENT BEST (can
seed a rowing program's 2k anchor with a kayak time) but are NOT rowing for compliance/lifecycle
(_logSport → null → count toward ANY program via null-passthrough). The v9.487 founder question
(F4 Kayaking→row) is answered differently by two files shipped one version apart. (2) Field
precedence differs: _logSport checks `e.sport || e.type` (sport wins), recentBest concatenates
both. Not user-visible yet, but the next consumer to pick one will inherit a coin-flip.
**Fix**: single ROW_RE/classifier exported from _logSport.js; founder decides kayak once.

## F9 — LOW (behavior change, flag for founder) — 'rowing'-classified entries no longer count toward triathlon or run/bike/swim program compliance
**File**: src/lib/athlete/_logSport.js:45-53. Pre-v9.491 rows passed as null → counted toward any
program. Now: run program excludes rows (changelog says intended); triathlon program ALSO excludes
them (`sp==='rowing'` fails the tri whitelist) — a triathlete's coach-prescribed erg cross-train
now drags planAdherence/calendarProgress down. Nothing in the changelog claims this was weighed.
Also JSDoc return type (line 10-11) still says 'run'|'bike'|'swim'|'triathlon'|null — 'rowing'
missing (same stale typedef in recentBest.js:98).

## F10 — LOW — calendarProgress.sportMatched polarity inconsistent with the F6 lesson (currently dead output)
**File**: src/lib/athlete/calendarProgress.js:122-124. For a ROWING program, prescribed run/bike
cross-train days are accepted into matchedLogs (entryMatchesProgramSport → true) but then flagged
`sportMatched:false` (strict `logEntrySport(e)==='rowing'`). No UI consumer reads sportMatched
today (verified: zero references outside the lib/tests), so impact is nil — but the first
consumer will re-introduce the "athlete follows the plan, gets penalized" polarity v9.491 F6
fixed. Align or remove the field.
